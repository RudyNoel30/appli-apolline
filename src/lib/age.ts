/**
 * Helpers de calcul d'âge / ancienneté à partir de dates ISO ("YYYY-MM-DD").
 *
 * Utilisés dans DossierEditor et ProspectEditor pour afficher en live
 * l'âge de l'emprunteur (utile pour les taux assurance emprunteur) et
 * l'ancienneté professionnelle (utile pour la solidité du dossier banque).
 */

/**
 * Calcule l'âge à la date du jour à partir d'une date de naissance ISO.
 * Retourne null si la date est vide, mal formée ou dans le futur.
 */
export function ageFromBirthdate(naissance: string | undefined | null): number | null {
  if (!naissance) return null
  const d = new Date(naissance)
  if (isNaN(d.getTime())) return null
  const now = new Date()
  if (d > now) return null
  let years = now.getFullYear() - d.getFullYear()
  const monthDiff = now.getMonth() - d.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d.getDate())) years--
  return years
}

/**
 * Calcule l'ancienneté en années (arrondi inférieur — N ans révolus) à partir
 * d'une date d'embauche ISO. Retourne null si vide / mal formée / dans le futur.
 *
 * Note : pour 11 mois écoulés, retourne 0 (pas encore 1 an d'ancienneté).
 * C'est la convention attendue côté banque (l'année complète n'est validée
 * qu'au passage à la 12e mensualité).
 */
export function anciennetelnYears(dateEmbauche: string | undefined | null): number | null {
  if (!dateEmbauche) return null
  const d = new Date(dateEmbauche)
  if (isNaN(d.getTime())) return null
  const now = new Date()
  if (d > now) return null
  let years = now.getFullYear() - d.getFullYear()
  const monthDiff = now.getMonth() - d.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d.getDate())) years--
  return Math.max(0, years)
}

/**
 * Variante texte "X ans Y mois" pour affichage informatif (vs anciennetelnYears
 * qui retourne juste l'entier prêt à stocker en BDD).
 */
export function anciennetelnLabel(dateEmbauche: string | undefined | null): string | null {
  if (!dateEmbauche) return null
  const d = new Date(dateEmbauche)
  if (isNaN(d.getTime())) return null
  const now = new Date()
  if (d > now) return null
  let years = now.getFullYear() - d.getFullYear()
  let months = now.getMonth() - d.getMonth()
  if (now.getDate() < d.getDate()) months--
  if (months < 0) { years--; months += 12 }
  if (years === 0) return months === 0 ? 'moins d\'1 mois' : `${months} mois`
  if (months === 0) return `${years} an${years > 1 ? 's' : ''}`
  return `${years} an${years > 1 ? 's' : ''} ${months} mois`
}

/**
 * Ancienneté en MOIS TOTAUX depuis une date d'embauche.
 * Convention métier Apolline : stocker l'ancienneté en mois permet de garder
 * la précision pour les CDI <1 an (ex: 4 mois) tout en restant compatible
 * avec les calculs en années (mois / 12).
 *
 * Retourne null si la date est vide/invalide/future. 0 pour < 1 mois.
 */
export function anciennetelnMois(dateEmbauche: string | undefined | null): number | null {
  if (!dateEmbauche) return null
  const d = new Date(dateEmbauche)
  if (isNaN(d.getTime())) return null
  const now = new Date()
  if (d > now) return null
  let years = now.getFullYear() - d.getFullYear()
  let months = now.getMonth() - d.getMonth()
  if (now.getDate() < d.getDate()) months--
  return Math.max(0, years * 12 + months)
}

/**
 * Formate un nombre de MOIS en label lisible "4 mois", "1 an", "1 an 3 mois", "2 ans".
 * Convention métier : ≥ 12 mois on affiche les années (+mois si reste), sinon mois.
 */
export function formatAncienneteMois(totalMois: number | null | undefined): string {
  if (totalMois == null || totalMois <= 0) return '—'
  const years = Math.floor(totalMois / 12)
  const months = totalMois % 12
  if (years === 0) return `${months} mois`
  if (months === 0) return `${years} an${years > 1 ? 's' : ''}`
  return `${years} an${years > 1 ? 's' : ''} ${months} mois`
}
