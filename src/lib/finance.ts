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
import type { Pret, PretPalier } from '@/data/mock'

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

// ─────────────────────────────────────────────────────────────────────────────
// LISSAGE — Calcul automatique des paliers du prêt lisseur
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Identifie le prêt "lisseur" parmi un montage : le candidat idéal pour porter
 * les paliers. Critères :
 *  1. Profil 'paliers_lissage' explicitement marqué → prioritaire
 *  2. Type 'lissage' dédié
 *  3. Sinon : le prêt amortissable le plus long
 *
 * Retourne null si pas de candidat (ex: que des PTZ ou un seul prêt).
 */
export function findPretLisseur(prets: Pret[]): Pret | null {
  if (prets.length < 2) return null

  // Priorité 1 : profil paliers_lissage
  const explicit = prets.find((p) => p.profilAmortissement === 'paliers_lissage')
  if (explicit) return explicit

  // Priorité 2 : type lissage
  const lissage = prets.find((p) => p.type === 'lissage')
  if (lissage) return lissage

  // Priorité 3 : le plus long amortissable
  const amort = prets.filter((p) => p.type === 'amortissable')
  if (amort.length > 0) {
    return amort.reduce((longest, p) => p.dureeMois > longest.dureeMois ? p : longest)
  }

  return null
}

/**
 * Calcule la mensualité hors assurance d'un autre prêt à un mois donné.
 * Sert à déterminer ce que les autres prêts vont "manger" du quota total.
 */
function mensHaAtMonth(p: Pret, mois: number): number {
  if (mois >= p.dureeMois) return 0
  const differeT = p.differeTotal ?? 0
  if (mois < differeT) return 0
  // Mensualité standard (hors paliers — pour les prêts non-lisseurs)
  if (p.mensualiteHorsAssurance != null && p.mensualiteHorsAssurance > 0) {
    return p.mensualiteHorsAssurance
  }
  // Calcul à la volée si pas stocké
  return calcMensualite(p.montant, p.tauxNominal ?? 0, p.dureeMois - differeT)
}

/**
 * Optimisation du plan : calcule les paliers du prêt lisseur pour qu'avec
 * les autres prêts, la mensualité TOTALE hors assurance reste **constante**.
 *
 * Algorithme :
 *  1. Identifie les "cassures" (mois où une mensualité d'autre prêt change :
 *     fin d'un prêt, fin d'un différé, début d'un palier d'un autre lisseur).
 *  2. Découpe le calendrier du lisseur en segments entre ces cassures.
 *  3. Pour chaque segment, calcule la mensualité hors assurance du lisseur
 *     telle que TOTAL = cible.
 *  4. La cible est calculée pour que le lisseur amortisse exactement son
 *     capital sur sa durée totale (recherche par bisection sur la cible).
 *
 * Retourne le tableau de paliers à stocker dans pret.paliers.
 *
 * Si la cible n'est pas atteignable (paliers négatifs), warning + retourne null.
 */
export function optimiserLissage(
  lisseur: Pret,
  autres: Pret[],
): { paliers: PretPalier[]; mensualiteCible: number; warning?: string } | null {
  if (lisseur.dureeMois <= 0 || lisseur.montant <= 0) return null

  const taux = (lisseur.tauxNominal ?? 0) / 100
  const i = taux / 12
  const N = lisseur.dureeMois

  // Cassures = mois où la somme des mensualités des autres prêts change
  const cassures = new Set<number>([0, N])
  for (const p of autres) {
    cassures.add(Math.min(p.dureeMois, N))
    if (p.differeTotal && p.differeTotal > 0) cassures.add(p.differeTotal)
    if (p.differeAmortissement && p.differeAmortissement > 0) cassures.add(p.differeAmortissement)
  }
  const breakpoints = [...cassures].filter((m) => m >= 0 && m <= N).sort((a, b) => a - b)

  // Segments : [start, end), avec la mensualité "autres" constante sur chaque segment
  type Segment = { start: number; end: number; nombreMois: number; mensAutres: number }
  const segments: Segment[] = []
  for (let k = 0; k < breakpoints.length - 1; k++) {
    const start = breakpoints[k]!
    const end = breakpoints[k + 1]!
    if (end <= start) continue
    // Mensualité "autres" sur ce segment (stable par construction)
    const mensAutres = autres.reduce((s, p) => s + mensHaAtMonth(p, start), 0)
    segments.push({ start, end, nombreMois: end - start, mensAutres })
  }

  // Recherche de la mensualité cible TOTALE par bisection :
  // on cherche M_cible tel que les paliers du lisseur amortissent exactement
  // son capital sur sa durée.
  const evaluateCible = (cible: number): number => {
    // Pour chaque segment, mens_lisseur = max(0, cible - mensAutres).
    // KRD évolue : KRD_{k+1} = KRD_k * (1+i)^n - mens_palier * ((1+i)^n - 1) / i
    // (où n = nombreMois du palier)
    let krd = lisseur.montant
    for (const seg of segments) {
      const mensLisseur = Math.max(0, cible - seg.mensAutres)
      const n = seg.nombreMois
      if (i === 0) {
        krd = krd - mensLisseur * n
      } else {
        // KRD final après n mensualités constantes :
        // KRD_n = KRD_0 * (1+i)^n - mens * ((1+i)^n - 1) / i
        const pow = Math.pow(1 + i, n)
        krd = krd * pow - mensLisseur * (pow - 1) / i
      }
    }
    return krd  // 0 si parfait, > 0 si reste à amortir, < 0 si trop amorti
  }

  // Bisection sur cible. Bornes : [mens autres min ... mens autres min + 10× mens classique]
  // Cible min plausible = max(mensAutres) (pour que mens_lisseur ≥ 0)
  const cibleMinPlausible = Math.max(...segments.map((s) => s.mensAutres))
  const mensClassique = calcMensualite(lisseur.montant, lisseur.tauxNominal ?? 0, N)
  let lo = cibleMinPlausible
  let hi = cibleMinPlausible + mensClassique * 3
  let cible = (lo + hi) / 2
  for (let iter = 0; iter < 100; iter++) {
    cible = (lo + hi) / 2
    const reste = evaluateCible(cible)
    if (Math.abs(reste) < 1) break
    if (reste > 0) lo = cible  // pas assez amorti → augmenter cible
    else hi = cible            // trop amorti → diminuer cible
  }

  // Construit les paliers résultants
  const paliers: PretPalier[] = segments.map((seg, idx) => ({
    rang: (idx + 1) as 1 | 2 | 3 | 4 | 5,
    nombreMois: seg.nombreMois,
    echeanceHorsAssurance: Math.round(Math.max(0, cible - seg.mensAutres)),
  })).filter((p) => p.nombreMois > 0)

  // Limite à 5 paliers (contrainte type) — fusionne les segments mineurs si besoin
  const palFinaux = paliers.slice(0, 5).map((p, idx) => ({ ...p, rang: (idx + 1) as 1 | 2 | 3 | 4 | 5 }))

  let warning: string | undefined
  if (palFinaux.some((p) => (p.echeanceHorsAssurance ?? 0) === 0)) {
    warning = 'Au moins un palier a une mensualité de 0 € — le total cible est inférieur à la mensualité des autres prêts sur ce segment.'
  }
  if (palFinaux.length === 0) {
    return null
  }

  return { paliers: palFinaux, mensualiteCible: Math.round(cible), warning }
}

/**
 * Mensualité totale d'un montage à un mois donné — somme de tous les prêts
 * en respectant paliers + différés + amortissement individuel.
 *
 * Utile pour le graphique stacké et les calculs de cohérence.
 */
export function mensualiteTotaleAt(prets: Pret[], mois: number): number {
  return prets.reduce((sum, p) => {
    if (mois >= p.dureeMois) return sum
    const differeT = p.differeTotal ?? 0
    if (mois < differeT) return sum

    // Paliers ?
    if (p.paliers && p.paliers.length > 0) {
      let cumul = differeT
      for (const palier of [...p.paliers].sort((a, b) => a.rang - b.rang)) {
        if (mois < cumul + palier.nombreMois) {
          return sum + (palier.echeanceHorsAssurance ?? 0)
        }
        cumul += palier.nombreMois
      }
      return sum
    }

    // Sinon mensualité fixe
    return sum + mensHaAtMonth(p, mois)
  }, 0)
}
