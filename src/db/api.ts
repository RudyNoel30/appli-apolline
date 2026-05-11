/**
 * Client HTTP du backend Apolline + écoute SSE temps réel.
 *
 * Usage minimal :
 *   import { api, sync } from '@/db/api'
 *   const clients = await api.list('clients')
 *   await api.create('clients', { prenom, nom, email, ... })
 *   sync.start()  // à appeler après login → met à jour le store Zustand en live
 */
import { useStore } from '@/stores/useStore'

const STORAGE_TOKEN = 'apolline.auth_token'

/* ────────────────── Configuration ────────────────── */

/**
 * URL backend Apolline — figée pour Groupe Apolline.
 * Tout MSI distribué pointe vers cette même base de données partagée.
 *
 * Override possible via VITE_API_BASE pour les builds dev/staging.
 * Si la variable est absente au build, on utilise la prod (ce qui est
 * le comportement attendu pour les MSI distribués).
 */
const PROD_API_BASE = 'https://appli.apolline.groupe-apolline.eu'

function getApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_BASE as string | undefined
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  return PROD_API_BASE
}

export const API_BASE = getApiBase()

/* ────────────────── Auth token storage ────────────────── */

export function getToken(): string | null {
  return localStorage.getItem(STORAGE_TOKEN)
}
export function setToken(t: string | null) {
  if (t) localStorage.setItem(STORAGE_TOKEN, t)
  else localStorage.removeItem(STORAGE_TOKEN)
}

/* ────────────────── Erreurs HTTP ────────────────── */

export class ApiError extends Error {
  constructor(public status: number, public payload: unknown, message: string) {
    super(message)
  }
}

async function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    // Lit le body UNE seule fois (text), puis tente de parser en JSON.
    // Lire .json() puis .text() en cas d'échec lève "body stream already read".
    let payload: unknown = null
    const raw = await res.text().catch(() => '')
    if (raw) {
      try { payload = JSON.parse(raw) } catch { payload = raw }
    }
    const msg = (payload && typeof payload === 'object' && 'error' in payload)
      ? String((payload as { error: unknown }).error)
      : `HTTP ${res.status}`
    throw new ApiError(res.status, payload, msg)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

/* ────────────────── Auth API ────────────────── */

export const auth = {
  async login(email: string, password: string): Promise<{ token: string; user: Record<string, unknown> }> {
    const res = await request<{ token: string; user: Record<string, unknown> }>('POST', '/api/auth/login', { email, password })
    setToken(res.token)
    return res
  },
  async me(): Promise<Record<string, unknown>> {
    return request('GET', '/api/auth/me')
  },
  async updateMe(patch: Record<string, unknown>): Promise<Record<string, unknown>> {
    return request('PATCH', '/api/auth/me', patch)
  },
  async changePassword(current: string, next: string): Promise<{ ok: boolean }> {
    return request('POST', '/api/auth/change-password', { current, next })
  },
  logout(): void {
    setToken(null)
  },
}

/* ────────────────── Healthcheck ────────────────── */

export type HealthStatus = {
  ok: boolean
  ts: number
  uptimeMs: number
  version: string
  db: { ok: boolean; latencyMs: number | null; error: string | null }
  node: string
}

export async function fetchHealth(): Promise<HealthStatus> {
  return request('GET', '/api/health')
}

/* ────────────────── Audit log ────────────────── */

export type AuditEntry = {
  id: string
  ts: string
  userId: string | null
  userEmail: string | null
  action: string
  entityType: string | null
  entityId: string | null
  details: string | null
  ip: string | null
  userAgent: string | null
}

export async function fetchAuditLog(limit = 200): Promise<AuditEntry[]> {
  return request('GET', `/api/audit?limit=${limit}`)
}

/* ────────────────── RGPD ────────────────── */

export const rgpd = {
  /** Article 15 — exporte toutes les données d'un client en JSON. */
  async exportClient(clientId: string): Promise<Record<string, unknown>> {
    return request('GET', `/api/rgpd/clients/${encodeURIComponent(clientId)}/export`)
  },
  /** Article 17 — efface définitivement un client + toutes ses données. Admin uniquement. */
  async eraseClient(clientId: string, raison: string): Promise<{ ok: boolean; erased: { clientId: string; dossiers: number; timestamp: string } }> {
    return request('POST', `/api/rgpd/clients/${encodeURIComponent(clientId)}/erase`, { raison })
  },
  /** Article 30 — registre des traitements. */
  async registry(): Promise<Record<string, unknown>> {
    return request('GET', '/api/rgpd/registry')
  },
}

/* ────────────────── Pièces (filesystem) ────────────────── */

export type ExtractionType =
  | 'bulletin_salaire' | 'avis_imposition' | 'rib' | 'cni'
  | 'justif_domicile' | 'compromis' | 'dpe' | 'autre'

export type ExtractionStatus =
  | 'pending' | 'processing' | 'completed' | 'failed' | 'applied' | 'rejected'

export type PieceMeta = {
  id: string
  dossierId: string
  categorie: 'P1' | 'P2' | 'P3' | 'P4' | 'P5'
  libelle: string
  filename: string
  mimeType: string
  sizeBytes: number
  sha256: string | null
  statut: 'valide' | 'a_fournir' | 'manquant' | 'expire'
  uploadedBy: string | null
  uploadedAt: string
  // Extraction OCR (Phase 1)
  extractionType?: ExtractionType | null
  extractionStatus?: ExtractionStatus | null
  extractedData?: Record<string, unknown> | null
  extractionConfidence?: number | null
  extractionError?: string | null
  extractedAt?: string | null
  appliedAt?: string | null
  appliedBy?: string | null
}

export type ExtractResponse = {
  ok: boolean
  status: 'completed' | 'failed'
  type: ExtractionType
  data?: Record<string, unknown> | null
  confidence?: number
  error?: string
  usage?: { inputTokens: number; outputTokens: number; estimatedCostEur: number }
}

export const pieces = {
  /** Liste les pièces d'un dossier (depuis la BDD, fichiers stockés sur le VPS). */
  list(dossierId: string): Promise<PieceMeta[]> {
    return request('GET', `/api/dossiers/${encodeURIComponent(dossierId)}/pieces`)
  },
  /**
   * Upload 1 ou plusieurs fichiers vers un dossier.
   *
   * Découpe automatiquement en batchs séquentiels pour ne jamais dépasser ~15 Mo
   * de payload par requête (limite nginx = 25 Mo, marge confort). Évite l'erreur
   * "Failed to fetch" qui survient quand le payload est trop gros.
   *
   * Batch ouvert quand : ≥ 6 fichiers OU ≥ 15 Mo cumulés. Le 1er fichier passe
   * toujours, même s'il fait à lui seul plus de 15 Mo (le backend acceptera ou
   * renverra une erreur explicite "Trop volumineux").
   */
  async upload(
    dossierId: string,
    files: File[],
    opts: { categorie?: 'P1' | 'P2' | 'P3' | 'P4' | 'P5'; libelle?: string; onProgress?: (done: number, total: number) => void } = {},
  ): Promise<{ inserted: number; errors: Array<{ filename: string; error: string }>; pieces: PieceMeta[] }> {
    if (files.length === 0) return { inserted: 0, errors: [], pieces: [] }

    const MAX_BATCH_FILES = 6
    const MAX_BATCH_BYTES = 15 * 1024 * 1024 // 15 Mo, marge confort sous les 25 Mo nginx

    // Construit les batchs
    const batches: File[][] = []
    let current: File[] = []
    let currentBytes = 0
    for (const f of files) {
      const wouldExceed = current.length >= MAX_BATCH_FILES || (current.length > 0 && currentBytes + f.size > MAX_BATCH_BYTES)
      if (wouldExceed) {
        batches.push(current)
        current = []
        currentBytes = 0
      }
      current.push(f)
      currentBytes += f.size
    }
    if (current.length > 0) batches.push(current)

    const token = getToken()
    const base = (import.meta.env.VITE_API_BASE as string | undefined) || 'https://appli.apolline.groupe-apolline.eu'

    const aggInserted: PieceMeta[] = []
    const aggErrors: Array<{ filename: string; error: string }> = []
    let done = 0
    opts.onProgress?.(0, files.length)

    for (const batch of batches) {
      const fd = new FormData()
      for (const f of batch) fd.append('file', f)
      if (opts.categorie) fd.append('categorie', opts.categorie)
      if (opts.libelle) fd.append('libelle', opts.libelle)

      try {
        const res = await fetch(`${base}/api/dossiers/${encodeURIComponent(dossierId)}/pieces/upload`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        })
        if (!res.ok) {
          const txt = await res.text().catch(() => '')
          // Échec global du batch → on marque tous ses fichiers en erreur
          for (const f of batch) {
            aggErrors.push({ filename: f.name, error: `HTTP ${res.status} : ${txt.slice(0, 120) || 'upload échoué'}` })
          }
        } else {
          const data = await res.json() as { inserted: number; errors: Array<{ filename: string; error: string }>; pieces: PieceMeta[] }
          aggInserted.push(...data.pieces)
          aggErrors.push(...data.errors)
        }
      } catch (e) {
        // Network error / Failed to fetch — on marque tous les fichiers du batch en erreur
        const msg = e instanceof Error ? e.message : String(e)
        for (const f of batch) {
          aggErrors.push({ filename: f.name, error: `Réseau : ${msg}` })
        }
      }

      done += batch.length
      opts.onProgress?.(done, files.length)
    }

    return { inserted: aggInserted.length, errors: aggErrors, pieces: aggInserted }
  },
  /** URL preview (inline pour iframe). Inclut le token en querystring car iframe ne porte pas l'Authorization header. */
  previewUrl(pieceId: string): string {
    const token = getToken() ?? ''
    const base = (import.meta.env.VITE_API_BASE as string | undefined) || 'https://appli.apolline.groupe-apolline.eu'
    return `${base}/api/pieces/${encodeURIComponent(pieceId)}/preview?_t=${encodeURIComponent(token)}`
  },
  /** Déclenche le téléchargement (via fetch + blob, pour respecter l'auth header). */
  async download(pieceId: string, filename: string): Promise<void> {
    const token = getToken()
    const base = (import.meta.env.VITE_API_BASE as string | undefined) || 'https://appli.apolline.groupe-apolline.eu'
    const res = await fetch(`${base}/api/pieces/${encodeURIComponent(pieceId)}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      throw new ApiError(res.status, txt || null, `download échoué (HTTP ${res.status})`)
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename
    document.body.appendChild(a); a.click()
    setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 1000)
  },
  /** Supprime une pièce (fichier + ligne BDD). */
  async remove(pieceId: string): Promise<void> {
    await request('DELETE', `/api/pieces/${encodeURIComponent(pieceId)}`)
  },
  /** Met à jour les métadonnées (catégorie, libellé, statut). */
  async update(pieceId: string, patch: Partial<Pick<PieceMeta, 'categorie' | 'libelle' | 'statut'>>): Promise<void> {
    await request('PATCH', `/api/pieces/${encodeURIComponent(pieceId)}`, patch)
  },
  /**
   * Lance l'extraction OCR + structuration de la pièce.
   * Si type=null/undefined → Claude classifie automatiquement le document.
   * Sinon → utilise le type fourni directement.
   * Retour : données extraites + confidence + coût.
   */
  async extract(pieceId: string, type?: ExtractionType): Promise<ExtractResponse> {
    return request('POST', `/api/pieces/${encodeURIComponent(pieceId)}/extract`, type ? { type } : {})
  },
  /**
   * Applique les données extraites au dossier / client.
   * dossierPatch : { rfn: 45000, ... } pour la table dossiers.
   * clientPatch  : { emprunteur1: { revenuMensuel: ..., ... } } pour la table clients.
   */
  async applyExtraction(pieceId: string, patch: { dossierPatch?: Record<string, unknown>; clientPatch?: Record<string, unknown> }): Promise<void> {
    await request('POST', `/api/pieces/${encodeURIComponent(pieceId)}/apply-extraction`, patch)
  },
  /** Rejette une extraction (le user ne veut pas l'appliquer). */
  async rejectExtraction(pieceId: string): Promise<void> {
    await request('POST', `/api/pieces/${encodeURIComponent(pieceId)}/reject-extraction`, {})
  },
}

/* ────────────────── AI / Anthropic Claude ────────────────── */

export type AiSkillInfo = { name: string; tier: 'sonnet' | 'haiku' | 'opus'; model: string; title: string; description: string }

export type AiGenerateResult = {
  content: string
  skill: string
  model: string
  tier: 'sonnet' | 'haiku' | 'opus'
  stopReason: string | null
  usage: {
    inputTokens: number
    outputTokens: number
    cacheCreationInputTokens: number
    cacheReadInputTokens: number
    estimatedCostEur: number
  }
}

export type AiUsageStats = {
  period: { days: number; since: string }
  total: { cost: number; count: number }
  byDay: Array<{ day: string; cost: number; count: number }>
  bySkill: Array<{ skill: string; cost: number; count: number }>
  byUser: Array<{ userId: string; userEmail: string; cost: number; count: number }>
  recent: Array<{ id: string; ts: string; userId: string | null; userEmail: string | null; skill: string; cost: number; tokensIn: number; tokensOut: number; model: string; via: 'skill' | 'coworker' }>
  split?: {
    skills: { cost: number; count: number }
    coworker: { cost: number; count: number }
  }
  topTools?: Array<{ name: string; count: number }>
}

export const ai = {
  health(): Promise<{ configured: boolean; skills: string[] }> {
    return request('GET', '/api/ai/health')
  },
  skills(): Promise<{ skills: AiSkillInfo[] }> {
    return request('GET', '/api/ai/skills')
  },
  /** Invoque un skill avec un contexte JSON arbitraire. */
  generate(skillName: string, context: Record<string, unknown>, instructions?: string): Promise<AiGenerateResult> {
    return request('POST', `/api/ai/generate/${encodeURIComponent(skillName)}`, { context, instructions })
  },
  /** Charge le dossier en BDD et invoque le skill avec ce contexte enrichi. */
  generateForDossier(dossierId: string, skillName: string): Promise<AiGenerateResult> {
    return request('POST', `/api/ai/dossier/${encodeURIComponent(dossierId)}/${encodeURIComponent(skillName)}`)
  },
  usage(days = 30): Promise<AiUsageStats> {
    return request('GET', `/api/ai/usage?days=${days}`)
  },
}

/* ────────────────── Facturation ────────────────── */

export type FactureType =
  | 'honoraires' | 'comm_banque' | 'comm_autre' | 'ristourne'
  | 'avoir_honoraires' | 'avoir_comm_banque' | 'avoir_comm_autre' | 'avoir_ristourne'

export type FactureStatut = 'prevue' | 'emise' | 'reglee_partiel' | 'reglee' | 'avoir_emis' | 'annulee'

export type FacturePartenaireType = 'client' | 'banque' | 'apporteur' | 'autre'

export type FactureModeReglement =
  | 'virement' | 'cheque' | 'prelevement' | 'cb' | 'numeraire'
  | 'via_notaire' | 'via_banque' | 'autre'

export type Facture = {
  id: string
  ref: string
  type: FactureType
  dossierId: string
  clientId: string | null
  partenaireType: FacturePartenaireType | null
  partenaireId: string | null
  partenaireNom: string | null
  partenaireEmail: string | null
  /** Montants en CENTIMES — convertir avec /100 pour affichage. */
  montantHt: number
  tvaTaux: number
  montantTva: number
  montantTtc: number
  emiseLe: string | null
  echeanceLe: string | null
  regleeLe: string | null
  prevueLe: string | null
  acteLe: string | null
  modeReglement: FactureModeReglement | null
  montantRegle: number
  numeroPiece: string | null
  statut: FactureStatut
  commissionId: string | null
  factureAvoirId: string | null
  pdfFilePath: string | null
  prestation: string | null
  infoReglement: string | null
  commentaire: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export type FactureCreate = {
  type: FactureType
  dossierId: string
  clientId?: string | null
  partenaireType?: FacturePartenaireType | null
  partenaireId?: string | null
  partenaireNom?: string | null
  partenaireEmail?: string | null
  /** En EUR (pas centimes — converti côté backend). */
  montantHt: number
  tvaTaux?: number
  emiseLe?: string | null
  echeanceLe?: string | null
  prevueLe?: string | null
  acteLe?: string | null
  modeReglement?: FactureModeReglement | null
  numeroPiece?: string | null
  statut?: FactureStatut
  commissionId?: string | null
  prestation?: string | null
  infoReglement?: string | null
  commentaire?: string | null
}

export type FactureStats = {
  period: { days: number; since: string }
  nbPrevues: number
  nbEmises: number
  nbReglees: number
  /** Centimes */
  mtPrevu: number
  mtEmisAttente: number
  mtEncaissePeriode: number
  mtRetard: number
}

export type FactureFilter = {
  types?: FactureType[]
  statuts?: FactureStatut[]
  dossierId?: string
  clientId?: string
  partenaireType?: FacturePartenaireType
  since?: string
  until?: string
  dateField?: 'emise_le' | 'reglee_le' | 'prevue_le'
  search?: string
  limit?: number
}

function buildFacturesQuery(f: FactureFilter): string {
  const params = new URLSearchParams()
  if (f.types?.length) params.set('types', f.types.join(','))
  if (f.statuts?.length) params.set('statuts', f.statuts.join(','))
  if (f.dossierId) params.set('dossierId', f.dossierId)
  if (f.clientId) params.set('clientId', f.clientId)
  if (f.partenaireType) params.set('partenaireType', f.partenaireType)
  if (f.since) params.set('since', f.since)
  if (f.until) params.set('until', f.until)
  if (f.dateField) params.set('dateField', f.dateField)
  if (f.search) params.set('search', f.search)
  if (f.limit) params.set('limit', String(f.limit))
  const s = params.toString()
  return s ? `?${s}` : ''
}

export const factures = {
  list(filter: FactureFilter = {}): Promise<{ count: number; factures: Facture[] }> {
    return request('GET', `/api/factures${buildFacturesQuery(filter)}`)
  },
  one(id: string): Promise<{ facture: Facture; dossier: unknown; client: unknown }> {
    return request('GET', `/api/factures/${encodeURIComponent(id)}`)
  },
  byDossier(dossierId: string): Promise<{ count: number; factures: Facture[] }> {
    return request('GET', `/api/factures/dossier/${encodeURIComponent(dossierId)}`)
  },
  stats(days = 90): Promise<FactureStats> {
    return request('GET', `/api/factures/stats?days=${days}`)
  },
  create(data: FactureCreate): Promise<{ facture: Facture }> {
    return request('POST', '/api/factures', data)
  },
  update(id: string, patch: Partial<FactureCreate> & { statut?: FactureStatut; regleeLe?: string | null; montantRegle?: number }): Promise<{ facture: Facture }> {
    return request('PATCH', `/api/factures/${encodeURIComponent(id)}`, patch)
  },
  cancel(id: string): Promise<{ ok: true }> {
    return request('DELETE', `/api/factures/${encodeURIComponent(id)}`)
  },
  regler(id: string, data: { regleeLe?: string; montantRegle?: number; modeReglement?: FactureModeReglement; numeroPiece?: string }): Promise<{ facture: Facture }> {
    return request('POST', `/api/factures/${encodeURIComponent(id)}/regler`, data)
  },
  avoir(id: string, data: { motif?: string; montantHt?: number }): Promise<{ avoir: Facture }> {
    return request('POST', `/api/factures/${encodeURIComponent(id)}/avoir`, data)
  },
}

/* ────────────────── Conformité IOBSP ────────────────── */

export type ConformiteCertifType = 'orias' | 'carte_pro' | 'rc_pro' | 'garantie_financiere' | 'capacite_pro' | 'autre'

export type ConformiteCertif = {
  id: string
  collaborateurId: string
  type: ConformiteCertifType
  libelle: string
  organismeEmetteur: string | null
  numero: string | null
  emiseLe: string | null
  valideDu: string | null
  expireLe: string | null
  /** Centimes */
  montantGarantie: number | null
  filename: string | null
  alerteJoursAvant: number
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type ConformiteFormationType = 'initiale' | 'continue' | 'thematique'

export type ConformiteFormation = {
  id: string
  collaborateurId: string
  titre: string
  organismeFormateur: string | null
  type: ConformiteFormationType
  theme: string | null
  dateDebut: string
  dateFin: string | null
  dureeHeures: number
  filename: string | null
  notes: string | null
  createdAt: string
}

export type ConformiteStatus = {
  collaborateurId: string
  score: number  // 0-100
  global: 'ok' | 'warn' | 'ko'
  certifs: Array<{
    id: string
    type: string
    libelle: string
    expireLe: string | null
    daysUntilExpire: number | null
    statut: 'ok' | 'alerte' | 'expire' | 'manquant'
  }>
  typesManquants: string[]
  formation: {
    heuresObligatoires: number
    heuresAnnee: number
    heuresAnneePrev: number
    anneeOk: boolean
    pourcentage: number
  }
  alertes: Array<{
    id: string
    type: string
    libelle: string
    expireLe: string | null
    daysUntilExpire: number | null
    statut: 'ok' | 'alerte' | 'expire' | 'manquant'
  }>
}

export const conformite = {
  listCertifs(collaborateurId?: string): Promise<{ certifs: ConformiteCertif[] }> {
    const q = collaborateurId ? `?collaborateurId=${encodeURIComponent(collaborateurId)}` : ''
    return request('GET', `/api/conformite/certifs${q}`)
  },
  createCertif(data: {
    collaborateurId?: string
    type: ConformiteCertifType
    libelle: string
    organismeEmetteur?: string | null
    numero?: string | null
    emiseLe?: string | null
    valideDu?: string | null
    expireLe?: string | null
    /** En EUR (pas centimes) */
    montantGarantie?: number | null
    alerteJoursAvant?: number
    notes?: string | null
  }): Promise<{ certif: ConformiteCertif }> {
    return request('POST', '/api/conformite/certifs', data)
  },
  updateCertif(id: string, patch: Partial<{
    libelle: string
    organismeEmetteur: string | null
    numero: string | null
    emiseLe: string | null
    valideDu: string | null
    expireLe: string | null
    montantGarantie: number | null
    alerteJoursAvant: number
    notes: string | null
  }>): Promise<{ certif: ConformiteCertif }> {
    return request('PATCH', `/api/conformite/certifs/${encodeURIComponent(id)}`, patch)
  },
  deleteCertif(id: string): Promise<{ ok: true }> {
    return request('DELETE', `/api/conformite/certifs/${encodeURIComponent(id)}`)
  },

  listFormations(collaborateurId?: string): Promise<{ formations: ConformiteFormation[] }> {
    const q = collaborateurId ? `?collaborateurId=${encodeURIComponent(collaborateurId)}` : ''
    return request('GET', `/api/conformite/formations${q}`)
  },
  createFormation(data: {
    collaborateurId?: string
    titre: string
    organismeFormateur?: string | null
    type?: ConformiteFormationType
    theme?: string | null
    dateDebut: string
    dateFin?: string | null
    dureeHeures: number
    notes?: string | null
  }): Promise<{ formation: ConformiteFormation }> {
    return request('POST', '/api/conformite/formations', data)
  },
  deleteFormation(id: string): Promise<{ ok: true }> {
    return request('DELETE', `/api/conformite/formations/${encodeURIComponent(id)}`)
  },
  status(collaborateurId?: string): Promise<ConformiteStatus> {
    const q = collaborateurId ? `?collaborateurId=${encodeURIComponent(collaborateurId)}` : ''
    return request('GET', `/api/conformite/status${q}`)
  },
}

/* ────────────────── Coworker (Claude conversationnel) ────────────────── */

export type CoworkerConversation = {
  id: string
  title: string
  cumulativeCostEur: number
  cumulativeTokensIn: number
  cumulativeTokensOut: number
  model: string
  createdAt: string
  updatedAt: string
}

export type CoworkerContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }

export type CoworkerMessage = {
  id: string
  conversationId: string
  seq: number
  role: 'user' | 'assistant' | 'tool'
  content: string | CoworkerContentBlock[] | { tool_use_id: string; content: string; is_error?: boolean }
  meta?: { model?: string; stopReason?: string | null; inputTokens?: number; outputTokens?: number; costEur?: number }
  createdAt: string
}

export type CoworkerSendResult = {
  ok: true
  reply: string
  blocks: CoworkerContentBlock[]
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number; costEur: number }
  model: string
  stopReason: string | null
}

export const coworker = {
  health(): Promise<{ configured: boolean; model: string; maxTokens: number; toolCount: number }> {
    return request('GET', '/api/coworker/health')
  },
  listConversations(archived = false): Promise<{ conversations: CoworkerConversation[] }> {
    return request('GET', `/api/coworker/conversations?archived=${archived ? 1 : 0}`)
  },
  createConversation(title?: string, contextSnapshot?: Record<string, unknown>): Promise<{ conversation: CoworkerConversation }> {
    return request('POST', '/api/coworker/conversations', { title, contextSnapshot })
  },
  getConversation(id: string): Promise<{ conversation: CoworkerConversation; messages: CoworkerMessage[] }> {
    return request('GET', `/api/coworker/conversations/${encodeURIComponent(id)}`)
  },
  archiveConversation(id: string): Promise<{ ok: true }> {
    return request('DELETE', `/api/coworker/conversations/${encodeURIComponent(id)}`)
  },
  sendMessage(id: string, text: string, uiContext?: Record<string, unknown>, maxLevel: 1 | 2 | 3 = 2): Promise<CoworkerSendResult> {
    return request('POST', `/api/coworker/conversations/${encodeURIComponent(id)}/messages`, { text, uiContext, maxLevel })
  },
  /**
   * Stream une réponse Polette en SSE.
   * Le callback `onEvent` reçoit chaque évènement parsé.
   * Le `signal` permet d'aborter (bouton Stop côté UI).
   */
  async streamMessage(
    id: string,
    text: string,
    opts: {
      uiContext?: Record<string, unknown>
      maxLevel?: 1 | 2 | 3
      signal?: AbortSignal
      onEvent: (e: CoworkerStreamEvent) => void
    },
  ): Promise<void> {
    const token = getToken()
    const base = (import.meta.env.VITE_API_BASE as string | undefined) || 'https://appli.apolline.groupe-apolline.eu'
    const res = await fetch(`${base}/api/coworker/conversations/${encodeURIComponent(id)}/messages/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text, uiContext: opts.uiContext, maxLevel: opts.maxLevel ?? 2 }),
      signal: opts.signal,
    })
    if (!res.ok || !res.body) {
      const txt = await res.text().catch(() => '')
      throw new ApiError(res.status, txt || null, `stream échoué (HTTP ${res.status})`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    // Parse SSE : `event: NAME\ndata: JSON\n\n`
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let sepIdx
      while ((sepIdx = buffer.indexOf('\n\n')) >= 0) {
        const chunk = buffer.slice(0, sepIdx)
        buffer = buffer.slice(sepIdx + 2)
        const lines = chunk.split('\n')
        let eventName = 'message'
        let dataStr = ''
        for (const line of lines) {
          if (line.startsWith('event:')) eventName = line.slice(6).trim()
          else if (line.startsWith('data:')) dataStr += line.slice(5).trim()
        }
        if (!dataStr) continue
        try {
          const data = JSON.parse(dataStr)
          opts.onEvent({ event: eventName, data } as CoworkerStreamEvent)
        } catch {
          // ignore malformed event
        }
      }
    }
  },
}

export type CoworkerStreamEvent =
  | { event: 'ready'; data: { convId: string } }
  | { event: 'text_delta'; data: { text: string } }
  | { event: 'tool_start'; data: { id: string; name: string; input: Record<string, unknown> } }
  | { event: 'tool_result'; data: { name: string; ok: boolean; summary: string } }
  | { event: 'usage'; data: { inputTokens: number; outputTokens: number; costEur: number } }
  | { event: 'done'; data: { messageId?: string; stopReason: string | null } }
  | { event: 'error'; data: { message: string } }

/* ────────────────── CRUD générique typé par nom de table ────────────────── */

type EntityName =
  | 'clients' | 'dossiers' | 'prets' | 'rdvs' | 'notes' | 'apporteurs'
  | 'banques' | 'commissions' | 'simulations' | 'templates'
  | 'notifications' | 'pieces' | 'collaborateurs'

export const api = {
  list<T = unknown>(name: EntityName): Promise<T[]> {
    return request('GET', `/api/${name}`)
  },
  one<T = unknown>(name: EntityName, id: string): Promise<T> {
    return request('GET', `/api/${name}/${encodeURIComponent(id)}`)
  },
  create<T = unknown>(name: EntityName, data: Record<string, unknown>): Promise<T> {
    return request('POST', `/api/${name}`, data)
  },
  update<T = unknown>(name: EntityName, id: string, patch: Record<string, unknown>): Promise<T> {
    return request('PATCH', `/api/${name}/${encodeURIComponent(id)}`, patch)
  },
  remove(name: EntityName, id: string): Promise<void> {
    return request('DELETE', `/api/${name}/${encodeURIComponent(id)}`)
  },
}

/* ────────────────── Realtime SSE ────────────────── */

type ChangeEvent = {
  table: EntityName
  action: 'create' | 'update' | 'delete'
  id: string
  userId?: string
}

class SyncManager {
  private es: EventSource | null = null
  private retryDelay = 1000
  private listeners: Array<(e: ChangeEvent) => void> = []
  /** True dès qu'on a réussi une 1ère connexion SSE. Sert à détecter une RE-connexion
   *  pour déclencher un pullAll de rattrapage (events ratés pendant la coupure). */
  private hasConnectedOnce = false

  start(): void {
    if (this.es) return
    const token = getToken()
    if (!token) {
      console.warn('[sync] pas de token — connexion SSE annulée')
      return
    }
    this.startWithFetch(`${API_BASE}/api/events`, token)
  }

  private async startWithFetch(url: string, token: string): Promise<void> {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
      })
      if (!res.ok || !res.body) {
        console.warn('[sync] échec connexion SSE', res.status)
        return this.scheduleRetry()
      }

      // Re-connexion (pas le tout 1er start) : pull complet pour rattraper
      // les events potentiellement ratés pendant la coupure réseau / mise en
      // veille du PC. Sans ça, un changement fait par un collaborateur pendant
      // la déconnexion n'arrive jamais sur le poste de Sébastien.
      if (this.hasConnectedOnce) {
        console.log('[sync] SSE reconnecté — pullAll de rattrapage')
        this.pullAll().catch((e) => console.warn('[sync] pullAll on reconnect failed', e))
      }
      this.hasConnectedOnce = true
      this.retryDelay = 1000 // reset backoff

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const blocks = buffer.split('\n\n')
        buffer = blocks.pop() ?? ''
        for (const block of blocks) {
          this.handleSseBlock(block)
        }
      }
      console.log('[sync] SSE fermé — reconnexion programmée')
      this.scheduleRetry()
    } catch (e) {
      console.warn('[sync] SSE error', e)
      this.scheduleRetry()
    }
  }

  private handleSseBlock(block: string) {
    let event = 'message'
    let data = ''
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data += line.slice(5).trim()
    }
    if (event === 'change' && data) {
      try {
        const change = JSON.parse(data) as ChangeEvent
        this.listeners.forEach((l) => l(change))
        this.applyToStore(change)
      } catch (e) {
        console.warn('[sync] payload illisible', data, e)
      }
    }
  }

  private scheduleRetry(): void {
    setTimeout(() => {
      this.es = null
      this.retryDelay = Math.min(this.retryDelay * 2, 30_000)
      this.start()
    }, this.retryDelay)
  }

  stop(): void {
    this.es?.close()
    this.es = null
  }

  on(listener: (e: ChangeEvent) => void): () => void {
    this.listeners.push(listener)
    return () => { this.listeners = this.listeners.filter((l) => l !== listener) }
  }

  /** Applique un event Graph au store Zustand local (refetch ciblé). */
  private async applyToStore(change: ChangeEvent): Promise<void> {
    try {
      switch (change.table) {
        case 'clients': await this.refresh('clients'); break
        case 'dossiers': await this.refresh('dossiers'); break
        case 'prets': await this.refresh('prets'); break
        case 'rdvs': await this.refresh('rdvs'); break
        case 'notes': await this.refresh('notes'); break
        case 'apporteurs': await this.refresh('apporteurs'); break
        case 'banques': await this.refresh('banques'); break
        case 'commissions': await this.refresh('commissions'); break
        case 'simulations': await this.refresh('simulations'); break
        case 'templates': await this.refresh('templates'); break
        case 'notifications': await this.refresh('notifications'); break
        case 'collaborateurs': await this.refresh('collaborateurs'); break
      }
    } catch (e) {
      console.warn('[sync] applyToStore failed', e)
    }
  }

  /** Recharge une entité complète depuis l'API et met à jour le store. */
  async refresh(name: EntityName): Promise<void> {
    const data = await api.list<Record<string, unknown>>(name)
    useStore.setState({ [name]: data } as never)
  }

  /**
   * Pull initial complet. Retourne un récap par table pour permettre un toast
   * informatif et détecter les échecs. Si une table échoue avec 401, on
   * propage l'erreur au caller pour qu'il déclenche un re-login.
   */
  async pullAll(): Promise<{ counts: Partial<Record<EntityName, number>>; errors: Array<{ table: EntityName; error: string; status?: number }> }> {
    const tables: EntityName[] = ['clients', 'dossiers', 'prets', 'rdvs', 'notes', 'apporteurs', 'banques', 'commissions', 'simulations', 'templates', 'notifications', 'collaborateurs']
    const counts: Partial<Record<EntityName, number>> = {}
    const errors: Array<{ table: EntityName; error: string; status?: number }> = []

    await Promise.all(tables.map(async (t) => {
      try {
        const data = await api.list<Record<string, unknown>>(t)
        counts[t] = Array.isArray(data) ? data.length : 0
        // Pour dossiers : ne pas écraser brutalement (cf. logique merge oneDrive*)
        // Mais ici on pull initial → on remplace direct comme avant.
        useStore.setState({ [t]: data } as never)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        const status = e instanceof ApiError ? e.status : undefined
        console.warn(`[sync] pull ${t} failed`, msg)
        errors.push({ table: t, error: msg, status })
      }
    }))

    return { counts, errors }
  }
}

export const sync = new SyncManager()

/* ────────────────── Write helpers (mirror local + API) ──────────────────
 *
 * Pattern : opt-in, à utiliser à la place des actions Zustand pour les call-sites
 * où on veut garantir la persistance backend. En mode offline (pas de token), ces
 * helpers retombent sur l'action locale équivalente — pas de breakage.
 *
 * Exemple :
 *   const newClient = await syncCreate('clients', formData)
 *   await syncUpdate('dossiers', dossierId, { statut: 'Signe' })
 *   await syncRemove('rdvs', rdvId)
 */

export const isOnline = (): boolean => !!getToken()

/**
 * Fire-and-forget : envoie une mutation au backend sans bloquer le store local.
 * Utilisé par les actions Zustand pour propager les changements vers le serveur
 * tout en gardant l'UI optimiste (l'action reste synchrone côté caller).
 *
 * En cas d'erreur, log un warning mais ne fait pas échouer l'action locale.
 */
export const mirror = {
  create(name: EntityName, data: Record<string, unknown>): void {
    if (!isOnline()) return
    api.create(name, data).catch((e) => console.warn(`[mirror] create ${name} failed`, e))
  },
  update(name: EntityName, id: string, patch: Record<string, unknown>): void {
    if (!isOnline()) return
    api.update(name, id, patch).catch((e) => console.warn(`[mirror] update ${name}/${id} failed`, e))
  },
  remove(name: EntityName, id: string): void {
    if (!isOnline()) return
    api.remove(name, id).catch((e) => console.warn(`[mirror] remove ${name}/${id} failed`, e))
  },
}

/**
 * Crée une entité côté backend (si online) puis met à jour le store local.
 * Retourne l'objet canonique (avec l'ID serveur).
 * En offline : fait juste l'insertion locale via l'action Zustand correspondante.
 */
export async function syncCreate<T extends Record<string, unknown>>(
  name: EntityName,
  data: Record<string, unknown>,
): Promise<T> {
  if (!isOnline()) {
    // Mode offline : laisse l'appelant gérer via l'action store classique
    throw new ApiError(0, null, 'syncCreate appelé en offline — utilisez l\'action store locale')
  }
  const created = await api.create<T>(name, data)
  // Met à jour le store immédiatement (sans attendre le SSE)
  useStore.setState((s) => {
    const list = (s as unknown as Record<string, unknown[]>)[name] ?? []
    return { [name]: [created, ...list] } as never
  })
  return created
}

export async function syncUpdate<T extends Record<string, unknown>>(
  name: EntityName,
  id: string,
  patch: Record<string, unknown>,
): Promise<T> {
  if (!isOnline()) {
    throw new ApiError(0, null, 'syncUpdate appelé en offline — utilisez l\'action store locale')
  }
  const updated = await api.update<T>(name, id, patch)
  useStore.setState((s) => {
    const list = ((s as unknown as Record<string, unknown[]>)[name] ?? []) as Array<{ id: string }>
    return {
      [name]: list.map((it) => it.id === id ? updated : it),
    } as never
  })
  return updated
}

export async function syncRemove(name: EntityName, id: string): Promise<void> {
  if (!isOnline()) {
    throw new ApiError(0, null, 'syncRemove appelé en offline — utilisez l\'action store locale')
  }
  await api.remove(name, id)
  useStore.setState((s) => {
    const list = ((s as unknown as Record<string, unknown[]>)[name] ?? []) as Array<{ id: string }>
    return { [name]: list.filter((it) => it.id !== id) } as never
  })
}
