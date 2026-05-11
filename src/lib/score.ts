/**
 * Calcule le score de confiance d'un dossier sur 100, à partir de son état.
 *
 * Cinq critères pondérés :
 *  - 25 pts : pièces fournies / total
 *  - 25 pts : conformité HCSF (LTV ≤ 100 %, durée ≤ 25 ans, endettement ≤ 35 %)
 *  - 20 pts : LTV (≤80 % = max, dégradation linéaire jusqu'à 100 % = 0)
 *  - 15 pts : ratio mensualités/revenus (≤30 % = max, ≤35 % = mid, sinon 0)
 *  - 15 pts : informations dossier renseignées (emprunteur, projet…)
 *
 * Le score n'est PAS persisté en BDD — il est recalculé à chaque rendu pour
 * refléter l'état courant du dossier (pièces ajoutées, patch HCSF, etc.).
 *
 * Les overrides `live` permettent de passer des valeurs calculées en temps
 * réel depuis le store (prêts, pièces uploadées) plutôt que les champs
 * stockés du dossier qui peuvent être obsolètes (snapshot lors de la création).
 */
import type { Dossier } from '@/data/mock'

export type LiveScoreOverrides = {
  /** LTV courant : totalEmprunte / montantBien — typiquement recalculé depuis les prêts du store */
  ltv?: number
  /** Nombre de pièces réellement uploadées (depuis l'API/backend) */
  piecesFournies?: number
  /** Nombre de pièces attendues (depuis la convention métier P1-P5) */
  piecesTotal?: number
  /** Statut HCSF calculé en live (taux endettement ≤ 35 %, durée ≤ 25 ans) */
  hcsfOk?: boolean
  /** Ratio mensualité / revenu mensuel net du foyer (0-1) — pour le critère endettement */
  ratioMensualiteRevenus?: number
}

export function computeScoreConfiance(dossier: Dossier, live?: LiveScoreOverrides): number {
  let score = 0

  // 1) Pièces fournies (25 pts) — priorité aux valeurs live
  const piecesTotal = live?.piecesTotal ?? dossier.piecesTotal
  const piecesFournies = live?.piecesFournies ?? dossier.piecesFournies
  if (piecesTotal > 0) {
    score += Math.round(25 * Math.min(1, piecesFournies / piecesTotal))
  }

  // 2) HCSF (25 pts)
  const hcsfOk = live?.hcsfOk ?? dossier.hcsfOk
  if (hcsfOk) score += 25

  // 3) LTV (20 pts)
  // ≤ 80 % : 20 pts ; 100 % : 0 pt ; au-delà : 0
  const ltv = live?.ltv ?? dossier.ltv ?? 0
  if (ltv <= 0.8) score += 20
  else if (ltv <= 1.0) score += Math.round(20 * (1 - (ltv - 0.8) / 0.2))

  // 4) Endettement après projet (15 pts)
  // Si on a un ratio mensualité/revenus calculé en live → gradient propre.
  // Sinon, fallback sur la présence d'une alerte "endettement" dans dossier.alertes.
  if (live?.ratioMensualiteRevenus != null) {
    const r = live.ratioMensualiteRevenus
    if (r <= 0.30) score += 15
    else if (r <= 0.35) score += 10
    else if (r <= 0.40) score += 5
    // au-delà de 40 % : 0 pt
  } else {
    const aHcsfAlert = (dossier.alertes ?? []).some((a) => /hcsf|endett/i.test(a))
    if (!aHcsfAlert && hcsfOk) score += 15
    else if (!aHcsfAlert) score += 8
  }

  // 5) Complétude des infos dossier (15 pts)
  let infoPts = 0
  if (dossier.villeBien) infoPts += 3
  if (dossier.montantPret > 0) infoPts += 3
  if (dossier.dureeMois > 0) infoPts += 2
  if (dossier.emprunteur1) infoPts += 4
  if (dossier.r1Date) infoPts += 3
  score += Math.min(15, infoPts)

  return Math.max(0, Math.min(100, score))
}
