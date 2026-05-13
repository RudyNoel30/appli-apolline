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

// ─────────────────────────────────────────────────────────────────────────────
// FRAIS DE NOTAIRE — calcul officiel français (Code de commerce art. R 444-x)
// ─────────────────────────────────────────────────────────────────────────────
//
// 4 composantes :
//   1. Émoluments proportionnels du notaire (HT, barème dégressif 4 tranches)
//      + TVA 20 % + remise loi Macron optionnelle (jusqu'à 20 % au-delà de 100k€)
//   2. Droits de mutation à titre onéreux (DMTO) :
//      - Ancien : 5,80 % (standard) ou 4,50 % dans 4 départements (Indre, Isère,
//        Mayotte, Morbihan — ces dépts n'ont pas relevé le taux en 2014)
//      - Neuf / VEFA : 0,715 % (taxe de publicité foncière, TVA déjà incluse
//        dans le prix promoteur)
//   3. Contribution de sécurité immobilière (CSI) : 0,10 % du prix
//   4. Débours et formalités : forfait ~1 200 € (cadastre, urbanisme, état civil…)
//
// Ratio total typique :
//   - Ancien départements standard : ~7,5 à 8 % du prix
//   - Ancien départements à 4,5 % : ~6 % du prix
//   - Neuf / VEFA : ~2,5 à 3 % du prix
//
// Source : Code de commerce R 444-x (barème reconduit 2026-2028 à l'identique
// du 2021-2022), Conseil supérieur du notariat, ANIL.
// ─────────────────────────────────────────────────────────────────────────────

export type NatureBienNotaire = 'ancien' | 'neuf' | 'vefa' | 'terrain'

/** Départements où le taux DMTO ancien est réduit à 4,50 % (non hausse 2014) */
const DEPARTEMENTS_DMTO_REDUIT = new Set(['36', '38', '976', '56'])
//                                 Indre, Isère, Mayotte, Morbihan

/**
 * Émoluments PROPORTIONNELS du notaire (HT) selon le barème national pour
 * mutation à titre onéreux (vente immobilière). 4 tranches dégressives.
 *
 * Source : Code de commerce art. A 444-91 — barème actes de vente.
 */
function emolumentsProportionnels(prix: number): number {
  if (prix <= 0) return 0
  const t1 = Math.min(prix, 6_500) * 0.03870
  const t2 = Math.max(0, Math.min(prix, 17_000) - 6_500) * 0.01596
  const t3 = Math.max(0, Math.min(prix, 60_000) - 17_000) * 0.01064
  const t4 = Math.max(0, prix - 60_000) * 0.00799
  return t1 + t2 + t3 + t4
}

export type FraisNotaireOptions = {
  /** Département du bien (code INSEE 2 ou 3 chiffres). Utilisé pour DMTO ancien
   *  (4 départements à 4,5 % : 36, 38, 976, 56). Défaut : 5,80 %. */
  departement?: string
  /** Appliquer la remise loi Macron (20 % sur la part émoluments > 100 000 €).
   *  Faculté du notaire — par défaut on ne l'applique PAS pour rester conservateur
   *  côté présentation client. */
  remiseMacron?: boolean
}

export type FraisNotaireDetail = {
  /** Émoluments du notaire (TTC, après remise Macron éventuelle) */
  emoluments: number
  /** Droits de mutation à titre onéreux (DMTO) */
  dmto: number
  /** Contribution de sécurité immobilière */
  csi: number
  /** Débours et formalités */
  debours: number
  /** Total = somme des 4 composantes */
  total: number
  /** Taux DMTO appliqué (0,058 ou 0,045 ou 0,00715) — pour transparence affichage */
  tauxDmtoAppli: number
  /** Pourcentage total / prix d'achat (pour comparaison rapide) */
  ratioPrix: number
}

/**
 * Calcule les frais de notaire détaillés (composante par composante).
 *
 * @param prix Prix d'acquisition du bien (assiette = montant brut hors travaux/mobilier)
 * @param nature 'ancien' | 'neuf' | 'vefa' | 'terrain'
 * @param opts Options (département pour DMTO réduit, remise Macron)
 */
export function calcFraisNotaireDetail(
  prix: number,
  nature: NatureBienNotaire,
  opts: FraisNotaireOptions = {},
): FraisNotaireDetail {
  if (prix <= 0) {
    return {
      emoluments: 0, dmto: 0, csi: 0, debours: 0, total: 0,
      tauxDmtoAppli: 0, ratioPrix: 0,
    }
  }

  // 1. Émoluments du notaire (HT) + TVA 20 %
  let emolumentsHT = emolumentsProportionnels(prix)

  // Remise loi Macron : -20 % sur la part au-delà de 100 000 € (taux 0,799 %)
  // → équivalent à appliquer 0,799 × 0,80 = 0,6392 % sur cette tranche
  if (opts.remiseMacron && prix > 100_000) {
    const partAuDessus100k = prix - 100_000
    const emolumentsT4Sans = partAuDessus100k * 0.00799
    const emolumentsT4Avec = partAuDessus100k * 0.00799 * 0.80  // -20 %
    emolumentsHT = emolumentsHT - emolumentsT4Sans + emolumentsT4Avec
  }
  const emoluments = emolumentsHT * 1.20  // TVA 20 %

  // 2. DMTO selon nature + département
  let tauxDmtoAppli: number
  if (nature === 'neuf' || nature === 'vefa') {
    tauxDmtoAppli = 0.00715  // taxe publicité foncière (TVA déjà payée)
  } else {
    // 'ancien' ou 'terrain' : DMTO 5,80 % standard, ou 4,50 % dans 4 départements
    const dep = opts.departement?.trim() ?? ''
    tauxDmtoAppli = DEPARTEMENTS_DMTO_REDUIT.has(dep) ? 0.0450 : 0.0580
  }
  const dmto = prix * tauxDmtoAppli

  // 3. CSI — 0,10 % du prix
  const csi = prix * 0.0010

  // 4. Débours et formalités — forfait
  const debours = 1_200

  const total = Math.round(emoluments + dmto + csi + debours)
  return {
    emoluments: Math.round(emoluments),
    dmto: Math.round(dmto),
    csi: Math.round(csi),
    debours,
    total,
    tauxDmtoAppli,
    ratioPrix: total / prix,
  }
}

/**
 * Wrapper simple : retourne juste le total en €.
 * Pour la décomposition (émoluments/DMTO/CSI/débours), utilise calcFraisNotaireDetail.
 */
export function calcFraisNotaire(
  prix: number,
  nature: NatureBienNotaire,
  opts: FraisNotaireOptions = {},
): number {
  return calcFraisNotaireDetail(prix, nature, opts).total
}

/**
 * Estime les frais de notaire à partir du `typeAchat` Apolline (FR libellé).
 * Wrapper qui mappe TypeAchat → NatureBienNotaire et accepte le département.
 *
 * Retourne null si pas calculable (prix à 0 ou typeAchat inconnu).
 */
export function calcFraisNotaireFromTypeAchat(
  prix: number,
  typeAchat: string | undefined | null,
  opts: FraisNotaireOptions = {},
): number | null {
  if (prix <= 0) return null
  const t = (typeAchat ?? '').toLowerCase()
  let nature: NatureBienNotaire
  if (t === 'neuf') nature = 'neuf'
  else if (t === 'vefa') nature = 'vefa'
  else if (t === 'terrain') nature = 'terrain'
  else if (t === 'ancien' || t === 'rachat' || t === 'travaux' || t === 'construction') nature = 'ancien'
  else return null
  return calcFraisNotaire(prix, nature, opts)
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
