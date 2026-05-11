/**
 * Moteur d'extraction OCR + structuration via Claude Vision.
 *
 * Pipeline :
 *  1. Lecture du fichier (image ou PDF) depuis le filesystem du VPS
 *  2. Si type non fourni → classification automatique via PROMPT_CLASSIFY
 *  3. Extraction structurée selon le type → JSON conforme au schéma
 *  4. Renvoi du JSON parsé + confidence + métriques d'usage
 *
 * Claude 4.5/4.6/4.7 supportent les images (jpeg/png/gif/webp) en input.
 * Les PDFs sont supportés via le content block "document" (1 PDF par message).
 */
import Anthropic from '@anthropic-ai/sdk'
import { promises as fs } from 'node:fs'
import { pathFor } from '../pieces-storage.js'
import { EXTRACTION_PROMPTS, PROMPT_CLASSIFY, type ExtractionType } from './prompts.js'

const apiKey = process.env.ANTHROPIC_API_KEY
const client = apiKey ? new Anthropic({ apiKey }) : null

// Sonnet 4.6 / 4.7 = bon équilibre coût/qualité pour la vision
const EXTRACTION_MODEL = process.env.ANTHROPIC_MODEL_EXTRACTION
  ?? process.env.ANTHROPIC_MODEL_SONNET
  ?? 'claude-sonnet-4-6'

// Limite la complétion à ~6k tokens (largement suffisant pour un JSON structuré)
const MAX_TOKENS = 6_000

export type ExtractionResult = {
  type: ExtractionType
  status: 'completed' | 'failed'
  data: Record<string, unknown> | null
  confidence: number  // 0.0 - 1.0
  error?: string
  usage: {
    inputTokens: number
    outputTokens: number
    estimatedCostEur: number
  }
}

// Tarifs Sonnet en EUR/1M tokens (approx USD→EUR ~0.95)
const PRICING = { input: 2.85, output: 14.25 }

function estimateCost(usage: { input_tokens: number; output_tokens: number }): number {
  const inK = usage.input_tokens / 1_000_000
  const outK = usage.output_tokens / 1_000_000
  return Number((inK * PRICING.input + outK * PRICING.output).toFixed(4))
}

/** Force un MIME image PNG/JPEG/WEBP/GIF (cf. limitation Anthropic Vision). */
function normalizeImageMime(mime: string): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  const m = mime.toLowerCase()
  if (m === 'image/jpg' || m === 'image/jpeg') return 'image/jpeg'
  if (m === 'image/png') return 'image/png'
  if (m === 'image/gif') return 'image/gif'
  if (m === 'image/webp') return 'image/webp'
  // Default safe fallback — Claude rejettera si vraiment invalide
  return 'image/jpeg'
}

/** Construit le content block selon le mime du fichier (image ou PDF). */
async function buildSourceBlock(
  dossierId: string,
  pieceId: string,
  mimeType: string,
): Promise<
  | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'; data: string } }
  | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }
> {
  const buffer = await fs.readFile(pathFor(dossierId, pieceId))
  const base64 = buffer.toString('base64')
  if (mimeType === 'application/pdf') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
  }
  if (mimeType.startsWith('image/')) {
    return { type: 'image', source: { type: 'base64', media_type: normalizeImageMime(mimeType), data: base64 } }
  }
  throw new Error(`Type MIME non supporté pour extraction : ${mimeType}`)
}

/** Extrait le premier objet JSON présent dans une chaîne (tolère un éventuel préambule). */
function parseJsonLenient(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  // Cas idéal : la sortie commence direct par {
  if (trimmed.startsWith('{')) {
    try { return JSON.parse(trimmed) as Record<string, unknown> } catch { /* fallthrough */ }
  }
  // Sinon, on cherche le premier { et le dernier } équilibré (heuristique)
  const first = trimmed.indexOf('{')
  const last = trimmed.lastIndexOf('}')
  if (first >= 0 && last > first) {
    try { return JSON.parse(trimmed.slice(first, last + 1)) as Record<string, unknown> } catch { /* swallow */ }
  }
  return null
}

/**
 * Classifie un document inconnu en appelant Claude avec PROMPT_CLASSIFY.
 * Retourne le type détecté + confidence. Si Claude ne reconnaît rien → 'autre'.
 */
export async function classifyDocument(
  dossierId: string,
  pieceId: string,
  mimeType: string,
): Promise<{ type: ExtractionType; confidence: number; reason: string }> {
  if (!client) throw new Error('ANTHROPIC_API_KEY non configurée')

  const sourceBlock = await buildSourceBlock(dossierId, pieceId, mimeType)
  const res = await client.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 200,
    system: PROMPT_CLASSIFY,
    messages: [
      {
        role: 'user',
        content: [sourceBlock, { type: 'text', text: 'Classe ce document.' }],
      } as unknown as Anthropic.MessageParam,  // SDK type lag sur document block
    ],
  })
  const block = res.content[0]
  const text = block && block.type === 'text' ? block.text : ''
  const json = parseJsonLenient(text)
  if (!json || typeof json.type !== 'string') {
    return { type: 'autre', confidence: 0, reason: 'classification échouée' }
  }
  const VALID_TYPES: ExtractionType[] = [
    'bulletin_salaire', 'avis_imposition', 'rib', 'cni',
    'justif_domicile', 'compromis', 'dpe', 'autre',
  ]
  const t = VALID_TYPES.includes(json.type as ExtractionType) ? json.type as ExtractionType : 'autre'
  const confidence = typeof json.confidence === 'number' ? Math.max(0, Math.min(1, json.confidence)) : 0
  const reason = typeof json.raison === 'string' ? json.raison : ''
  return { type: t, confidence, reason }
}

/**
 * Extrait les données structurées d'un document de type connu.
 * Utilise le prompt dédié pour ce type. Retourne le JSON + confidence + usage.
 */
export async function extractDocument(
  dossierId: string,
  pieceId: string,
  mimeType: string,
  type: ExtractionType,
): Promise<ExtractionResult> {
  if (!client) {
    return {
      type, status: 'failed', data: null, confidence: 0,
      error: 'ANTHROPIC_API_KEY non configurée',
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostEur: 0 },
    }
  }

  const prompt = EXTRACTION_PROMPTS[type]
  if (!prompt) {
    return {
      type, status: 'failed', data: null, confidence: 0,
      error: `Extraction pas implémentée pour le type "${type}"`,
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostEur: 0 },
    }
  }

  try {
    const sourceBlock = await buildSourceBlock(dossierId, pieceId, mimeType)
    const res = await client.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: MAX_TOKENS,
      system: prompt,
      messages: [
        {
          role: 'user',
          content: [sourceBlock, { type: 'text', text: 'Extrais ce document selon le schéma JSON.' }],
        } as unknown as Anthropic.MessageParam,
      ],
    })

    const block = res.content[0]
    const text = block && block.type === 'text' ? block.text : ''
    const json = parseJsonLenient(text)

    if (!json) {
      return {
        type, status: 'failed', data: null, confidence: 0,
        error: 'sortie Claude non parsable en JSON',
        usage: {
          inputTokens: res.usage.input_tokens,
          outputTokens: res.usage.output_tokens,
          estimatedCostEur: estimateCost(res.usage),
        },
      }
    }

    // Si Claude a retourné { error: "not_a_xxx" } → on remonte l'erreur
    if (typeof json.error === 'string') {
      return {
        type, status: 'failed', data: null, confidence: 0,
        error: `Document non reconnu : ${json.error}`,
        usage: {
          inputTokens: res.usage.input_tokens,
          outputTokens: res.usage.output_tokens,
          estimatedCostEur: estimateCost(res.usage),
        },
      }
    }

    // Récupère la confidence globale du JSON (chaque prompt en met une dans confidence.global)
    const conf = json.confidence as Record<string, unknown> | undefined
    const globalConf = conf && typeof conf.global === 'number'
      ? Math.max(0, Math.min(1, conf.global as number))
      : 0.7  // valeur par défaut si Claude oublie de la mettre

    return {
      type,
      status: 'completed',
      data: json,
      confidence: globalConf,
      usage: {
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
        estimatedCostEur: estimateCost(res.usage),
      },
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      type, status: 'failed', data: null, confidence: 0,
      error: msg,
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostEur: 0 },
    }
  }
}

export function isExtractionAvailable(): boolean {
  return client !== null
}
