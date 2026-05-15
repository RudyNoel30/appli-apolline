/**
 * PTZ — Réglementation 2024-2027 (décret n°2023-1437 du 30 décembre 2023,
 * arrêté du 28 décembre 2023, modifié par décret 2024-302 du 1er avril 2024).
 *
 * Ce module fournit :
 *   - Les barèmes officiels (plafonds revenus / opération, quotités)
 *   - Une fonction `validatePtz()` qui contrôle l'éligibilité d'un prêt PTZ
 *   - Des helpers pour pré-remplir durée + différé selon la tranche de revenu
 *
 * Sources :
 *   - https://www.service-public.fr/particuliers/vosdroits/F10871
 *   - Arrêté du 28 décembre 2023 (NOR : LOGL2333727A)
 */

export type PtzZone = 'A_bis' | 'A' | 'B1' | 'B2' | 'C'

export const PTZ_ZONES: { value: PtzZone; label: string; description: string }[] = [
  { value: 'A_bis', label: 'A bis', description: 'Paris + 76 communes (zone très tendue)' },
  { value: 'A', label: 'A', description: 'Île-de-France hors A bis, Côte d\'Azur, Genevois français…' },
  { value: 'B1', label: 'B1', description: 'Grandes agglomérations > 250k hab' },
  { value: 'B2', label: 'B2', description: 'Villes moyennes (50k-250k hab)' },
  { value: 'C', label: 'C', description: 'Reste du territoire (zones détendues)' },
]

/** Type de bien éligible au PTZ depuis le 1er avril 2024 */
export type PtzNatureBien = 'neuf_collectif' | 'ancien_avec_travaux' | 'logement_social_acquis'

/**
 * Plafonds de revenus (RFR-N-2) selon zone + nb d'occupants. Tableau officiel 2024.
 * Au-delà de 8 occupants : on extrapole +14 700€/personne (zone A) etc.
 */
const PLAFOND_REVENUS_PAR_ZONE: Record<PtzZone, number[]> = {
  // index = nb occupants - 1 (0 = 1 pers, 1 = 2 pers, ..., 7 = 8+ pers)
  A_bis: [49000, 73500, 88200, 102900, 117600, 132300, 147000, 161700],
  A:     [49000, 73500, 88200, 102900, 117600, 132300, 147000, 161700],
  B1:    [34500, 51750, 62100, 72450, 82800, 93150, 103500, 113850],
  B2:    [31500, 47250, 56700, 66150, 75600, 85050, 94500, 103950],
  C:     [28500, 42750, 51300, 59850, 68400, 76950, 85500, 94050],
}

/** Plafonds de l'opération (coût total bornable) selon zone + nb d'occupants. */
const PLAFOND_OPERATION_PAR_ZONE: Record<PtzZone, number[]> = {
  A_bis: [150000, 225000, 270000, 315000, 360000, 405000, 450000, 495000],
  A:     [150000, 225000, 270000, 315000, 360000, 405000, 450000, 495000],
  B1:    [135000, 202500, 243000, 283500, 324000, 364500, 405000, 445500],
  B2:    [110000, 165000, 198000, 231000, 264000, 297000, 330000, 363000],
  C:     [100000, 150000, 180000, 210000, 240000, 270000, 300000, 330000],
}

/**
 * Tranches de revenus (en TI = Tranche d'Imposition) détermine la quotité
 * et la durée de remboursement. Calculé sur le RFR / coefficient familial.
 *
 * Coefficient familial : 1 pers = 1, 2 pers = 1.4, 3 pers = 1.7, 4 pers = 2,
 *  +0.3 par pers supplémentaire.
 */
const COEFF_FAMILIAL = [1, 1.4, 1.7, 2, 2.3, 2.6, 2.9, 3.2]

/** Tranches RFR pondéré (revenu_total / coefficient) → numéro de tranche 1-4 */
const TRANCHES_RFR: Record<PtzZone, number[]> = {
  // borne supérieure de chaque tranche
  A_bis: [25000, 31000, 37000, 49000],
  A:     [25000, 31000, 37000, 49000],
  B1:    [21500, 26000, 30000, 34500],
  B2:    [18000, 22500, 27000, 31500],
  C:     [15000, 19500, 24000, 28500],
}

/** Quotité PTZ (% du coût opération financé en PTZ) — neuf collectif zones A/B1 */
const QUOTITE_NEUF: Record<PtzZone, number[]> = {
  A_bis: [0.50, 0.40, 0.40, 0.20],
  A:     [0.50, 0.40, 0.40, 0.20],
  B1:    [0.50, 0.40, 0.20, 0.00],
  B2:    [0, 0, 0, 0],   // Plus éligible au neuf depuis avril 2024
  C:     [0, 0, 0, 0],
}

/** Quotité PTZ — ancien avec travaux (zones B2 et C uniquement) */
const QUOTITE_ANCIEN_TRAVAUX: Record<PtzZone, number[]> = {
  A_bis: [0, 0, 0, 0],
  A:     [0, 0, 0, 0],
  B1:    [0, 0, 0, 0],
  B2:    [0.50, 0.40, 0.40, 0.20],
  C:     [0.50, 0.40, 0.40, 0.20],
}

/** Durée totale + différé d'amortissement selon tranche (mois). */
const DUREE_DIFFERE_PAR_TRANCHE: { dureeMois: number; differeMois: number }[] = [
  { dureeMois: 25 * 12, differeMois: 15 * 12 },  // Tranche 1 : 25 ans, différé 15 ans
  { dureeMois: 22 * 12, differeMois: 10 * 12 },  // Tranche 2 : 22 ans, différé 10 ans
  { dureeMois: 20 * 12, differeMois: 5 * 12 },   // Tranche 3 : 20 ans, différé 5 ans
  { dureeMois: 20 * 12, differeMois: 0 },        // Tranche 4 : 20 ans, sans différé
]

// ─────────────────────────────────────────────────────────────────────────────

/** Récupère le plafond revenus selon zone + nb occupants. */
export function plafondRevenus(zone: PtzZone, nbOccupants: number): number {
  const arr = PLAFOND_REVENUS_PAR_ZONE[zone]
  return arr[Math.min(nbOccupants - 1, arr.length - 1)] ?? 0
}

/** Récupère le plafond du coût d'opération selon zone + nb occupants. */
export function plafondOperation(zone: PtzZone, nbOccupants: number): number {
  const arr = PLAFOND_OPERATION_PAR_ZONE[zone]
  return arr[Math.min(nbOccupants - 1, arr.length - 1)] ?? 0
}

/** Détermine la tranche (1-4) à partir du RFR et de la composition familiale. */
export function trancheFromRevenu(zone: PtzZone, rfr: number, nbOccupants: number): 1 | 2 | 3 | 4 | null {
  const coeff = COEFF_FAMILIAL[Math.min(nbOccupants - 1, COEFF_FAMILIAL.length - 1)] ?? 1
  const rfrPondere = rfr / coeff
  const seuils = TRANCHES_RFR[zone]
  for (let i = 0; i < seuils.length; i++) {
    if (rfrPondere <= seuils[i]!) return (i + 1) as 1 | 2 | 3 | 4
  }
  return null  // Au-dessus de tranche 4 = pas éligible
}

/** Récupère la quotité PTZ applicable selon zone + tranche + nature du bien. */
export function quotitePtz(zone: PtzZone, tranche: 1 | 2 | 3 | 4, nature: PtzNatureBien): number {
  const idx = tranche - 1
  if (nature === 'neuf_collectif') return QUOTITE_NEUF[zone][idx] ?? 0
  if (nature === 'ancien_avec_travaux') return QUOTITE_ANCIEN_TRAVAUX[zone][idx] ?? 0
  if (nature === 'logement_social_acquis') return QUOTITE_NEUF[zone][idx] ?? 0
  return 0
}

/** Durée + différé selon tranche. */
export function dureeDiffere(tranche: 1 | 2 | 3 | 4): { dureeMois: number; differeMois: number } {
  return DUREE_DIFFERE_PAR_TRANCHE[tranche - 1]!
}

// ─────────────────────────────────────────────────────────────────────────────

/** Résultat de validation PTZ : éligibilité + montant max + warnings. */
export type PtzValidation = {
  eligible: boolean
  montantMax: number       // Montant PTZ max selon les règles
  tranche: 1 | 2 | 3 | 4 | null
  quotite: number          // 0-1 (ex: 0.4 = 40 %)
  dureeMois: number
  differeMois: number
  blocages: string[]       // Raisons qui rendent inéligible
  warnings: string[]       // Conseils non bloquants
}

export type PtzValidationInput = {
  zone: PtzZone | null
  nature: PtzNatureBien | null
  destination: string | null            // Doit être 'Résidence principale'
  primoAccedant: boolean
  rfrFoyer: number                      // RFR-N-2 du foyer fiscal
  nbOccupants: number
  coutOperation: number                 // Coût total prix + frais
  coutTravaux: number                   // Pour vérifier seuil 25% si ancien
  ville: string | null
}

/**
 * Vérifie l'éligibilité d'un projet au PTZ. Retourne un rapport détaillé.
 * Les blocages bloquent la création du PTZ ; les warnings sont informatifs.
 */
export function validatePtz(input: PtzValidationInput): PtzValidation {
  const blocages: string[] = []
  const warnings: string[] = []

  // 1. Zone obligatoire
  if (!input.zone) {
    blocages.push('Zone géographique non renseignée (A bis / A / B1 / B2 / C).')
  }

  // 2. Nature du bien
  if (!input.nature) {
    blocages.push('Nature du bien non renseignée (neuf collectif, ancien avec travaux, ou logement social acquis).')
  } else if (input.nature === 'neuf_collectif' && input.zone && (input.zone === 'B2' || input.zone === 'C')) {
    blocages.push('Le neuf collectif n\'est plus éligible au PTZ en zone B2/C depuis le 1er avril 2024.')
  } else if (input.nature === 'ancien_avec_travaux' && input.zone && (input.zone === 'A_bis' || input.zone === 'A' || input.zone === 'B1')) {
    blocages.push('L\'ancien avec travaux n\'est éligible au PTZ qu\'en zones B2 et C.')
  }

  // 3. Destination = RP
  if (input.destination && input.destination !== 'Résidence principale') {
    blocages.push(`Le PTZ exige une résidence principale (destination actuelle : ${input.destination}).`)
  }

  // 4. Primo-accédant
  if (!input.primoAccedant) {
    blocages.push('Le PTZ est réservé aux primo-accédants (n\'ayant pas été propriétaires de leur RP les 2 dernières années).')
  }

  // 5. Travaux ≥ 25 % si ancien
  if (input.nature === 'ancien_avec_travaux') {
    if (input.coutTravaux === 0 && input.coutOperation > 0) {
      // Cas spécifique : coût travaux non renseigné → message actionnable
      blocages.push(`Coût des travaux non renseigné dans le dossier. Le PTZ ancien exige ≥ 25 % de travaux. Renseigne le montant dans Modifier le projet → Coût des travaux.`)
    } else {
      const ratioTravaux = input.coutOperation > 0 ? input.coutTravaux / input.coutOperation : 0
      if (ratioTravaux < 0.25) {
        const minimumNecessaire = Math.ceil(input.coutOperation * 0.25 / 1000) * 1000
        blocages.push(`Travaux insuffisants (${(ratioTravaux * 100).toFixed(1)} % du coût total, ${input.coutTravaux.toLocaleString('fr-FR')} €). Le PTZ ancien exige ≥ 25 % du coût total — minimum ${minimumNecessaire.toLocaleString('fr-FR')} € de travaux.`)
      }
    }
  }

  // 6. Plafond de revenus
  if (input.zone) {
    const plafond = plafondRevenus(input.zone, input.nbOccupants)
    if (input.rfrFoyer > plafond) {
      blocages.push(`RFR du foyer (${input.rfrFoyer.toLocaleString('fr-FR')} €) dépasse le plafond zone ${input.zone} pour ${input.nbOccupants} occupant(s) : ${plafond.toLocaleString('fr-FR')} €.`)
    } else if (input.rfrFoyer > plafond * 0.95) {
      warnings.push(`RFR proche du plafond (à 95 %+). Vérifier le RFR-N-2 exact pour éviter un refus banque.`)
    }
  }

  // 7. Calcul tranche / quotité / durée / différé
  let tranche: 1 | 2 | 3 | 4 | null = null
  let quotite = 0
  let dureeMois = 0
  let differeMois = 0
  let montantMax = 0

  if (input.zone) {
    tranche = trancheFromRevenu(input.zone, input.rfrFoyer, input.nbOccupants)
    if (tranche !== null && input.nature) {
      quotite = quotitePtz(input.zone, tranche, input.nature)
      const dd = dureeDiffere(tranche)
      dureeMois = dd.dureeMois
      differeMois = dd.differeMois

      // Montant max = quotité × min(coût opération, plafond opération zone)
      const plafOp = plafondOperation(input.zone, input.nbOccupants)
      const baseCalcul = Math.min(input.coutOperation, plafOp)
      montantMax = Math.floor(baseCalcul * quotite)

      if (input.coutOperation > plafOp) {
        warnings.push(`Coût opération (${input.coutOperation.toLocaleString('fr-FR')} €) dépasse le plafond zone ${input.zone} (${plafOp.toLocaleString('fr-FR')} €). Le PTZ sera plafonné à ${plafOp.toLocaleString('fr-FR')} €.`)
      }
    }
  }

  if (montantMax === 0 && blocages.length === 0) {
    blocages.push('Tranche de revenu hors barème PTZ (RFR pondéré trop élevé).')
  }

  return {
    eligible: blocages.length === 0,
    montantMax,
    tranche,
    quotite,
    dureeMois,
    differeMois,
    blocages,
    warnings,
  }
}
