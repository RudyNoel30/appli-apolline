import type { StateCreator } from 'zustand'
import { mirror } from '@/db/api'
import type { Client } from '@/data/mock'
import { type Store, genId, todayIso } from '../types'

export type ClientsSlice = {
  clients: Client[]
  addClient: (
    c: Omit<Client, 'id' | 'createdAt' | 'lastActivity' | 'dossierIds' | 'statutCommercial'>
      & { statutCommercial?: Client['statutCommercial'] },
  ) => Client
  updateClient: (id: string, patch: Partial<Client>) => void
  deleteClient: (id: string) => void
  convertirEnClient: (id: string) => void
  repasserEnProspect: (id: string) => void
}

export const createClientsSlice: StateCreator<Store, [], [], ClientsSlice> = (set) => ({
  clients: [],

  addClient: (c) => {
    const newClient: Client = {
      ...c,
      id: genId('C'),
      createdAt: todayIso(),
      lastActivity: todayIso(),
      dossierIds: [],
      statutCommercial: c.statutCommercial ?? 'prospect',
    }
    set((s) => ({ clients: [newClient, ...s.clients] }))
    mirror.create('clients', newClient as unknown as Record<string, unknown>)
    return newClient
  },

  updateClient: (id, patch) => {
    set((s) => ({
      clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch, lastActivity: todayIso() } : c)),
    }))
    mirror.update('clients', id, patch as Record<string, unknown>)
  },

  deleteClient: (id) => {
    set((s) => ({
      clients: s.clients.filter((c) => c.id !== id),
      dossiers: s.dossiers.filter((d) => d.clientId !== id),
      notes: s.notes.filter((n) => {
        const d = s.dossiers.find((dd) => dd.id === n.dossierId)
        return d?.clientId !== id
      }),
    }))
    mirror.remove('clients', id)
  },

  convertirEnClient: (id) => {
    const patch = { statutCommercial: 'client' as const, mandatEnvoyeLe: todayIso() }
    set((s) => ({
      clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch, lastActivity: todayIso() } : c)),
    }))
    mirror.update('clients', id, patch)
  },

  repasserEnProspect: (id) => {
    const patch = { statutCommercial: 'prospect' as const, mandatEnvoyeLe: undefined }
    set((s) => ({
      clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch, lastActivity: todayIso() } : c)),
    }))
    mirror.update('clients', id, patch as Record<string, unknown>)
  },
})
