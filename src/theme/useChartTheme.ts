/**
 * Hook centralisé pour les couleurs des graphiques Recharts.
 *
 * Pourquoi : Recharts utilise des couleurs via props JSX (`stroke="…"`,
 * `fill="…"`), donc les variables CSS du theme système (`html.theme-graphite`)
 * n'atteignent pas les graphes. Sans ce hook, les couleurs sont hardcodées par
 * composant → 6 fichiers à éditer dès qu'on change une nuance.
 *
 * Ce hook expose une palette qui suit l'état `settings.theme` du store, en
 * RESPECTANT l'identité visuelle Groupe Apolline (navy + gold, jamais de
 * cyan/rose/violet qui casseraient la charte).
 *
 * Conventions :
 *   - `primary` : couleur dominante (souvent ligne principale d'un chart)
 *   - `secondary` : accent (gold en Apolline)
 *   - `text` : libellés axes / légendes / ticks
 *   - `grid` : lignes de quadrillage et bordures discrètes
 *   - `series[]` : palette stable pour les multi-séries (5 couleurs) — utilisée
 *      pour différencier des prêts/banques/catégories au sein d'un même graph.
 *   - `tooltip` : couleur du fond + bordure des tooltips Recharts (le tooltip
 *      par défaut est blanc, à ajuster en mode Sombre).
 */
import { useMemo } from 'react'
import { useStore } from '@/stores/useStore'
import type { Theme } from '@/stores/types'

export type ChartTheme = {
  primary: string
  secondary: string
  text: string
  grid: string
  /** Palette 5 couleurs pour séries multiples (charts empilés, légendes…). */
  series: readonly [string, string, string, string, string]
  tooltip: { bg: string; border: string; text: string }
}

const APOLLINE: ChartTheme = {
  primary: '#0A1F3D',      // navy-900
  secondary: '#C9A961',    // gold-500
  text: '#4F6696',         // navy-500 ish
  grid: '#E3E8F2',         // navy-50
  series: ['#0A1F3D', '#C9A961', '#142B5C', '#92704A', '#2E4779'] as const,
  tooltip: { bg: '#FFFFFF', border: '#E2E8F0', text: '#0A1F3D' },
}

const GRAPHITE: ChartTheme = {
  primary: '#1E293B',      // slate-800
  secondary: '#64748B',    // slate-500 (remplace le gold en mode graphite — pas d'or)
  text: '#475569',         // slate-600
  grid: '#E2E8F0',         // slate-200
  series: ['#1E293B', '#475569', '#64748B', '#94A3B8', '#CBD5E1'] as const,
  tooltip: { bg: '#FFFFFF', border: '#CBD5E1', text: '#1E293B' },
}

const SOMBRE: ChartTheme = {
  primary: '#E5C77B',      // gold éclairci (devient dominant sur fond sombre)
  secondary: '#5B7AB5',    // navy clair (accent, complémentaire au gold)
  text: '#94A3B8',         // slate-400 (lisible sur navy-950)
  grid: '#1E293B',         // slate-800 (grid discrète sur fond noir)
  series: ['#E5C77B', '#5B7AB5', '#92704A', '#3B5380', '#7B8FB8'] as const,
  tooltip: { bg: '#1A1F33', border: '#475569', text: '#F1F5F9' },
}

const PALETTES: Record<Theme, ChartTheme> = {
  apolline: APOLLINE,
  graphite: GRAPHITE,
  sombre: SOMBRE,
}

/**
 * Retourne la palette de couleurs Recharts adaptée au thème courant.
 * Mémoïsé sur `settings.theme` — change uniquement quand l'utilisateur bascule
 * de thème dans Paramètres.
 */
export function useChartTheme(): ChartTheme {
  const theme = useStore((s) => s.settings.theme ?? 'apolline')
  return useMemo(() => PALETTES[theme] ?? APOLLINE, [theme])
}
