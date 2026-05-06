import type { StateCreator } from 'zustand'
import { mirror } from '@/db/api'
import type { Apporteur } from '@/data/mock'
import { type Store, genId, todayIso } from '../types'

export type ApporteursSlice = {
  apporteurs: Apporteur[]
  addApporteur: (a: Omit<Apporteur, 'id' | 'createdAt'> & { id?: string }) => Apporteur
  updateApporteur: (id: string, patch: Partial<Apporteur>) => void
  deleteApporteur: (id: string) => void
  /** Remplace toute la base apporteurs par un import (typiquement depuis un export Cifacil). */
  importApporteurs: (rows: Omit<Apporteur, 'id' | 'createdAt'>[]) => number
}

export const createApporteursSlice: StateCreator<Store, [], [], ApporteursSlice> = (set) => ({
  apporteurs: [],

  addApporteur: (a) => {
    const newA: Apporteur = {
      ...a,
      id: a.id || genId('A'),
      createdAt: todayIso(),
    }
    set((s) => ({ apporteurs: [...s.apporteurs, newA] }))
    mirror.create('apporteurs', newA as unknown as Record<string, unknown>)
    return newA
  },

  updateApporteur: (id, patch) => {
    set((s) => ({
      apporteurs: s.apporteurs.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }))
    mirror.update('apporteurs', id, patch as Record<string, unknown>)
  },

  deleteApporteur: (id) => {
    set((s) => ({ apporteurs: s.apporteurs.filter((a) => a.id !== id) }))
    mirror.remove('apporteurs', id)
  },

  importApporteurs: (rows) => {
    const imported: Apporteur[] = rows.map((r) => ({
      ...r,
      id: genId('A'),
      createdAt: todayIso(),
      importeDeCifacil: true,
    }))
    set((s) => ({ apporteurs: [...s.apporteurs, ...imported] }))
    // Mirror chaque apporteur (pas de bulk endpoint pour rester simple)
    imported.forEach((a) => mirror.create('apporteurs', a as unknown as Record<string, unknown>))
    return imported.length
  },
})
