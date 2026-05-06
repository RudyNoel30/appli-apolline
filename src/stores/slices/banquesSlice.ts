import type { StateCreator } from 'zustand'
import { mirror } from '@/db/api'
import type { Banque } from '@/data/mock'
import { type Store, genId } from '../types'

export type BanquesSlice = {
  banques: Banque[]
  addBanque: (b: Omit<Banque, 'id'> & { id?: string }) => Banque
  updateBanque: (id: string, patch: Partial<Banque>) => void
  deleteBanque: (id: string) => void
}

export const createBanquesSlice: StateCreator<Store, [], [], BanquesSlice> = (set) => ({
  banques: [],

  addBanque: (b) => {
    const newB: Banque = {
      ...b,
      id: b.id || genId('B'),
    }
    set((s) => ({ banques: [...s.banques, newB] }))
    mirror.create('banques', newB as unknown as Record<string, unknown>)
    return newB
  },

  updateBanque: (id, patch) => {
    set((s) => ({
      banques: s.banques.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }))
    mirror.update('banques', id, patch as Record<string, unknown>)
  },

  deleteBanque: (id) => {
    set((s) => ({ banques: s.banques.filter((b) => b.id !== id) }))
    mirror.remove('banques', id)
  },
})
