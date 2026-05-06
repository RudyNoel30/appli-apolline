/**
 * Helpers de calcul pour le tableau de bord.
 *
 * Le dashboard ne doit JAMAIS afficher de données mockées — toutes les KPIs
 * sont dérivées du store (qui est lui-même un cache temps-réel de Postgres).
 */
import type { Commission, Dossier, Rdv, AlerteGlobale } from '@/data/mock'

/**
 * "Ma journée" — liste actionnable de ce que le courtier doit faire aujourd'hui.
 * Combine RDV imminents, dossiers stagnants et actions urgentes.
 */
export type Tache = {
  id: string
  type: 'rdv' | 'relance' | 'piece' | 'hcsf' | 'signature' | 'stagnation'
  priorite: 'haute' | 'moyenne' | 'basse'
  titre: string
  detail: string
  link?: string
  /** Heure éventuelle (pour les RDV). */
  heure?: string
}

export function computeTachesJour(
  dossiers: Dossier[],
  rdvs: Rdv[],
  refDate: Date = new Date(),
): Tache[] {
  const out: Tache[] = []
  const startOfDay = new Date(refDate); startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(refDate); endOfDay.setHours(23, 59, 59, 999)
  const sevenDaysAgo = startOfDay.getTime() - 7 * 24 * 3600 * 1000
  const thirtyDaysAgo = startOfDay.getTime() - 30 * 24 * 3600 * 1000

  // 1. RDV du jour
  for (const r of rdvs) {
    const t = new Date(r.date).getTime()
    if (t >= startOfDay.getTime() && t <= endOfDay.getTime()) {
      out.push({
        id: `rdv:${r.id}`, type: 'rdv', priorite: 'haute',
        titre: `${r.type ?? 'RDV'} avec ${r.clientNom ?? '—'}`,
        detail: r.lieu ?? '',
        heure: new Date(r.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        link: '/agenda',
      })
    }
  }

  for (const d of dossiers) {
    if (d.archive) continue
    // 2. Dossier signé : relance d'encaissement
    if (d.statut === 'Signe') {
      out.push({
        id: `sig:${d.id}`, type: 'signature', priorite: 'haute',
        titre: `Confirmer encaissement — ${d.clientNom}`,
        detail: `Dossier ${d.ref} signé, suivi commission`,
        link: `/dossiers/${d.id}`,
      })
    }
    // 3. Envoi banque depuis > 7 jours sans accord → relance
    if (d.statut === 'Envoi_banque' && d.createdAt) {
      const created = new Date(d.createdAt).getTime()
      if (created < sevenDaysAgo) {
        out.push({
          id: `relance:${d.id}`, type: 'relance', priorite: 'moyenne',
          titre: `Relancer banque — ${d.clientNom}`,
          detail: `${d.ref} en envoi depuis > 7 jours`,
          link: `/dossiers/${d.id}`,
        })
      }
    }
    // 4. Pièces incomplètes (< 50 %) sur dossier actif
    if (d.piecesTotal > 0 && d.piecesFournies / d.piecesTotal < 0.5
        && !['Encaisse', 'Abandonne'].includes(d.statut)) {
      out.push({
        id: `piece:${d.id}`, type: 'piece', priorite: 'haute',
        titre: `Pièces manquantes — ${d.clientNom}`,
        detail: `${d.piecesFournies}/${d.piecesTotal} fournies · ${d.ref}`,
        link: `/dossiers/${d.id}`,
      })
    }
    // 5. HCSF hors norme
    if (!d.hcsfOk && !['Encaisse', 'Abandonne'].includes(d.statut)) {
      out.push({
        id: `hcsf:${d.id}`, type: 'hcsf', priorite: 'haute',
        titre: `HCSF hors norme — ${d.clientNom}`,
        detail: `LTV ${(d.ltv * 100).toFixed(0)}% · ${d.ref}`,
        link: `/dossiers/${d.id}`,
      })
    }
    // 6. Dossier stagnant : pas modifié depuis > 30 jours
    if (d.createdAt && new Date(d.createdAt).getTime() < thirtyDaysAgo
        && !['Encaisse', 'Abandonne', 'Signe'].includes(d.statut)) {
      out.push({
        id: `stag:${d.id}`, type: 'stagnation', priorite: 'basse',
        titre: `Sans activité depuis 30 j — ${d.clientNom}`,
        detail: `${d.ref} bloqué en ${d.statut}`,
        link: `/dossiers/${d.id}`,
      })
    }
  }

  const order: Record<Tache['priorite'], number> = { haute: 0, moyenne: 1, basse: 2 }
  out.sort((a, b) => {
    const p = order[a.priorite] - order[b.priorite]
    if (p !== 0) return p
    if (a.heure && b.heure) return a.heure.localeCompare(b.heure)
    return 0
  })
  return out
}

const MOIS_FR = ['Janv', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc']

/**
 * Encaissements brut/net agrégés sur les 6 derniers mois (calendrier).
 * Si `commissions` est vide, retourne 6 mois à zéro pour que le graphique
 * reste lisible.
 */
export function computeEncaissementsMensuels(
  commissions: Commission[],
  refDate: Date = new Date(),
): Array<{ mois: string; brut: number; net: number }> {
  const out: Array<{ mois: string; brut: number; net: number; key: string }> = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    out.push({ mois: MOIS_FR[d.getMonth()], brut: 0, net: 0, key })
  }
  for (const c of commissions) {
    // commission.mois est typiquement au format YYYY-MM (cf. schema)
    const moisRaw = (c as { mois?: string }).mois
    if (!moisRaw) continue
    const slot = out.find((o) => o.key === moisRaw)
    if (!slot) continue
    const brut = (c as { montantBrut?: number }).montantBrut ?? 0
    const net = (c as { montantNet?: number }).montantNet ?? brut
    slot.brut += brut
    slot.net += net
  }
  return out.map(({ mois, brut, net }) => ({ mois, brut, net }))
}

/**
 * Total des encaissements pour le mois en cours.
 */
export function computeEncaissementsMois(commissions: Commission[], refDate: Date = new Date()): number {
  const key = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}`
  return commissions.reduce((s, c) => {
    const moisRaw = (c as { mois?: string }).mois
    if (moisRaw !== key) return s
    return s + ((c as { montantBrut?: number }).montantBrut ?? 0)
  }, 0)
}

/**
 * Alertes globales dérivées de l'état des dossiers et RDV.
 * Sources :
 *  - `dossier.alertes[]` (string[]) → 1 alerte par chaîne, prioritée moyenne
 *  - HCSF hors norme → priorité haute
 *  - Pièces incomplètes (< 50%) → priorité haute
 *  - RDV à venir dans les 3 jours → priorité moyenne
 */
export function computeAlertes(dossiers: Dossier[], rdvs: Rdv[], _refDate: Date = new Date()): AlerteGlobale[] {
  const alerts: AlerteGlobale[] = []
  const refDate = _refDate

  for (const d of dossiers) {
    if (d.archive) continue

    // HCSF hors norme
    if (!d.hcsfOk) {
      alerts.push({
        type: 'hcsf',
        titre: `HCSF hors norme — ${d.clientNom}`,
        detail: `LTV ${(d.ltv * 100).toFixed(0)}% · ${d.dureeMois / 12} ans`,
        priorite: 'haute',
        dossierId: d.id,
      })
    }

    // Pièces incomplètes
    if (d.piecesTotal > 0 && d.piecesFournies / d.piecesTotal < 0.5) {
      alerts.push({
        type: 'piece',
        titre: `Pièces incomplètes — ${d.clientNom}`,
        detail: `${d.piecesFournies}/${d.piecesTotal} pièces fournies`,
        priorite: 'haute',
        dossierId: d.id,
      })
    }

    // Alertes textuelles portées par le dossier
    for (const a of d.alertes ?? []) {
      alerts.push({
        type: 'piece',
        titre: `${a} — ${d.clientNom}`,
        detail: `Dossier ${d.ref}`,
        priorite: 'moyenne',
        dossierId: d.id,
      })
    }
  }

  // RDV imminents (≤ 3 jours)
  const trois_jours = 3 * 24 * 3600 * 1000
  for (const r of rdvs) {
    const t = new Date(r.date).getTime()
    if (t > refDate.getTime() && t - refDate.getTime() <= trois_jours) {
      alerts.push({
        type: 'rdv',
        titre: `${r.type ?? 'RDV'} imminent — ${r.clientNom ?? 'Sans nom'}`,
        detail: `${new Date(r.date).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: '2-digit' })} ${new Date(r.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · ${r.lieu ?? ''}`,
        priorite: 'moyenne',
        dossierId: (r as { dossierId?: string }).dossierId ?? '',
      })
    }
  }

  // Tri : haute > moyenne > basse
  const order: Record<AlerteGlobale['priorite'], number> = { haute: 0, moyenne: 1, basse: 2 }
  alerts.sort((a, b) => order[a.priorite] - order[b.priorite])
  return alerts
}
