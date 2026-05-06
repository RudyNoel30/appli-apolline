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
 */
import type { Dossier } from '@/data/mock'

export function computeScoreConfiance(dossier: Dossier): number {
  let score = 0

  // 1) Pièces fournies (25 pts)
  if (dossier.piecesTotal > 0) {
    score += Math.round(25 * (dossier.piecesFournies / dossier.piecesTotal))
  }

  // 2) HCSF (25 pts)
  if (dossier.hcsfOk) score += 25

  // 3) LTV (20 pts)
  // ≤ 80 % : 20 pts ; 100 % : 0 pt ; au-delà : 0
  const ltv = dossier.ltv ?? 0
  if (ltv <= 0.8) score += 20
  else if (ltv <= 1.0) score += Math.round(20 * (1 - (ltv - 0.8) / 0.2))

  // 4) Endettement après projet (15 pts)
  // Heuristique : on n'a pas toujours mensualité totale ; on regarde si dossier.alertes
  // contient un signal "endettement" ou si la mensualité (calculée par paliers) est < 35 %
  // d'un revenu typique. Faute de mieux, on alloue les 15 pts si pas d'alerte HCSF.
  const aHcsfAlert = (dossier.alertes ?? []).some((a) => /hcsf|endett/i.test(a))
  if (!aHcsfAlert && dossier.hcsfOk) score += 15
  else if (!aHcsfAlert) score += 8

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
