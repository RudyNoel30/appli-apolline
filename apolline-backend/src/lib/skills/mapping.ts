/**
 * Mapping skill → modèle Anthropic.
 *
 * Sonnet pour les skills complexes (génération HTML/PDF banque-grade).
 * Haiku pour les skills simples (étude client, simulation).
 *
 * Override possible via env var ANTHROPIC_MODEL_<SKILL_UPPERCASE_UNDERSCORE>.
 * Ex : `ANTHROPIC_MODEL_DDP_PDF=claude-3-opus-...`
 */

export type SkillTier = 'sonnet' | 'haiku' | 'opus'

const DEFAULT_MAPPING: Record<string, SkillTier> = {
  // Skills complexes : qualité bancaire critique → Sonnet
  'ddp-pdf': 'sonnet',
  'dossier-html': 'sonnet',
  'dossier-html-pro': 'sonnet',
  'dossier-html-dvf': 'sonnet',

  // Skills moyens : extraction de données structurées → Sonnet (le contexte est délicat)
  'dossier-extract': 'sonnet',
  'dossier-extract-dvf': 'sonnet',
  'dossier-extract-simulation': 'sonnet',

  // Skills simples : génération HTML court / classement / Excel → Haiku
  'dossier-r1-etude-client': 'haiku',
  'dossier-html-simulation': 'haiku',
  'dossier-rename': 'haiku',
  'extract-g-support': 'haiku',
}

const TIER_TO_MODEL: Record<SkillTier, string> = {
  sonnet: process.env.ANTHROPIC_MODEL_SONNET ?? 'claude-sonnet-4-5-20250929',
  haiku: process.env.ANTHROPIC_MODEL_HAIKU ?? 'claude-haiku-4-5-20251015',
  opus: process.env.ANTHROPIC_MODEL_OPUS ?? 'claude-opus-4-5-20251030',
}

/**
 * Retourne le nom de modèle Anthropic à utiliser pour un skill donné.
 * Précédence : env var spécifique > mapping default > Sonnet.
 */
export function modelForSkill(skillName: string): string {
  // Env var override : ANTHROPIC_MODEL_DOSSIER_HTML_PRO=claude-3-opus-...
  const envKey = `ANTHROPIC_MODEL_${skillName.toUpperCase().replace(/-/g, '_')}`
  const envModel = process.env[envKey]
  if (envModel) return envModel

  const tier = DEFAULT_MAPPING[skillName] ?? 'sonnet'
  return TIER_TO_MODEL[tier]
}

export function tierForSkill(skillName: string): SkillTier {
  return DEFAULT_MAPPING[skillName] ?? 'sonnet'
}
