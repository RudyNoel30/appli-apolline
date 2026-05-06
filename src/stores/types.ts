/**
 * Types & helpers communs au store Zustand.
 * Le store est composé de plusieurs slices (`./slices/*`) qui s'intersectent
 * dans `Store`. Chaque slice utilise `Store` comme type pour `set`/`get`,
 * ce qui permet les références cross-slice (ex : addDossier crée aussi un
 * client orphelin, addPret pourrait notifier, etc.).
 */
import type {
  Client, Dossier, Rdv, Commission, Collaborateur, Banque, Apporteur, Pret,
} from '@/data/mock'

// ─── Types métier non-mock (vivent dans le store) ────────────────────────────

export type Note = {
  id: string
  dossierId: string
  auteurId: string
  auteurNom: string
  date: string
  contenu: string
}

export type Simulation = {
  id: string
  label: string
  clientNom?: string
  dossierId?: string
  montant: number
  duree: number
  apport: number
  revenu: number
  assurance: 'groupe' | 'delegataire'
  meilleureBanque: string
  meilleureMensualite: number
  createdAt: string
}

export type Notification = {
  id: string
  type: 'info' | 'success' | 'warning' | 'danger'
  title: string
  description?: string
  dossierId?: string
  link?: string
  createdAt: string
  read: boolean
}

export type Template = {
  id: string
  nom: string
  type: 'PDF' | 'HTML' | 'PNG' | 'Email'
  contenu: string
  description?: string
  actif: boolean
  updatedAt: string
}

export type Theme = 'apolline' | 'graphite' | 'sombre'

export type Societe = {
  raisonSociale: string
  siren: string
  orias: string
  rcs: string
}

export type AgendaView = 'day' | 'workweek' | 'week' | 'month'

export type Settings = {
  theme: Theme
  verrouillageAutoMin: number
  notifSon: boolean
  densite: 'compact' | 'confort'
  sidebarPinned: boolean
  /** @deprecated utiliser o365ByUser */
  o365UserEmail?: string
  o365ConnectedAt?: string
  o365ByUser?: Record<string, { email: string; connectedAt: string }>
  o365AutoSync: boolean
  societe: Societe
  agendaView?: AgendaView
}

// Helper exporté (utilisé par o365/msal.ts et pages/Parametres.tsx)
export function getO365EmailFor(settings: Settings, userId: string | null | undefined): string | undefined {
  if (!userId) return settings.o365UserEmail
  return settings.o365ByUser?.[userId]?.email ?? settings.o365UserEmail
}

// ─── Type du Store complet (intersection des slices) ──────────────────────────

import type { ClientsSlice } from './slices/clientsSlice'
import type { DossiersSlice } from './slices/dossiersSlice'
import type { PretsSlice } from './slices/pretsSlice'
import type { RdvsSlice } from './slices/rdvsSlice'
import type { NotesSlice } from './slices/notesSlice'
import type { SimulationsSlice } from './slices/simulationsSlice'
import type { BanquesSlice } from './slices/banquesSlice'
import type { ApporteursSlice } from './slices/apporteursSlice'
import type { CollaborateursSlice } from './slices/collaborateursSlice'
import type { NotificationsSlice } from './slices/notificationsSlice'
import type { TemplatesSlice } from './slices/templatesSlice'
import type { SettingsSlice } from './slices/settingsSlice'

export type Store =
  & ClientsSlice
  & DossiersSlice
  & PretsSlice
  & RdvsSlice
  & NotesSlice
  & SimulationsSlice
  & BanquesSlice
  & ApporteursSlice
  & CollaborateursSlice
  & NotificationsSlice
  & TemplatesSlice
  & SettingsSlice
  & {
    /** Section non-rattachée à une entité — read-only expose des données importées via SSE. */
    commissions: Commission[]
    /** Reset complet vers l'état seed (rare ; surtout utile en dev). */
    resetStore: () => void
  }

// ─── Helpers partagés par les slices ────────────────────────────────────────

/**
 * Génère un UUID v4 — format compatible avec le backend (colonnes uuid Postgres).
 * Le backend strippe les ids non-UUID dans `sanitizeForInsert`, donc utiliser
 * des ids legacy `Cxxxx` ferait perdre les références côté backend (causait
 * des dossiers orphelins). Le préfixe est ignoré (gardé pour signature compat).
 */
export const genId = (_prefix: string) => crypto.randomUUID()

export const todayIso = () => new Date().toISOString().slice(0, 10)

// Re-exports pour confort des consommateurs (`import { ... } from '@/stores/types'`)
export type {
  Client, Dossier, Rdv, Commission, Collaborateur, Banque, Apporteur, Pret,
}
