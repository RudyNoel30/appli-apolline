/**
 * Moteur d'audit dossier — assemble le contexte + appelle Claude + parse le résultat.
 *
 * Le contexte envoyé à Claude contient :
 *  - Dossier (projet, montants, conditions)
 *  - Client (emprunteur 1 et 2 : identité, revenus, profession, charges)
 *  - Prêts proposés (montants, taux, durées, paliers)
 *  - Historique cabinet : taux d'accord par banque sur dossiers similaires
 *    (filtré sur tranches de revenus comparables des 12 derniers mois)
 */
import Anthropic from '@anthropic-ai/sdk'
import { db, schema } from '../../db/index.js'
import { eq, sql } from 'drizzle-orm'
import { AUDIT_DOSSIER_PROMPT } from './prompt.js'

const apiKey = process.env.ANTHROPIC_API_KEY
const client = apiKey ? new Anthropic({ apiKey }) : null

const AUDIT_MODEL = process.env.ANTHROPIC_MODEL_AUDIT
  ?? process.env.ANTHROPIC_MODEL_SONNET
  ?? 'claude-sonnet-4-6'

// Tarifs Sonnet
const PRICING = { input: 2.85, output: 14.25 }

export type AuditResult = {
  status: 'completed' | 'failed'
  data: Record<string, unknown> | null
  error?: string
  usage: { inputTokens: number; outputTokens: number; estimatedCostEur: number }
}

function estimateCost(u: { input_tokens: number; output_tokens: number }): number {
  return Number(((u.input_tokens / 1e6) * PRICING.input + (u.output_tokens / 1e6) * PRICING.output).toFixed(4))
}

function parseJsonLenient(raw: string): Record<string, unknown> | null {
  const t = raw.trim()
  if (!t) return null
  if (t.startsWith('{')) {
    try { return JSON.parse(t) as Record<string, unknown> } catch { /* ignore */ }
  }
  const first = t.indexOf('{')
  const last = t.lastIndexOf('}')
  if (first >= 0 && last > first) {
    try { return JSON.parse(t.slice(first, last + 1)) as Record<string, unknown> } catch { /* ignore */ }
  }
  return null
}

/**
 * Construit un mini-historique cabinet : taux d'accord par banque sur les 12
 * derniers mois, agrégé tous profils confondus. Suffisant comme guide pour
 * Claude (qui pondère lui-même selon le profil du dossier audité).
 */
async function buildHistoriqueBanques(): Promise<Array<{ banque: string; envois: number; accords: number; tauxAccordPct: number }>> {
  const rows = await db.execute(sql`
    SELECT
      COALESCE(banque, 'Inconnue') AS banque,
      COUNT(*) FILTER (WHERE statut IN ('propose', 'accorde', 'offre_editee', 'signe', 'refuse')) AS envois,
      COUNT(*) FILTER (WHERE statut IN ('accorde', 'offre_editee', 'signe')) AS accords
    FROM prets
    WHERE created_at >= NOW() - INTERVAL '12 months'
      AND banque IS NOT NULL
      AND banque <> ''
    GROUP BY banque
    HAVING COUNT(*) >= 2
    ORDER BY accords DESC
    LIMIT 20
  `)
  type Row = { banque: string; envois: number | string; accords: number | string }
  return (rows.rows as unknown as Row[]).map((r) => {
    const envois = Number(r.envois) || 0
    const accords = Number(r.accords) || 0
    return {
      banque: r.banque,
      envois,
      accords,
      tauxAccordPct: envois > 0 ? Math.round((accords / envois) * 100) : 0,
    }
  })
}

export async function auditDossier(dossierId: string): Promise<AuditResult> {
  if (!client) {
    return {
      status: 'failed', data: null, error: 'ANTHROPIC_API_KEY non configurée',
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostEur: 0 },
    }
  }

  // 1. Charge le dossier + client + prêts
  const [dossier] = await db.select().from(schema.dossiers).where(eq(schema.dossiers.id, dossierId))
  if (!dossier) {
    return {
      status: 'failed', data: null, error: 'Dossier introuvable',
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostEur: 0 },
    }
  }
  const [clientRow] = dossier.clientId
    ? await db.select().from(schema.clients).where(eq(schema.clients.id, dossier.clientId))
    : [null]
  const prets = await db.select().from(schema.prets).where(eq(schema.prets.dossierId, dossierId))

  // 2. Historique cabinet
  const historiqueBanques = await buildHistoriqueBanques()

  // 3. Contexte JSON minimal pour Claude — utilise les champs réels du schema
  const coutTotal =
    (dossier.coutLogement ?? dossier.montantBien ?? 0) +
    (dossier.coutTerrain ?? 0) +
    (dossier.coutTravaux ?? 0) +
    (dossier.coutViabilisation ?? 0) +
    (dossier.coutMobilier ?? 0) +
    (dossier.fraisNotaire ?? 0) +
    (dossier.fraisEtablissement ?? 0) +
    (dossier.fraisAgence ?? 0) +
    (dossier.rachatCreditCout ?? 0)
  const totalEmprunts = prets.reduce((s, p) => s + (p.montant ?? 0), 0)
  const apport = dossier.apport ?? 0
  const resteAFinancer = coutTotal - apport - totalEmprunts

  const context = {
    dossier: {
      ref: dossier.ref,
      statut: dossier.statut,
      typeProjet: dossier.typeProjet,
      typeAchat: dossier.typeAchat,
      destination: dossier.destination,
      typeLogement: dossier.typeLogement,
      villeBien: dossier.villeBien,
      ptzZone: dossier.ptzZone ?? null,
      compromisSigne: dossier.compromisSigne ?? false,
      actePrevuLe: dossier.actePrevuLe,
      // Montants
      montantBien: dossier.montantBien ?? 0,
      coutLogement: dossier.coutLogement ?? 0,
      coutTerrain: dossier.coutTerrain ?? 0,
      coutTravaux: dossier.coutTravaux ?? 0,
      coutViabilisation: dossier.coutViabilisation ?? 0,
      coutMobilier: dossier.coutMobilier ?? 0,
      fraisNotaire: dossier.fraisNotaire ?? 0,
      fraisAgence: dossier.fraisAgence ?? 0,
      apport,
      coutTotalEstime: coutTotal,
      totalEmprunte: totalEmprunts,
      resteAFinancer,
      // Scoring
      ltv: dossier.ltv ?? 0,
      hcsfOk: dossier.hcsfOk ?? false,
      scoreConfiance: dossier.scoreConfiance ?? 0,
      alertes: dossier.alertes ?? [],
      // Foyer / revenus
      rfMenage: dossier.rfMenage ?? 0,
      allocFamiliales: dossier.allocFamiliales ?? 0,
      aplAlActuelle: dossier.aplAlActuelle ?? 0,
      epargneMenage: dossier.epargneMenage ?? 0,
      loyerMenage: dossier.loyerMenage ?? 0,
      autresDepensesMenage: dossier.autresDepensesMenage ?? 0,
      empruntsLocatifsMenage: dossier.empruntsLocatifsMenage ?? 0,
      empruntsNonLocatifsMenage: dossier.empruntsNonLocatifsMenage ?? 0,
      rfReferenceN1: dossier.rfReferenceN1 ?? 0,
      rfReferenceN2: dossier.rfReferenceN2 ?? 0,
      creditsExistants: dossier.creditsExistants ?? [],
      // Emprunteurs (sources principales)
      emprunteur1: dossier.emprunteur1,
      emprunteur2: dossier.emprunteur2,
    },
    client: clientRow ? {
      nom: clientRow.nom,
      prenom: clientRow.prenom,
      naissance: clientRow.naissance,
      ville: clientRow.ville,
      profession: clientRow.profession,
      conjoint: clientRow.conjoint,
      statutCommercial: clientRow.statutCommercial,
    } : null,
    prets: prets.map((p) => ({
      type: p.type,
      libelle: p.libelle,
      banque: p.banque,
      montant: p.montant,
      tauxNominal: p.tauxNominal,
      dureeMois: p.dureeMois,
      mensualiteHorsAssurance: p.mensualiteHorsAssurance,
      mensualiteTotale: p.mensualiteTotale,
      statut: p.statut,
      profilAmortissement: p.profilAmortissement,
      garantieType: p.garantieType,
      paliers: p.paliers,
    })),
    historique_cabinet: {
      note: 'Taux d\'accord constatés sur les 12 derniers mois, tous profils confondus. Pondère selon le profil du dossier audité.',
      par_banque: historiqueBanques,
    },
  }

  // 4. Appel Claude
  try {
    const res = await client.messages.create({
      model: AUDIT_MODEL,
      max_tokens: 6000,
      system: AUDIT_DOSSIER_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Voici le contexte du dossier à auditer :\n\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\`\n\nProduis l'audit complet selon le format JSON spécifié.`,
        },
      ],
    })
    const block = res.content[0]
    const text = block && block.type === 'text' ? block.text : ''
    const parsed = parseJsonLenient(text)

    if (!parsed) {
      return {
        status: 'failed', data: null, error: 'Sortie Claude non parsable',
        usage: {
          inputTokens: res.usage.input_tokens,
          outputTokens: res.usage.output_tokens,
          estimatedCostEur: estimateCost(res.usage),
        },
      }
    }

    return {
      status: 'completed',
      data: parsed,
      usage: {
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
        estimatedCostEur: estimateCost(res.usage),
      },
    }
  } catch (e) {
    return {
      status: 'failed', data: null,
      error: e instanceof Error ? e.message : String(e),
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostEur: 0 },
    }
  }
}
