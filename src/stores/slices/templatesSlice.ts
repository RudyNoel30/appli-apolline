import type { StateCreator } from 'zustand'
import { mirror } from '@/db/api'
import { type Store, type Template, genId, todayIso } from '../types'

export type TemplatesSlice = {
  templates: Template[]
  addTemplate: (t: Omit<Template, 'id' | 'updatedAt'>) => Template
  updateTemplate: (id: string, patch: Partial<Template>) => void
  deleteTemplate: (id: string) => void
}

export const createTemplatesSlice: StateCreator<Store, [], [], TemplatesSlice> = (set) => ({
  templates: [],

  addTemplate: (t) => {
    const newT: Template = {
      ...t,
      id: genId('T'),
      updatedAt: todayIso(),
    }
    set((s) => ({ templates: [...s.templates, newT] }))
    mirror.create('templates', newT as unknown as Record<string, unknown>)
    return newT
  },

  updateTemplate: (id, patch) => {
    set((s) => ({
      templates: s.templates.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: todayIso() } : t)),
    }))
    mirror.update('templates', id, patch as Record<string, unknown>)
  },

  deleteTemplate: (id) => {
    set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }))
    mirror.remove('templates', id)
  },
})
