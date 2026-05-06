import type { StateCreator } from 'zustand'
import { mirror } from '@/db/api'
import type { Collaborateur } from '@/data/mock'
import { type Store, genId, todayIso } from '../types'

export type CollaborateursSlice = {
  collaborateurs: Collaborateur[]
  addCollaborateur: (c: Omit<Collaborateur, 'id' | 'creeLe' | 'dernierAcces' | 'dossiersAssignes'>) => Collaborateur
  updateCollaborateur: (id: string, patch: Partial<Collaborateur>) => void
  deleteCollaborateur: (id: string) => void
  markLogin: (id: string) => void
}

export const createCollaborateursSlice: StateCreator<Store, [], [], CollaborateursSlice> = (set) => ({
  collaborateurs: [],

  addCollaborateur: (c) => {
    const newC: Collaborateur = {
      ...c,
      id: genId('U'),
      creeLe: todayIso(),
      dernierAcces: new Date().toISOString(),
      dossiersAssignes: 0,
    }
    set((s) => ({ collaborateurs: [...s.collaborateurs, newC] }))
    mirror.create('collaborateurs', newC as unknown as Record<string, unknown>)
    return newC
  },

  updateCollaborateur: (id, patch) => {
    set((s) => ({
      collaborateurs: s.collaborateurs.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }))
    mirror.update('collaborateurs', id, patch as Record<string, unknown>)
  },

  deleteCollaborateur: (id) => {
    set((s) => ({ collaborateurs: s.collaborateurs.filter((c) => c.id !== id) }))
    mirror.remove('collaborateurs', id)
  },

  markLogin: (id) => {
    set((s) => ({
      collaborateurs: s.collaborateurs.map((c) =>
        c.id === id ? { ...c, dernierAcces: new Date().toISOString() } : c,
      ),
    }))
    // Pas de mirror ici : le backend met déjà à jour dernierAcces lors du login (auth.ts)
  },
})
