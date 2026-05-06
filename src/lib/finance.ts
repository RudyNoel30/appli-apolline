/**
 * Calculs financiers Apolline — partagés entre PretEditor, TabFinancement,
 * skill IA, etc. pour rester cohérents.
 *
 * Conventions :
 *  - Tous les taux en % décimal (ex: 3.4 pour 3,4 %)
 *  - Toutes les durées en mois
 *  - Tous les montants en EUR (entiers, pas centimes ici — convention front)
 */
import type { Pret } from '@/data/mock'

/**
 * Mensualité d'amortissement classique (formule constante).
 * Si i = 0 (PTZ), retombe sur un amortissement linéaire montant / durée.
 */
export function calcMensualite(montant: number, tauxAnnuelPct: number, dureeMois: number): number {
  if (montant <= 0 || dureeMois <= 0) return 0
  const i = (tauxAnnuelPct / 100) / 12
  if (i === 0) return Math.round(montant / dureeMois)
  const m = (montant * i) / (1 - Math.pow(1 + i, -dureeMois))
  return Math.round(m)
}

/**
 * Mensualité d'assurance ADI sur capital initial (convention française usuelle).
 */
export function calcMensualiteAssurance(montant: number, tauxAssurancePct: number, _dureeMois: number): number {
  if (!tauxAssurancePct) return 0
  return Math.round((montant * (tauxAssurancePct / 100)) / 12)
}

/**
 * Mensualité totale d'un prêt — utilise les valeurs stockées SI elles
 * correspondent aux paramètres actuels (à 2€ près), sinon recalcule.
 *
 * Évite les valeurs obsolètes quand l'utilisateur a modifié montant/taux/durée
 * sans repasser par l'éditeur (ex : édition via DossierEditor, ou ancienne saisie).
 */
export function effectiveMensualite(pret: Pret): {
  horsAssurance: number
  assurance: number
  totale: number
  isStored: boolean
} {
  const montant = pret.montant ?? 0
  const tx = pret.tauxNominal ?? 0
  const txA = pret.tauxAssurance ?? 0
  const dur = pret.dureeMois ?? 0

  const calcHA = calcMensualite(montant, tx, dur)
  const calcAss = calcMensualiteAssurance(montant, txA, dur)

  const storedHA = pret.mensualiteHorsAssurance
  const storedAss = pret.mensualiteAssurance

  // Si la valeur stockée est cohérente avec le calcul (à 2€ près) → on l'utilise telle quelle
  // Si elle diverge significativement → c'est probablement obsolète (le user a modifié
  // les paramètres sans recalcul) OU c'est une override manuelle volontaire.
  // On préfère la cohérence : on recalcule.
  // CAS D'OVERRIDE MANUEL : il faudra un flag explicite côté BDD pour distinguer
  // (à ajouter en v0.1.68 si besoin métier).
  const useStoredHA = storedHA != null && montant > 0 && Math.abs(storedHA - calcHA) <= 2
  const useStoredAss = storedAss != null && montant > 0 && Math.abs(storedAss - calcAss) <= 2

  const horsAssurance = useStoredHA ? storedHA! : calcHA
  const assurance = useStoredAss ? storedAss! : calcAss
  const isStored = useStoredHA && useStoredAss

  return { horsAssurance, assurance, totale: horsAssurance + assurance, isStored }
}
