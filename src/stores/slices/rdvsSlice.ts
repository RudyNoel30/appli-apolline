import type { StateCreator } from 'zustand'
import { mirror } from '@/db/api'
import type { Rdv } from '@/data/mock'
import { type Store, genId } from '../types'

export type RdvsSlice = {
  rdvs: Rdv[]
  addRdv: (r: Omit<Rdv, 'id'>) => Rdv
  updateRdv: (id: string, patch: Partial<Rdv>) => void
  deleteRdv: (id: string) => void
  /**
   * Remplace les RDV importés depuis Microsoft 365 par un nouveau set,
   * en dédupliquant les RDV locaux qui pointent vers le même graphId.
   *
   * SÉCURITÉ : si le tableau reçu est VIDE alors que des RDV O365- existaient
   * en cache, on REFUSE le remplacement (car c'est presque toujours le signe
   * d'une sync qui a foiré silencieusement — token expiré géré par Graph,
   * timeout réseau, glitch Outlook). Pour une vraie déconnexion volontaire,
   * utiliser `clearO365Rdvs()` à la place.
   */
  replaceO365Rdvs: (rdvs: Rdv[]) => void
  /** Suppression explicite de tous les RDV O365 (utilisé à la déconnexion volontaire). */
  clearO365Rdvs: () => void
}

export const createRdvsSlice: StateCreator<Store, [], [], RdvsSlice> = (set) => ({
  rdvs: [],

  addRdv: (r) => {
    const newR: Rdv = { ...r, id: genId('R') }
    set((s) => ({ rdvs: [...s.rdvs, newR].sort((a, b) => a.date.localeCompare(b.date)) }))
    mirror.create('rdvs', newR as unknown as Record<string, unknown>)
    return newR
  },

  updateRdv: (id, patch) => {
    set((s) => ({
      rdvs: s.rdvs.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }))
    mirror.update('rdvs', id, patch as Record<string, unknown>)
  },

  deleteRdv: (id) => {
    set((s) => ({ rdvs: s.rdvs.filter((r) => r.id !== id) }))
    mirror.remove('rdvs', id)
  },

  replaceO365Rdvs: (o365Rdvs) => {
    set((s) => {
      // ─── GARDE-FOU CONTRE LES DÉSYNCS FANTÔMES ───
      // Si on reçoit 0 RDV alors qu'on en avait déjà → ignore (sync foirée).
      // L'utilisateur peut toujours vider explicitement via clearO365Rdvs().
      const hadO365 = s.rdvs.some((r) => r.id.startsWith('O365-'))
      if (o365Rdvs.length === 0 && hadO365) {
        console.warn('[rdvs] replaceO365Rdvs reçoit 0 RDV alors que', s.rdvs.filter(r => r.id.startsWith('O365-')).length, 'étaient en cache → ignoré (sync probablement échouée)')
        return s
      }

      // Set des graphId qui arrivent du sync — pour éliminer les doublons
      // locaux qui pointent vers le même événement Graph (créés depuis l'app
      // puis poussés à Outlook).
      const importedGraphIds = new Set(
        o365Rdvs.map((r) => r.graphId).filter((id): id is string => !!id),
      )
      const nonO365 = s.rdvs.filter((r) => {
        // 1) Retire les anciens RDV importés (préfixe O365-) — ils seront remplacés
        if (r.id.startsWith('O365-')) return false
        // 2) Retire les RDV locaux dont le graphId est dans le set importé (déduplication)
        if (r.graphId && importedGraphIds.has(r.graphId)) return false
        return true
      })
      return { rdvs: [...nonO365, ...o365Rdvs].sort((a, b) => a.date.localeCompare(b.date)) }
    })
  },

  clearO365Rdvs: () => {
    set((s) => ({ rdvs: s.rdvs.filter((r) => !r.id.startsWith('O365-')) }))
  },
})
