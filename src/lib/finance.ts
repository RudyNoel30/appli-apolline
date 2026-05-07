/**
 * Calculs financiers Apolline — partagés entre PretEditor, TabFinancement,
 * skill IA, etc. pour rester cohérents.
 *
 * Conventions :
 *  - Tous les taux en % décimal (ex: 3.4 pour 3,4 %)
 *  - Toutes les durées en mois
 *  - Tous les montants en EUR (entiers, pas centimes ici — convention front)
 *
 * Définitions juridiques (art. R.314-2 et suivants du Code de la consommation) :
 *  - TAEG = Taux Annuel Effectif Global : intègre intérêts + frais initiaux
 *    obligatoires (dossier, garantie, expertise…) — HORS assurance non obligatoire.
 *  - TAEA = Taux Annuel Effectif d'Assurance : différentiel entre TAEG avec et
 *    sans assurance, exprimé en taux annuel équivalent.
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
 * TAEG — Taux Annuel Effectif Global (méthode actuarielle conforme art. R.314-3 CCons.).
 *
 * Résout numériquement l'équation : capital_emprunte = Σ mensualité_i / (1+TAEG_mensuel)^i
 * où capital_emprunte = montant brut MOINS les frais initiaux (dossier + garantie +
 * éventuels frais bancaires). Bisection pour trouver le taux mensuel.
 *
 * Si tauxNominal = 0 (PTZ) et pas de frais → TAEG = 0.
 * Si frais > 0 même sans intérêts → TAEG > 0 (les frais ramènent le capital effectif).
 */
export function calcTAEG(
  montant: number,
  mensualiteHorsAssurance: number,
  dureeMois: number,
  fraisInitiaux: number,
): number {
  if (montant <= 0 || dureeMois <= 0 || mensualiteHorsAssurance <= 0) return 0
  const capitalEffectif = montant - fraisInitiaux
  if (capitalEffectif <= 0) return 0

  // Newton-Raphson sur le taux mensuel i :
  // f(i) = mensualité * (1 - (1+i)^-n) / i - capital_effectif = 0
  // Initialise i avec le taux nominal /12, ajuste itérativement.
  // Borne : [0, 1] (= 0 % à 100 % mensuel = 1200 % annuel — large)
  let lo = 0
  let hi = 1
  let iMonthly = 0
  for (let iter = 0; iter < 100; iter++) {
    iMonthly = (lo + hi) / 2
    let pv: number
    if (iMonthly < 1e-9) {
      pv = mensualiteHorsAssurance * dureeMois
    } else {
      pv = mensualiteHorsAssurance * (1 - Math.pow(1 + iMonthly, -dureeMois)) / iMonthly
    }
    if (Math.abs(pv - capitalEffectif) < 0.01) break
    if (pv > capitalEffectif) lo = iMonthly
    else hi = iMonthly
  }
  // TAEG annuel = (1 + i_mensuel)^12 - 1 (capitalisation composée)
  return (Math.pow(1 + iMonthly, 12) - 1) * 100
}

/**
 * TAEA — Taux Annuel Effectif d'Assurance.
 *
 * Approximation usuelle conforme à l'arrêté du 17 juin 2014 :
 * différentiel entre TAEG avec assurance (= mensualité totale) et TAEG hors assurance.
 *
 * Plus simple : TAEA ≈ taux d'assurance annuel sur capital initial,
 * mais l'arrêté impose le calcul actuariel exact.
 */
export function calcTAEA(
  montant: number,
  mensualiteHorsAssurance: number,
  mensualiteAssurance: number,
  dureeMois: number,
  fraisInitiaux: number,
): number {
  if (mensualiteAssurance <= 0) return 0
  const taegSansAss = calcTAEG(montant, mensualiteHorsAssurance, dureeMois, fraisInitiaux)
  const taegAvecAss = calcTAEG(montant, mensualiteHorsAssurance + mensualiteAssurance, dureeMois, fraisInitiaux)
  return Math.max(0, taegAvecAss - taegSansAss)
}

/**
 * Frais initiaux totaux à intégrer au TAEG (article R.314-4 CCons.).
 * Inclut frais dossier, frais bancaires, garantie. EXCLUT l'assurance facultative.
 */
export function fraisInitiauxTAEG(pret: Pret): number {
  return (pret.fraisDossier ?? 0) + (pret.fraisBanque ?? 0) + (pret.garantieMontant ?? 0)
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
