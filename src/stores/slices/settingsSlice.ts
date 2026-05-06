import type { StateCreator } from 'zustand'
import { type Store, type Settings } from '../types'

export const defaultSettings: Settings = {
  theme: 'apolline',
  verrouillageAutoMin: 15,
  notifSon: true,
  densite: 'confort',
  sidebarPinned: false,
  o365AutoSync: true,
  societe: {
    raisonSociale: 'Groupe Apolline',
    siren: '',
    orias: '',
    rcs: '',
  },
}

export type SettingsSlice = {
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
}

export const createSettingsSlice: StateCreator<Store, [], [], SettingsSlice> = (set) => ({
  settings: defaultSettings,
  updateSettings: (patch) => {
    set((s) => ({ settings: { ...s.settings, ...patch } }))
  },
})
