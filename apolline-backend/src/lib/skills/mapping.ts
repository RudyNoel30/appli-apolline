/**
 * Mapping skill → modèle Anthropic.
 *
 * Hiérarchie qualité/coût (par 1M tokens) :
 *  - Haiku  ≈ 0.80 €/4.00 €  → skills simples, classement, court
 *  - Sonnet ≈ 2.85 €/14.25 € → skills complexes, génération HTML banque-grade
 *  - Opus   ≈ 14.25 €/71.25 € → skills CRITIQUES (DDP, dossier banquier PRO)
 *
 * Le DDP et le dossier-html-pro sont les LIVRABLES BANQUE — qualité du
 * raisonnement et de la rédaction directement corrélée au taux d'accord.
 * On y consacre Opus, le surcoût (~0.25-0.30 €/doc) est négligeable face
 * à l'enjeu de signature.
 *
 * Override possible via env var ANTHROPIC_MODEL_<SKILL_UPPERCASE_UNDERSCORE>.
 * Ex : `ANTHROPIC_MODEL_DDP_PDF=claude-opus-4-7-20251215`
 */

export type SkillTier = 'sonnet' | 'haiku' | 'opus'

const DEFAULT_MAPPING: Record<string, SkillTier> = {
  // Skills CRITIQUES banque : qualité maximale → Opus
  // (le DDP est le document décisionnel envoyé au banquier ; le dossier-html-pro
  //  traite des projets professionnels où l'analyse bilancielle exige une finesse
  //  particulière sur les SIG, ratios CAF/annuité, secteur d'activité)
  'ddp-pdf': 'opus',
  'dossier-html-pro': 'opus',

  // Skills complexes : qualité bancaire correcte → Sonnet
  'dossier-html': 'sonnet',
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

// Models par défaut — alignés sur la dernière gamme Claude 4.7 dispo
// (override par env var pour suivre les sorties Anthropic au fil de l'eau)
const TIER_TO_MODEL: Record<SkillTier, string> = {
  sonnet: process.env.ANTHROPIC_MODEL_SONNET ?? 'claude-sonnet-4-7-20251215',
  haiku: process.env.ANTHROPIC_MODEL_HAIKU ?? 'claude-haiku-4-5-20251015',
  opus: process.env.ANTHROPIC_MODEL_OPUS ?? 'claude-opus-4-7-20251215',
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
