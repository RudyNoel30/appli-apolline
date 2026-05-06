import type { StateCreator } from 'zustand'
import { mirror } from '@/db/api'
import type { Pret } from '@/data/mock'
import { type Store, genId } from '../types'

export type PretsSlice = {
  prets: Pret[]
  addPret: (p: Omit<Pret, 'id' | 'createdAt' | 'updatedAt'>) => Pret
  updatePret: (id: string, patch: Partial<Pret>) => void
  deletePret: (id: string) => void
}

export const createPretsSlice: StateCreator<Store, [], [], PretsSlice> = (set) => ({
  prets: [],

  addPret: (p) => {
    const now = new Date().toISOString()
    const newP: Pret = {
      ...p,
      id: genId('P'),
      createdAt: now,
      updatedAt: now,
    }
    set((s) => ({ prets: [...s.prets, newP] }))
    mirror.create('prets', newP as unknown as Record<string, unknown>)
    return newP
  },

  updatePret: (id, patch) => {
    const now = new Date().toISOString()
    set((s) => ({
      prets: s.prets.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: now } : p)),
    }))
    mirror.update('prets', id, patch as Record<string, unknown>)
  },

  deletePret: (id) => {
    set((s) => ({ prets: s.prets.filter((p) => p.id !== id) }))
    mirror.remove('prets', id)
  },
})
