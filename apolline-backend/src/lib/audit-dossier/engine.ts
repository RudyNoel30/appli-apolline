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
import { promises as fs } from 'node:fs'
import { db, schema } from '../../db/index.js'
import { eq, and, sql, inArray, desc } from 'drizzle-orm'
import { pathFor } from '../pieces-storage.js'
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
  /** Nombre de relevés bancaires effectivement attachés à l'analyse (pour transparence UI) */
  relevesAttaches?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Chargement des relevés bancaires P3 pour analyse forensique
// ─────────────────────────────────────────────────────────────────────────────
// Accepte PDF + images (JPG/PNG/WEBP) — les courtiers reçoivent souvent des
// photos smartphone de relevés papier. Claude Vision gère les deux formats.
//
// Filtre exclusionnaire sur le nom de fichier pour écarter les pièces P3 qui
// ne sont CLAIREMENT pas des relevés (RIB seul, fiche IBAN…) car ces fichiers
// ont aucune transaction et feraient perdre des tokens à Claude pour rien.
// Filtre PERMISSIF par défaut : tout ce qui n'est pas évidemment un non-relevé
// passe (un fichier nommé "001.pdf" ou "janvier.pdf" est conservé).
// ─────────────────────────────────────────────────────────────────────────────

/** Patterns de noms de fichiers à exclure (NON-relevés évidents) */
const NOT_RELEVE_PATTERN = /^(?:rib|iban|ribcheque|cadre[\s_-]?bleu|fiche[\s_-]?iban|fiche[\s_-]?bancaire)\b/i

const ALLOWED_RELEVE_MIME = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
] as const

type ReleveLoaded = {
  filename: string
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp'
  base64: string
}

/**
 * Charge les pièces P3 candidates à l'analyse forensique du dossier.
 * Max 3 fichiers les plus récents, taille max 8 Mo / fichier.
 */
async function loadRelevesP3(dossierId: string): Promise<ReleveLoaded[]> {
  const rows = await db.select().from(schema.pieces).where(and(
    eq(schema.pieces.dossierId, dossierId),
    eq(schema.pieces.categorie, 'P3'),
    inArray(schema.pieces.mimeType, ALLOWED_RELEVE_MIME as unknown as string[]),
  )).orderBy(desc(schema.pieces.uploadedAt))  // plus récent d'abord

  const filtered = rows
    .filter((r) => (r.sizeBytes ?? 0) <= 8 * 1024 * 1024)
    .filter((r) => !NOT_RELEVE_PATTERN.test(r.filename))
    .slice(0, 3)  // 3 plus récents valides

  const results: ReleveLoaded[] = []
  for (const piece of filtered) {
    try {
      const buf = await fs.readFile(pathFor(piece.dossierId, piece.id))
      results.push({
        filename: piece.filename,
        mimeType: piece.mimeType as ReleveLoaded['mimeType'],
        base64: buf.toString('base64'),
      })
    } catch (e) {
      console.warn(`[audit] impossible de lire relevé P3 ${piece.id}:`, e instanceof Error ? e.message : String(e))
    }
  }
  return results
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

  // 4. Charge les relevés bancaires P3 pour analyse forensique (si présents)
  const releves = await loadRelevesP3(dossierId)

  // 5. Construit le content user : JSON contexte + relevés en pièces jointes.
  //    Les PDFs passent en "document" block, les images en "image" block.
  type DocumentBlock = { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string }; title?: string }
  type ImageBlock = { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/webp'; data: string } }
  type TextBlock = { type: 'text'; text: string }
  const userContent: Array<TextBlock | DocumentBlock | ImageBlock> = []

  // D'abord les relevés (Claude les traite mieux quand ils sont avant le texte explicatif)
  for (const r of releves) {
    if (r.mimeType === 'application/pdf') {
      userContent.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: r.base64 },
        title: r.filename,
      })
    } else {
      // Image : JPG/PNG/WEBP — photo smartphone d'un relevé papier
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: r.mimeType, data: r.base64 },
      })
    }
  }

  const forensicInstr = releves.length > 0
    ? `\n\n⚠️ ${releves.length} relevé(s) bancaire(s) attaché(s) → tu DOIS produire la section "forensique" complète (13 catégories) en analysant ligne par ligne ces relevés.`
    : `\n\n(Pas de relevés bancaires attachés — laisse la section "forensique" à null.)`

  userContent.push({
    type: 'text',
    text: `Voici le contexte du dossier à auditer :\n\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\`${forensicInstr}\n\nProduis l'audit complet selon le format JSON spécifié.`,
  })

  // 6. Appel Claude
  try {
    const res = await client.messages.create({
      model: AUDIT_MODEL,
      max_tokens: releves.length > 0 ? 12000 : 6000,  // plus de tokens si forensique
      system: AUDIT_DOSSIER_PROMPT,
      messages: [
        {
          role: 'user',
          content: userContent as unknown as Anthropic.MessageParam['content'],
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
        relevesAttaches: releves.length,
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
      relevesAttaches: releves.length,
    }
  } catch (e) {
    return {
      status: 'failed', data: null,
      error: e instanceof Error ? e.message : String(e),
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostEur: 0 },
      relevesAttaches: releves.length,
    }
  }
}
