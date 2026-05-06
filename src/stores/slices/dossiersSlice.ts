import type { StateCreator } from 'zustand'
import { mirror } from '@/db/api'
import type { Client, Dossier, Statut } from '@/data/mock'
import { type Store, genId, todayIso } from '../types'

export type DossiersSlice = {
  dossiers: Dossier[]
  addDossier: (
    d: Omit<Dossier, 'id' | 'ref' | 'createdAt' | 'alertes' | 'piecesFournies' | 'piecesTotal' | 'scoreConfiance' | 'hcsfOk' | 'ltv'>
      & Partial<Pick<Dossier, 'hcsfOk' | 'ltv'>>,
  ) => Dossier
  updateDossier: (id: string, patch: Partial<Dossier>) => void
  moveDossier: (id: string, statut: Statut) => void
  deleteDossier: (id: string) => void
  /**
   * Crée la fiche prospect manquante pour un dossier orphelin (clientId qui
   * ne référence aucun client en base). Utilisé pour réparer manuellement les
   * dossiers créés avant le garde-fou de la v0.1.17.
   */
  materializeProspectFor: (dossierId: string) => Client | null
}

export const createDossiersSlice: StateCreator<Store, [], [], DossiersSlice> = (set, get) => ({
  dossiers: [],

  addDossier: (d) => {
    const year = new Date().getFullYear()
    const state = get()
    const count = state.dossiers.length + 1
    const ltv = d.ltv ?? (d.montantBien > 0 ? d.montantPret / d.montantBien : 0)
    const hcsfOk = d.hcsfOk ?? (ltv <= 1.0 && d.dureeMois <= 300)
    const newD: Dossier = {
      ...d,
      id: genId('D'),
      ref: `${year}-${String(count).padStart(4, '0')}`,
      createdAt: todayIso(),
      alertes: [],
      piecesFournies: 0,
      piecesTotal: 24,
      scoreConfiance: 75,
      hcsfOk,
      ltv,
    }

    // Garde-fou : si le clientId fourni ne correspond à aucun client en
    // base, on crée un prospect minimal en parallèle pour éviter un dossier
    // orphelin (cause de "Dossier introuvable" lors de l'affichage). Le
    // courtier pourra enrichir la fiche depuis la page Prospects/Clients.
    const existingClient = state.clients.find((c) => c.id === newD.clientId)
    let createdClient: Client | null = null
    if (!existingClient) {
      const parts = (newD.clientNom ?? '').trim().split(/\s+/).filter(Boolean)
      const nom = parts[0] ?? '(Sans nom)'
      const prenom = parts.slice(1).join(' ')
      createdClient = {
        id: newD.clientId,
        prenom, nom,
        email: '', tel: '', naissance: '', ville: '', profession: '',
        revenuMensuelNet: 0,
        dossierIds: [newD.id],
        createdAt: todayIso(),
        lastActivity: todayIso(),
        apporteur: '',
        statutCommercial: 'prospect',
      }
      console.log('[store] addDossier: clientId orphelin → création prospect parallèle', createdClient.id)
    }

    set((s) => ({
      dossiers: [newD, ...s.dossiers],
      clients: createdClient
        ? [createdClient, ...s.clients]
        : s.clients.map((c) =>
            c.id === newD.clientId
              ? { ...c, dossierIds: [...c.dossierIds, newD.id], lastActivity: todayIso() }
              : c,
          ),
      notifications: [{
        id: genId('NOT'),
        type: 'success',
        title: `Dossier ${newD.ref} créé`,
        description: `${newD.clientNom} — ${newD.typeProjet} à ${newD.villeBien}`,
        dossierId: newD.id,
        link: `/dossiers/${newD.id}`,
        createdAt: new Date().toISOString(),
        read: false,
      }, ...s.notifications],
    }))
    if (createdClient) {
      mirror.create('clients', createdClient as unknown as Record<string, unknown>)
    }
    mirror.create('dossiers', newD as unknown as Record<string, unknown>)
    return newD
  },

  updateDossier: (id, patch) => {
    set((s) => ({
      dossiers: s.dossiers.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }))
    mirror.update('dossiers', id, patch as Record<string, unknown>)
  },

  materializeProspectFor: (dossierId) => {
    const state = get()
    const dossier = state.dossiers.find((d) => d.id === dossierId)
    if (!dossier) return null
    const existing = state.clients.find((c) => c.id === dossier.clientId)
    if (existing) return existing
    // Génère un nouvel UUID pour le client (le clientId legacy du dossier
    // est probablement non-UUID donc rejeté côté backend). On repointe
    // ensuite le dossier vers ce nouveau client.
    const newClientId = crypto.randomUUID()
    const parts = (dossier.clientNom ?? '').trim().split(/\s+/).filter(Boolean)
    const nom = parts[0] ?? '(Sans nom)'
    const prenom = parts.slice(1).join(' ')
    const newClient: Client = {
      id: newClientId,
      prenom, nom,
      email: '', tel: '', naissance: '', ville: '', profession: '',
      revenuMensuelNet: 0,
      dossierIds: [dossier.id],
      createdAt: todayIso(),
      lastActivity: todayIso(),
      apporteur: '',
      statutCommercial: 'prospect',
    }
    set((s) => ({
      clients: [newClient, ...s.clients],
      dossiers: s.dossiers.map((d) => d.id === dossier.id ? { ...d, clientId: newClientId } : d),
    }))
    mirror.create('clients', newClient as unknown as Record<string, unknown>)
    mirror.update('dossiers', dossier.id, { clientId: newClientId })
    return newClient
  },

  moveDossier: (id, statut) => {
    const d = get().dossiers.find((dd) => dd.id === id)
    set((s) => ({
      dossiers: s.dossiers.map((dd) => (dd.id === id ? { ...dd, statut } : dd)),
    }))
    mirror.update('dossiers', id, { statut })
    if (d && (statut === 'Accord' || statut === 'Signe')) {
      const stat = statut === 'Signe' ? 'signé' : 'en accord banque'
      get().notify({
        type: 'success',
        title: `${d.clientNom} → ${stat}`,
        description: `Dossier ${d.ref}`,
        dossierId: d.id,
        link: `/dossiers/${d.id}`,
      })
    }
  },

  deleteDossier: (id) => {
    set((s) => {
      const d = (s.dossiers ?? []).find((dd) => dd.id === id)
      return {
        dossiers: (s.dossiers ?? []).filter((dd) => dd.id !== id),
        // Suppression cascade côté backend (FK ON DELETE CASCADE) — on
        // retire aussi côté front pour éviter des prêts orphelins en local
        // jusqu'au prochain SSE. Les `?? []` blindent contre un cache
        // localStorage hérité d'une version où la slice n'existait pas encore.
        prets: (s.prets ?? []).filter((p) => p.dossierId !== id),
        notes: (s.notes ?? []).filter((n) => n.dossierId !== id),
        clients: d
          ? (s.clients ?? []).map((c) =>
              c.id === d.clientId
                ? { ...c, dossierIds: (c.dossierIds ?? []).filter((x) => x !== id) }
                : c,
            )
          : (s.clients ?? []),
      }
    })
    mirror.remove('dossiers', id)
  },
})
