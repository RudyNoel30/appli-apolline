/**
 * Moteur d'import d'un AA summary extract.txt vers la BDD Apolline.
 *
 * Workflow :
 *   1. Reçoit le texte intégral de l'extract + (optionnel) le chemin OneDrive source
 *   2. Appelle Claude pour parser → JSON structuré (client + dossier + emprunteurs)
 *   3. Génère une référence Apolline (YYYY-NNNN)
 *   4. Crée le client (prospect) en BDD
 *   5. Crée le dossier en BDD avec legacyId optionnel pour traçabilité OneDrive
 *   6. Retourne les ids créés
 */
import Anthropic from '@anthropic-ai/sdk'
import { db, schema } from '../../db/index.js'
import { sql, eq } from 'drizzle-orm'
import { IMPORT_EXTRACT_PROMPT } from './prompt.js'

const apiKey = process.env.ANTHROPIC_API_KEY
const client = apiKey ? new Anthropic({ apiKey }) : null

// Import = tâche CRITIQUE qui pré-remplit un dossier complet (état civil + revenus +
// projet + alertes des 2 emprunteurs). Une omission silencieuse côté Claude
// (emprunteur2 mal rempli, patrimoine ignoré…) génère du retravail manuel coûteux.
// Donc on utilise Opus 4.7 par défaut — qualité maximale pour un coût ~0.30 €/import
// (vs Sonnet 4.7 qui retourne souvent un emprunteur2 incomplet).
const IMPORT_MODEL = process.env.ANTHROPIC_MODEL_IMPORT_EXTRACT
  ?? process.env.ANTHROPIC_MODEL_OPUS
  ?? 'claude-opus-4-7-20251215'

// Tarifs Opus 4.7 en EUR/1M tokens (input ~15$/M output ~75$/M, conversion 0.95)
const PRICING = { input: 14.25, output: 71.25 }

export type ImportExtractResult = {
  status: 'completed' | 'failed'
  dossierId?: string
  clientId?: string
  ref?: string
  legacyId?: string | null
  fieldsImported?: number
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
 * Génère la prochaine référence Apolline format YYYY-NNNN basée sur la BDD.
 * Atomicité simple par query MAX — suffisant pour un cabinet de quelques
 * dossiers/jour. Race possible mais ref est unique() en BDD donc INSERT
 * échouera proprement en cas de collision (le caller retry).
 */
async function nextDossierRef(): Promise<string> {
  const year = new Date().getFullYear()
  const rows = await db.execute(sql`
    SELECT ref FROM dossiers
    WHERE ref LIKE ${`${year}-%`}
    ORDER BY ref DESC
    LIMIT 1
  `)
  const last = (rows.rows as Array<{ ref: string }>)[0]?.ref
  let nextN = 1
  if (last) {
    const m = last.match(/-(\d+)$/)
    if (m) nextN = (Number(m[1]) || 0) + 1
  }
  return `${year}-${String(nextN).padStart(4, '0')}`
}

/**
 * Compte combien de champs ont été effectivement remplis dans le JSON Claude.
 * Sert juste à afficher "X champs importés" côté UI.
 */
function countFilledFields(obj: Record<string, unknown> | null | undefined): number {
  if (!obj) return 0
  let n = 0
  for (const v of Object.values(obj)) {
    if (v === null || v === undefined || v === '' || v === 0) continue
    if (Array.isArray(v) && v.length === 0) continue
    if (typeof v === 'object') n += countFilledFields(v as Record<string, unknown>)
    else n++
  }
  return n
}

export async function importExtract(
  extractText: string,
  uploadedBy?: string,
): Promise<ImportExtractResult> {
  if (!client) {
    return {
      status: 'failed', error: 'ANTHROPIC_API_KEY non configurée',
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostEur: 0 },
    }
  }
  if (!extractText || extractText.trim().length < 100) {
    return {
      status: 'failed', error: 'Extract vide ou trop court',
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostEur: 0 },
    }
  }

  try {
    // 1. Parse via Claude (Opus 4.7 = qualité maximum pour cette tâche critique)
    // max_tokens élevé (16k) car le JSON peut être conséquent quand les 2
    // emprunteurs sont remplis + crédits + patrimoine.
    const res = await client.messages.create({
      model: IMPORT_MODEL,
      max_tokens: 16000,
      system: IMPORT_EXTRACT_PROMPT,
      messages: [{
        role: 'user',
        content: `Voici le contenu intégral du fichier AA summary extract.txt :\n\n\`\`\`\n${extractText}\n\`\`\`\n\nProduis le JSON COMPLET conforme au schéma Apolline. RAPPEL CRITIQUE : si §1.2 EMPRUNTEUR 2 est présent, tu DOIS remplir TOUS les champs disponibles d'emprunteur2 (nom, prénom, naissance, profession, employeur, salaire net imposable médian, RFR, ancienneté…) — pas juste le nom.`,
      }],
    })

    const block = res.content[0]
    const text = block && block.type === 'text' ? block.text : ''
    const parsed = parseJsonLenient(text)

    if (!parsed) {
      return {
        status: 'failed', error: 'Sortie Claude non parsable',
        usage: {
          inputTokens: res.usage.input_tokens,
          outputTokens: res.usage.output_tokens,
          estimatedCostEur: estimateCost(res.usage),
        },
      }
    }

    const usage = {
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
      estimatedCostEur: estimateCost(res.usage),
    }

    // 2. Validation minimale du JSON
    const clientData = parsed.client as Record<string, unknown> | undefined
    const dossierData = parsed.dossier as Record<string, unknown> | undefined
    const emp1 = parsed.emprunteur1 as Record<string, unknown> | undefined
    const emp2 = parsed.emprunteur2 as Record<string, unknown> | null | undefined

    if (!clientData || !dossierData || !emp1) {
      return {
        status: 'failed', error: 'JSON incomplet (client/dossier/emprunteur1 manquant)',
        usage,
      }
    }

    const prenom = String(clientData.prenom ?? '').trim()
    const nom = String(clientData.nom ?? '').trim()
    if (!prenom || !nom) {
      return { status: 'failed', error: 'Nom/prénom client manquant', usage }
    }

    // 3. Génère la ref Apolline + insère client
    const ref = await nextDossierRef()
    const legacyId = dossierData.legacyId ? String(dossierData.legacyId).trim() : null

    // Helper : convertit toute valeur "vide/null/undefined" en null (vs string vide)
    // pour les champs structurés du conjoint et autres optionnels.
    const str = (v: unknown): string | null => {
      if (v === null || v === undefined) return null
      const s = String(v).trim()
      return s ? s : null
    }

    const [newClient] = await db.insert(schema.clients).values({
      prenom,
      nom,
      email: String(clientData.email ?? ''),
      tel: String(clientData.tel ?? ''),
      naissance: String(clientData.naissance ?? ''),
      // Nouveaux champs structurés (2026-05 — retour Sébastien)
      lieuNaissance: str(clientData.lieuNaissance),
      adresse: str(clientData.adresse),
      codePostal: str(clientData.codePostal),
      ville: String(clientData.ville ?? ''),
      profession: String(clientData.profession ?? ''),
      conjoint: clientData.conjoint ? String(clientData.conjoint) : null,
      conjointPrenom: str(clientData.conjointPrenom),
      conjointNom: str(clientData.conjointNom),
      conjointNaissance: str(clientData.conjointNaissance),
      conjointLieuNaissance: str(clientData.conjointLieuNaissance),
      conjointTel: str(clientData.conjointTel),
      conjointEmail: str(clientData.conjointEmail),
      conjointProfession: str(clientData.conjointProfession),
      revenuMensuelNet: Number(clientData.revenuMensuelNet ?? 0),
      statutCommercial: 'prospect',
      notes: clientData.notes ? String(clientData.notes) : null,
      lastActivity: sql`NOW()` as unknown as string,
    } as never).returning()

    if (!newClient) {
      return { status: 'failed', error: 'Échec création client', usage }
    }

    // 4. Insère dossier — complet, tous les champs du schema retransmis
    const creditsExistants = Array.isArray(dossierData.creditsExistants) ? dossierData.creditsExistants : []
    const patrimoine = Array.isArray(dossierData.patrimoine) ? dossierData.patrimoine : []
    const droitsEL = Array.isArray(dossierData.droitsEL) ? dossierData.droitsEL : []

    const [newDossier] = await db.insert(schema.dossiers).values({
      ref,
      legacyId,
      clientId: newClient.id,
      clientNom: `${prenom} ${nom}`,
      statut: 'R0',
      typeProjet: String(dossierData.typeProjet ?? 'RP'),
      villeBien: String(dossierData.villeBien ?? ''),
      montantBien: Number(dossierData.montantBien ?? 0),
      montantPret: Number(dossierData.montantPret ?? 0),
      apport: Number(dossierData.apport ?? 0),
      dureeMois: Number(dossierData.dureeMois ?? 240),
      // Coûts opération
      coutLogement: Number(dossierData.coutLogement ?? 0),
      coutTerrain: Number(dossierData.coutTerrain ?? 0),
      coutTravaux: Number(dossierData.coutTravaux ?? 0),
      coutMobilier: Number(dossierData.coutMobilier ?? 0),
      coutViabilisation: Number(dossierData.coutViabilisation ?? 0),
      fraisNotaire: Number(dossierData.fraisNotaire ?? 0),
      fraisAgence: Number(dossierData.fraisAgence ?? 0),
      fraisEtablissement: Number(dossierData.fraisEtablissement ?? 0),
      fraisExpertise: Number(dossierData.fraisExpertise ?? 0),
      rachatCreditCout: Number(dossierData.rachatCreditCout ?? 0),
      // Revenus / charges ménage
      rfMenage: Number(dossierData.rfMenage ?? 0),
      rfReferenceN1: Number(dossierData.rfReferenceN1 ?? 0),
      rfReferenceN2: Number(dossierData.rfReferenceN2 ?? 0),
      allocFamiliales: Number(dossierData.allocFamiliales ?? 0),
      aplAlActuelle: Number(dossierData.aplAlActuelle ?? 0),
      epargneMenage: Number(dossierData.epargneMenage ?? 0),
      loyerMenage: Number(dossierData.loyerMenage ?? 0),
      autresDepensesMenage: Number(dossierData.autresDepensesMenage ?? 0),
      empruntsLocatifsMenage: Number(dossierData.empruntsLocatifsMenage ?? 0),
      empruntsNonLocatifsMenage: Number(dossierData.empruntsNonLocatifsMenage ?? 0),
      // Patrimoine / crédits existants / épargne (jsonb arrays)
      creditsExistants: creditsExistants as never,
      patrimoine: patrimoine as never,
      droitsEL: droitsEL as never,
      // Caractéristiques détaillées du bien (§5 de l'extract)
      bienDetails: (dossierData.bienDetails ?? {}) as never,
      // Caractérisation projet
      typeAchat: dossierData.typeAchat ? String(dossierData.typeAchat) : null,
      destination: dossierData.destination ? String(dossierData.destination) : null,
      typeLogement: dossierData.typeLogement ? String(dossierData.typeLogement) : null,
      compromisSigne: Boolean(dossierData.compromisSigne ?? false),
      actePrevuLe: dossierData.actePrevuLe ? String(dossierData.actePrevuLe) : null,
      ptzZone: dossierData.ptzZone ? String(dossierData.ptzZone) : null,
      alertes: Array.isArray(dossierData.alertes) ? dossierData.alertes as string[] : [],
      // Emprunteurs (jsonb)
      emprunteur1: emp1 as never,
      emprunteur2: emp2 ?? null,
      commercialId: uploadedBy ?? null,
    } as never).returning()

    if (!newDossier) {
      // Rollback client en cas d'échec dossier (pour pas laisser de prospect orphelin)
      await db.delete(schema.clients).where(eq(schema.clients.id, newClient.id))
      return { status: 'failed', error: 'Échec création dossier', usage }
    }

    const fieldsImported = countFilledFields(parsed)

    return {
      status: 'completed',
      dossierId: newDossier.id,
      clientId: newClient.id,
      ref,
      legacyId,
      fieldsImported,
      usage,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      status: 'failed',
      error: msg,
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostEur: 0 },
    }
  }
}
