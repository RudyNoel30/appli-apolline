/**
 * Moteur d'import d'un AA summary simulation.txt vers la BDD Apolline (table prets).
 *
 * Workflow :
 *   1. Reçoit le texte intégral de la simulation Cifacil + un dossierId existant
 *   2. Appelle Claude pour parser → JSON structuré (banque portante + liste prêts)
 *   3. Insère un par un les prêts dans la table prets avec rang correct
 *   4. Retourne le nombre de prêts créés + leur résumé
 *
 * Différence avec import-extract :
 *   - import-extract CRÉE un dossier (client + dossier complet)
 *   - import-simulation AJOUTE des prêts à un dossier existant
 */
import Anthropic from '@anthropic-ai/sdk'
import { db, schema } from '../../db/index.js'
import { eq } from 'drizzle-orm'
import { IMPORT_SIMULATION_PROMPT } from './prompt.js'

const apiKey = process.env.ANTHROPIC_API_KEY
const client = apiKey ? new Anthropic({ apiKey }) : null

// Opus 4.7 pour qualité maximale : le plan de financement contient souvent
// plusieurs prêts (principal + PTZ + Action Logement + lissage) avec paliers
// et frais à ventiler. Une erreur ici fausse les calculs de TAEG et de coût total.
const IMPORT_MODEL = process.env.ANTHROPIC_MODEL_IMPORT_SIMULATION
  ?? process.env.ANTHROPIC_MODEL_OPUS
  ?? 'claude-opus-4-7-20251215'

const PRICING = { input: 14.25, output: 71.25 }

export type ImportSimulationPretCree = {
  id: string
  rang: number
  type: string
  libelle: string | null
  montant: number
  tauxNominal: number | null
  dureeMois: number
}

export type ImportSimulationResult = {
  status: 'completed' | 'failed'
  dossierId?: string
  banquePortante?: string
  pretsCrees?: ImportSimulationPretCree[]
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

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^\d.,-]/g, '').replace(',', '.')
    const n = Number(cleaned)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

function str(v: unknown, fallback = ''): string {
  if (v === null || v === undefined) return fallback
  return String(v)
}

const VALID_TYPES = new Set(['amortissable', 'ptz', 'action_logement', 'epargne_logement', 'relais', 'in_fine', 'lissage'])
const VALID_PROFILS = new Set(['standard', 'paliers_lissage', 'in_fine', 'differe'])
const VALID_GARANTIES = new Set(['credit_logement', 'saccef', 'casden', 'hypotheque', 'ppd', 'caution_autre', 'nantissement', 'autre'])

export async function importSimulation(
  dossierId: string,
  simulationText: string,
): Promise<ImportSimulationResult> {
  if (!client) {
    return {
      status: 'failed', error: 'ANTHROPIC_API_KEY non configurée',
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostEur: 0 },
    }
  }
  if (!simulationText || simulationText.trim().length < 50) {
    return {
      status: 'failed', error: 'Simulation vide ou trop courte',
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostEur: 0 },
    }
  }

  // Vérifier que le dossier existe
  const [existingDossier] = await db
    .select({ id: schema.dossiers.id })
    .from(schema.dossiers)
    .where(eq(schema.dossiers.id, dossierId))
    .limit(1)
  if (!existingDossier) {
    return {
      status: 'failed', error: `Dossier ${dossierId} introuvable`,
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostEur: 0 },
    }
  }

  try {
    const res = await client.messages.create({
      model: IMPORT_MODEL,
      max_tokens: 8000,
      system: IMPORT_SIMULATION_PROMPT,
      messages: [{
        role: 'user',
        content: `Voici le contenu intégral du fichier AA summary simulation.txt :\n\n\`\`\`\n${simulationText}\n\`\`\`\n\nExtrais le plan de financement et produis le JSON conforme au schéma Apolline.`,
      }],
    })

    const block = res.content[0]
    const text = block && block.type === 'text' ? block.text : ''
    const parsed = parseJsonLenient(text)

    const usage = {
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
      estimatedCostEur: estimateCost(res.usage),
    }

    if (!parsed) {
      return { status: 'failed', error: 'Sortie Claude non parsable', usage }
    }

    const banquePortante = str(parsed.banque)
    const prets = Array.isArray(parsed.prets) ? parsed.prets : []

    if (prets.length === 0) {
      return { status: 'failed', error: 'Aucun prêt extrait du plan de financement', usage }
    }

    // Récupérer le rang max existant pour ne pas écraser les prêts déjà saisis
    const existingPrets = await db
      .select({ rang: schema.prets.rang })
      .from(schema.prets)
      .where(eq(schema.prets.dossierId, dossierId))
    const baseRang = existingPrets.reduce((max, p) => Math.max(max, p.rang ?? 0), 0)

    const pretsCrees: ImportSimulationPretCree[] = []

    for (let i = 0; i < prets.length; i++) {
      const p = prets[i] as Record<string, unknown>
      const typeRaw = str(p.type, 'amortissable').toLowerCase()
      const type = VALID_TYPES.has(typeRaw) ? typeRaw : 'amortissable'

      const profilRaw = str(p.profilAmortissement, 'standard').toLowerCase()
      const profilAmortissement = VALID_PROFILS.has(profilRaw) ? profilRaw : 'standard'

      const garantieRaw = str(p.garantieType, '').toLowerCase()
      const garantieType = garantieRaw && VALID_GARANTIES.has(garantieRaw) ? garantieRaw : null

      const rang = num(p.rang, baseRang + i + 1) || (baseRang + i + 1)

      const [inserted] = await db.insert(schema.prets).values({
        dossierId,
        rang,
        libelle: str(p.libelle) || `Prêt ${type} #${rang}`,
        type,
        profilAmortissement,
        banque: str(p.banque) || banquePortante || null,
        montant: Math.round(num(p.montant)),
        dureeMois: Math.round(num(p.dureeMois, 240)) || 240,
        tauxNominal: num(p.tauxNominal),
        tauxAssurance: num(p.tauxAssurance),
        mensualiteHorsAssurance: Math.round(num(p.mensualiteHorsAssurance)),
        mensualiteTotale: Math.round(num(p.mensualiteTotale)),
        differeAmortissement: Math.round(num(p.differeAmortissement)),
        differeTotal: Math.round(num(p.differeTotal)),
        garantieType,
        garantieMontant: Math.round(num(p.garantieMontant)),
        fraisDossier: Math.round(num(p.fraisDossier)),
        fraisBanque: Math.round(num(p.fraisBanque)),
        commission: Math.round(num(p.commission)),
        statut: 'propose',
        sollicite: true,
        commissionnable: type !== 'ptz' && type !== 'epargne_logement',
        assurances: [],
        paliers: [],
      } as never).returning()

      if (inserted) {
        pretsCrees.push({
          id: inserted.id,
          rang: inserted.rang ?? rang,
          type: inserted.type,
          libelle: inserted.libelle,
          montant: inserted.montant ?? 0,
          tauxNominal: inserted.tauxNominal ?? null,
          dureeMois: inserted.dureeMois ?? 240,
        })
      }
    }

    return {
      status: 'completed',
      dossierId,
      banquePortante,
      pretsCrees,
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
