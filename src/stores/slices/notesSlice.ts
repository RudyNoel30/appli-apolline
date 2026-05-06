import type { StateCreator } from 'zustand'
import { mirror } from '@/db/api'
import { type Store, type Note, genId } from '../types'

export type NotesSlice = {
  notes: Note[]
  addNote: (dossierId: string, auteurId: string, auteurNom: string, contenu: string) => Note
  deleteNote: (id: string) => void
}

export const createNotesSlice: StateCreator<Store, [], [], NotesSlice> = (set) => ({
  notes: [],

  addNote: (dossierId, auteurId, auteurNom, contenu) => {
    const newN: Note = {
      id: genId('N'),
      dossierId,
      auteurId,
      auteurNom,
      date: new Date().toISOString(),
      contenu,
    }
    set((s) => ({ notes: [newN, ...s.notes] }))
    mirror.create('notes', newN as unknown as Record<string, unknown>)
    return newN
  },

  deleteNote: (id) => {
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }))
    mirror.remove('notes', id)
  },
})
