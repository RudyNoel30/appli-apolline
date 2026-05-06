/**
 * Store Zustand principal — composé de slices indépendantes.
 *
 * Chaque domaine métier vit dans `./slices/<domain>Slice.ts` et y déclare :
 *   - son state (tableau d'entités)
 *   - ses actions CRUD (qui mirror-isent vers le backend)
 *
 * Les slices peuvent se référencer entre elles via le type `Store` partagé
 * (cf. `./types.ts`) — par exemple `addDossier` créé dans `dossiersSlice`
 * lit/écrit aussi `clients` et `notifications`.
 *
 * La persistence localStorage (clé `apolline-store`) inclut une migration v7
 * qui répare les dossiers orphelins en générant des UUID propres pour les
 * clients manquants.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Client } from '@/data/mock'
import type { Store, Settings } from './types'
import { todayIso } from './types'

// Slices
import { createClientsSlice } from './slices/clientsSlice'
import { createDossiersSlice } from './slices/dossiersSlice'
import { createPretsSlice } from './slices/pretsSlice'
import { createRdvsSlice } from './slices/rdvsSlice'
import { createNotesSlice } from './slices/notesSlice'
import { createSimulationsSlice } from './slices/simulationsSlice'
import { createBanquesSlice } from './slices/banquesSlice'
import { createApporteursSlice } from './slices/apporteursSlice'
import { createCollaborateursSlice } from './slices/collaborateursSlice'
import { createNotificationsSlice } from './slices/notificationsSlice'
import { createTemplatesSlice } from './slices/templatesSlice'
import { createSettingsSlice, defaultSettings } from './slices/settingsSlice'

// Re-exports pour rétrocompat (l'ancien useStore.ts exposait ces types)
export type {
  Note, Simulation, Notification, Template, Theme, Societe, AgendaView, Settings, Store,
} from './types'
export { getO365EmailFor } from './types'

export const useStore = create<Store>()(
  persist(
    (...a) => {
      const [set] = a
      return {
        // Slices CRUD (état + actions)
        ...createClientsSlice(...a),
        ...createDossiersSlice(...a),
        ...createPretsSlice(...a),
        ...createRdvsSlice(...a),
        ...createNotesSlice(...a),
        ...createSimulationsSlice(...a),
        ...createBanquesSlice(...a),
        ...createApporteursSlice(...a),
        ...createCollaborateursSlice(...a),
        ...createNotificationsSlice(...a),
        ...createTemplatesSlice(...a),
        ...createSettingsSlice(...a),

        // État read-only alimenté par SSE/pullAll uniquement
        commissions: [],

        // Reset complet — dev/debug surtout. Vide tout, garde defaultSettings.
        resetStore: () => {
          set({
            clients: [],
            dossiers: [],
            prets: [],
            rdvs: [],
            commissions: [],
            collaborateurs: [],
            banques: [],
            apporteurs: [],
            notes: [],
            simulations: [],
            notifications: [],
            templates: [],
            settings: defaultSettings,
          })
        },
      }
    },
    {
      name: 'apolline-store',
      // v3 = store vide par défaut (les données viennent du backend).
      // v4 = ajout de settings.societe (paramètres société du courtier).
      // v5 = retrait des champs sensibles (motDePasse) du snapshot persisté.
      // v6 = matérialisation auto des prospects manquants pour les dossiers orphelins.
      // v7 = même chose mais avec UUIDs (le backend rejette les ids legacy).
      // v8 = wipe forcé du cache local après refacto Cifacil + drop colonnes
      //      deprecated du Dossier (avril 2026). La BDD Postgres a été
      //      truncate-ée ; pullAll() rechargera ce qui existe (= rien).
      //      Settings préservés (thème, société, comptes O365, etc.).
      version: 8,
      // Filtre ce qui est écrit dans localStorage : on ne persiste JAMAIS
      // le motDePasse en clair des collaborateurs (sécurité poste local).
      partialize: (state) => ({
        ...state,
        collaborateurs: state.collaborateurs.map((c) => {
          const { motDePasse: _omit, ...rest } = c
          return rest as typeof c
        }),
      }),
      migrate: (persistedState: unknown, version: number) => {
        if (version < 3) {
          const old = persistedState as { settings?: Settings } | null
          return {
            settings: old?.settings ?? defaultSettings,
          } as Partial<Store> as Store
        }
        const state = persistedState as Store
        if (version < 4) {
          const settings = state.settings ?? defaultSettings
          if (!settings.societe) {
            settings.societe = defaultSettings.societe
          }
          state.settings = settings
        }
        if (version < 5) {
          // Wipe les motDePasse qui pourraient encore traîner en clair
          // dans les caches localStorage des utilisateurs déjà installés.
          state.collaborateurs = (state.collaborateurs ?? []).map((c) => {
            const { motDePasse: _omit, ...rest } = c
            return rest as typeof c
          })
        }
        if (version < 7) {
          // Récupération des dossiers orphelins (créés avant le garde-fou
          // addDossier ou avec ids legacy non-UUID) : pour chaque dossier
          // dont le clientId ne référence aucun client en base, on crée un
          // prospect minimal AVEC UN UUID PROPRE et on repointe le dossier
          // vers ce nouveau clientId.
          const existingClientIds = new Set((state.clients ?? []).map((c) => c.id))
          const newClients: Client[] = []
          state.dossiers = (state.dossiers ?? []).map((d) => {
            if (!d.clientId || existingClientIds.has(d.clientId)) return d
            // Orphelin : on génère un nouveau UUID
            const newClientId = crypto.randomUUID()
            const parts = (d.clientNom ?? '').trim().split(/\s+/).filter(Boolean)
            const nom = parts[0] ?? '(Sans nom)'
            const prenom = parts.slice(1).join(' ')
            newClients.push({
              id: newClientId,
              prenom, nom,
              email: '', tel: '', naissance: '', ville: '', profession: '',
              revenuMensuelNet: 0,
              dossierIds: [d.id],
              createdAt: d.createdAt ?? todayIso(),
              lastActivity: d.createdAt ?? todayIso(),
              apporteur: '',
              statutCommercial: 'prospect',
            })
            existingClientIds.add(newClientId)
            return { ...d, clientId: newClientId }
          })
          if (newClients.length > 0) {
            console.log(`[migrate v7] ${newClients.length} prospect(s) recréé(s) avec UUID + dossier(s) repointé(s)`)
            state.clients = [...newClients, ...(state.clients ?? [])]
          }
        }
        if (version < 8) {
          // ⚠️ WIPE FORCÉ — refacto majeur avril 2026 (Cifacil + drop colonnes
          // deprecated). On vide tout le cache local et on laisse pullAll()
          // re-télécharger depuis Postgres (qui a été truncate-é côté serveur).
          // Settings préservés pour ne pas perdre thème/société/agendaView.
          console.log('[migrate v8] wipe cache local — pullAll va recharger depuis Postgres')
          const preservedSettings = state.settings ?? defaultSettings
          state.clients = []
          state.dossiers = []
          state.prets = []
          state.rdvs = []
          state.commissions = []
          state.collaborateurs = []
          state.banques = []
          state.apporteurs = []
          state.notes = []
          state.simulations = []
          state.notifications = []
          state.templates = []
          state.settings = preservedSettings
        }
        return state
      },
    },
  ),
)
