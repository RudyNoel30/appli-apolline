/**
 * Wrapper Anthropic SDK pour Apolline.
 *
 * - Charge le SKILL.md du skill demandé depuis `apolline-skills/<name>/SKILL.md`
 * - Utilise le modèle approprié (Sonnet pour skills complexes, Haiku pour simples)
 * - Active le prompt caching (cache_control: ephemeral) sur le system prompt
 *   = -90 % de coût dès le 2e appel du même skill (5 min TTL)
 * - Estime le coût en EUR pour audit log
 */
import Anthropic from '@anthropic-ai/sdk'
import { getSkill } from './skills/loader.js'
import { modelForSkill, tierForSkill, type SkillTier } from './skills/mapping.js'

const apiKey = process.env.ANTHROPIC_API_KEY
if (!apiKey) {
  console.warn('[anthropic] ANTHROPIC_API_KEY manquant — les endpoints /api/ai/* renverront 503')
}

const client = apiKey ? new Anthropic({ apiKey }) : null
const DEFAULT_MAX_TOKENS = Number(process.env.ANTHROPIC_MAX_TOKENS ?? '16000')

export type GenerateInput = {
  /** Nom du skill (= nom du dossier dans apolline-skills/) */
  skill: string
  /** Données contextuelles (dossier, client, prêts…) sérialisées en JSON pour le user prompt */
  context: Record<string, unknown>
  /** Instructions complémentaires libres */
  instructions?: string
  /** Override du modèle (sinon mapping par défaut) */
  model?: string
  maxTokens?: number
}

export type GenerateOutput = {
  content: string
  skill: string
  model: string
  tier: SkillTier
  stopReason: string | null
  usage: {
    inputTokens: number
    outputTokens: number
    cacheCreationInputTokens: number
    cacheReadInputTokens: number
    estimatedCostEur: number
  }
}

// Tarifs en EUR/1M tokens (estimation conversion USD→EUR ~0.95)
const PRICING_BY_TIER = {
  sonnet: { input: 2.85, output: 14.25, cacheW: 3.55, cacheR: 0.28 },
  haiku: { input: 0.76, output: 3.80, cacheW: 0.95, cacheR: 0.08 },
  opus: { input: 14.25, output: 71.25, cacheW: 17.80, cacheR: 1.42 },
}

/** Type de sortie attendu d'un skill — détermine le format override injecté dans le préambule. */
type SkillOutputType = 'html' | 'json' | 'text'

/** Mapping skill → type de sortie. Les SKILL.md ne le déclarent pas explicitement, on le sait par convention. */
const SKILL_OUTPUT: Record<string, SkillOutputType> = {
  'ddp-pdf': 'html',
  'dossier-html': 'html',
  'dossier-html-pro': 'html',
  'dossier-html-dvf': 'html',
  'dossier-html-simulation': 'html',
  'dossier-r1-etude-client': 'html',
  'dossier-extract': 'json',
  'dossier-extract-dvf': 'json',
  'dossier-extract-simulation': 'json',
  'dossier-rename': 'text',
  'extract-g-support': 'text',
}

function inferSkillOutputType(skillName: string): SkillOutputType {
  if (SKILL_OUTPUT[skillName]) return SKILL_OUTPUT[skillName]
  // Heuristique sur le nom
  if (skillName.includes('html') || skillName.includes('pdf') || skillName.includes('etude')) return 'html'
  if (skillName.includes('extract')) return 'json'
  return 'text'
}

function formatOverrideFor(type: SkillOutputType): string {
  switch (type) {
    case 'html':
      return `FORMAT DE SORTIE IMPOSÉ : un document HTML COMPLET et autonome.
Ta réponse doit commencer EXACTEMENT par "<!doctype html>" (sans aucun caractère avant) et se terminer par "</html>".
Inclus :
  • <head> avec <meta charset="utf-8">, <title>, et un <style> contenant TOUT le CSS nécessaire (pas de fichiers externes).
  • <body> avec le contenu structuré selon les spécifications du skill.
  • Polices Google Fonts via <link rel="stylesheet"> dans le <head> SI le skill les exige (Playfair Display + Inter habituellement).
  • Aucune image externe, aucune dépendance JS.
  • Le HTML doit être directement imprimable en PDF (page A4, marges raisonnables) via @media print.
INTERDICTIONS ABSOLUES :
  • PAS de markdown autour (pas de \`\`\`html ni \`\`\`).
  • PAS de texte avant <!doctype html> ni après </html>.
  • PAS de commentaire expliquant ce que tu fais.
  • PAS de retour d'erreur structuré JSON — produis le HTML même si les données sont partielles.`
    case 'json':
      return `FORMAT DE SORTIE IMPOSÉ : un objet JSON valide et rien d'autre.
Ta réponse doit commencer EXACTEMENT par "{" et se terminer par "}".
INTERDICTIONS ABSOLUES :
  • PAS de markdown (pas de \`\`\`json ni \`\`\`).
  • PAS de commentaire avant ou après.
  • PAS de texte explicatif.
  • Le JSON doit être strictement parsable par JSON.parse().`
    case 'text':
      return `FORMAT DE SORTIE IMPOSÉ : du texte brut, court, directement utilisable.
INTERDICTIONS ABSOLUES :
  • PAS de markdown (pas de \`\`\`, pas de **, pas de #).
  • PAS de phrase d'introduction ("Voici…", "Le nom proposé est…").
  • PAS de guillemets autour.
  • Réponds UNIQUEMENT avec la valeur demandée par le skill (ex : un nom de dossier, un libellé).`
  }
}

function estimateCostEur(tier: SkillTier, usage: { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null }): number {
  const p = PRICING_BY_TIER[tier]
  const inK = usage.input_tokens / 1_000_000
  const outK = usage.output_tokens / 1_000_000
  const cacheW = (usage.cache_creation_input_tokens ?? 0) / 1_000_000
  const cacheR = (usage.cache_read_input_tokens ?? 0) / 1_000_000
  return inK * p.input + outK * p.output + cacheW * p.cacheW + cacheR * p.cacheR
}

export function isConfigured(): boolean {
  return client !== null
}

export async function generate(input: GenerateInput): Promise<GenerateOutput> {
  if (!client) {
    throw new Error('ANTHROPIC_API_KEY non configurée côté backend.')
  }
  const skill = getSkill(input.skill)
  if (!skill) {
    throw new Error(`Skill "${input.skill}" introuvable dans apolline-skills/. Vérifie qu'il existe un dossier avec un SKILL.md.`)
  }

  const model = input.model ?? modelForSkill(input.skill)
  const tier = tierForSkill(input.skill)

  // Le system prompt est le contenu intégral du SKILL.md (instructions Claude)
  // + un préambule Apolline générique (charte, RGPD) + un OVERRIDE fort sur le format de sortie
  // (les SKILL.md sont rédigés pour un environnement Claude Apps avec Python/Playwright,
  //  ce qui n'est pas notre cas — on est en pur system prompt API).
  const skillType = inferSkillOutputType(input.skill)
  const FORMAT_OVERRIDE = formatOverrideFor(skillType)

  const PREAMBULE = `Tu es l'assistant IA du logiciel Extr'Apol — Groupe Apolline (courtage immobilier IOBSP, Bourgogne-Franche-Comté).

Charte visuelle : navy #0A1F3D + gold #C9A961 + ivory #F8F7F3.
Règles communes : français professionnel, pas de PII sensible exposée (RIB/n° sécu masqués), conformité IOBSP.

────────── OVERRIDE D'ENVIRONNEMENT — LIRE AVANT TOUT ──────────
Tu fonctionnes ICI en mode API "messages" — PAS en environnement Claude Apps.
Conséquences IMPORTANTES qui REMPLACENT toute instruction contraire du SKILL.md ci-dessous :
  • Tu n'as AUCUN accès à Python, pdfplumber, Playwright, Chromium, fichiers, shell.
  • Tu ne peux PAS lire de PDF — les données disponibles sont UNIQUEMENT celles du JSON contextuel fourni dans le message user.
  • Tu ne génères PAS de PNG ni de PDF — tu produis le HTML final directement (le frontend l'affichera ou l'imprimera en PDF).
  • Tu n'écris JAMAIS de procédure, de plan d'exécution, de retour d'erreur structuré JSON expliquant ce qui manque, ni de commentaires sur ce que tu ferais. Tu produis DIRECTEMENT le livrable final.
  • Si certaines données du JSON sont manquantes ou nulles : tu fais avec ce que tu as, en marquant "Non renseigné" ou en omettant la section concernée. Tu NE bloques JAMAIS la génération.

${FORMAT_OVERRIDE}

Tu vas maintenant exécuter le skill "${input.skill}" décrit ci-dessous, en respectant SES SPÉCIFICATIONS DE DESIGN ET DE CONTENU, mais en ignorant toute mention de Python/Playwright/PNG/extraction PDF — tu produis directement le HTML final équivalent.

─────────────────────── SKILL ${input.skill.toUpperCase()} ───────────────────────

`
  const systemPrompt = PREAMBULE + skill.prompt

  // User prompt : contexte JSON + instructions optionnelles
  const userPrompt = `Voici le contexte du dossier (extrait de la base Extr'Apol) :

\`\`\`json
${JSON.stringify(input.context, null, 2)}
\`\`\`

${input.instructions ? `Instructions complémentaires : ${input.instructions}\n\n` : ''}Produis maintenant le livrable du skill "${input.skill}" en respectant le format imposé par l'override d'environnement. **Ta réponse doit être UNIQUEMENT le livrable final**, sans aucun préambule, aucun message, aucun bloc \`\`\` autour.`

  const res = await client.messages.create({
    model,
    max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userPrompt }],
  })

  const block = res.content[0]
  const text = block && block.type === 'text' ? block.text : ''

  return {
    content: text,
    skill: input.skill,
    model: res.model,
    tier,
    stopReason: res.stop_reason,
    usage: {
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
      cacheCreationInputTokens: res.usage.cache_creation_input_tokens ?? 0,
      cacheReadInputTokens: res.usage.cache_read_input_tokens ?? 0,
      estimatedCostEur: Number(estimateCostEur(tier, res.usage).toFixed(4)),
    },
  }
}
