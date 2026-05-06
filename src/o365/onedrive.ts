/**
 * OneDrive (Microsoft Graph /me/drive).
 * Permissions : Files.Read minimum (déclaré dans SCOPES de msal.ts).
 *
 * Les "items" OneDrive représentent à la fois fichiers et dossiers — on
 * distingue via la présence de `folder` ou `file` dans le payload.
 */
import { getAccessToken } from './msal'
import { O365_CLIENT_ID, O365_TENANT_ID } from './config'

const GRAPH = 'https://graph.microsoft.com/v1.0'

export type DriveItem = {
  id: string
  name: string
  /** Présent si l'item est un fichier (mime, taille…). */
  file?: { mimeType: string; hashes?: { quickXorHash?: string; sha1Hash?: string } }
  /** Présent si l'item est un dossier (nombre d'enfants). */
  folder?: { childCount: number }
  size?: number
  webUrl?: string
  /** Référence du parent (path lisible). */
  parentReference?: { driveId?: string; id?: string; name?: string; path?: string }
  createdDateTime?: string
  lastModifiedDateTime?: string
  /** URL de download direct (présent uniquement quand on demande $select=@microsoft.graph.downloadUrl). */
  '@microsoft.graph.downloadUrl'?: string
  /**
   * Présent uniquement sur les items retournés par /me/drive/sharedWithMe.
   * Les vraies métadonnées (folder/file/id) sont DANS remoteItem, pas au niveau racine.
   */
  remoteItem?: {
    id: string
    name?: string
    file?: { mimeType: string }
    folder?: { childCount: number }
    size?: number
    webUrl?: string
    parentReference?: { driveId?: string; id?: string; name?: string; path?: string }
    createdDateTime?: string
    lastModifiedDateTime?: string
  }
}

/** Référence identifiant un item de drive (potentiellement dans un drive tiers). */
export type DriveItemRef = { id: string; driveId?: string }

/**
 * Pour un item donné (qu'il vienne du drive perso ou d'un partage), retourne
 * l'id et le driveId qu'il faut utiliser pour les appels Graph (children,
 * getItem, downloadUrl). Si l'item a un `remoteItem`, ses vraies coordonnées
 * sont là — le wrapper top-level n'est qu'un pointeur de partage.
 */
export function effectiveRef(item: DriveItem): DriveItemRef {
  if (item.remoteItem) {
    return {
      id: item.remoteItem.id,
      driveId: item.remoteItem.parentReference?.driveId,
    }
  }
  return { id: item.id, driveId: item.parentReference?.driveId }
}

async function authedFetch(url: string): Promise<Response> {
  const token = await getAccessToken(O365_CLIENT_ID, O365_TENANT_ID)
  if (!token) throw new Error('Non connecté à Microsoft 365')
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Graph drive ${res.status}: ${err.slice(0, 200)}`)
  }
  return res
}

async function fetchAllPages<T>(initialUrl: string): Promise<T[]> {
  const out: T[] = []
  let nextUrl: string | undefined = initialUrl
  while (nextUrl) {
    const res = await authedFetch(nextUrl)
    const json = (await res.json()) as { value: T[]; '@odata.nextLink'?: string }
    out.push(...json.value)
    nextUrl = json['@odata.nextLink']
  }
  return out
}

/** Liste les items à la racine du OneDrive de l'utilisateur. */
export async function listRoot(): Promise<DriveItem[]> {
  return fetchAllPages<DriveItem>(`${GRAPH}/me/drive/root/children?$top=200&$orderby=name`)
}

/**
 * Liste les items partagés AVEC l'utilisateur (par d'autres collaborateurs ou via SharePoint).
 * Les items renvoyés ont un `remoteItem` : leurs vraies métadonnées sont dans ce champ.
 * Trier par nom n'est pas supporté par l'API → on trie côté client après réception.
 */
export async function listSharedWithMe(): Promise<DriveItem[]> {
  const items = await fetchAllPages<DriveItem>(`${GRAPH}/me/drive/sharedWithMe?$top=200`)
  return items.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'fr', { sensitivity: 'base' }))
}

/**
 * Liste les enfants d'un dossier (fichiers + sous-dossiers).
 * Si `driveId` est fourni, on cible un drive tiers (cas des dossiers partagés
 * qui appartiennent à un autre OneDrive ou à une bibliothèque SharePoint).
 */
export async function listChildren(itemId: string, driveId?: string): Promise<DriveItem[]> {
  const base = driveId
    ? `${GRAPH}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/children`
    : `${GRAPH}/me/drive/items/${encodeURIComponent(itemId)}/children`
  return fetchAllPages<DriveItem>(`${base}?$top=200&$orderby=name`)
}

/** Récupère les métadonnées d'un item (fichier ou dossier). */
export async function getItem(itemId: string, driveId?: string): Promise<DriveItem> {
  const base = driveId
    ? `${GRAPH}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`
    : `${GRAPH}/me/drive/items/${encodeURIComponent(itemId)}`
  const res = await authedFetch(base)
  return res.json()
}

/**
 * Recherche fulltext dans tout le OneDrive. Limité à 50 résultats.
 * Utile pour retrouver "Dupont" dans une arborescence profonde.
 */
export async function search(query: string): Promise<DriveItem[]> {
  if (!query.trim()) return []
  const res = await authedFetch(
    `${GRAPH}/me/drive/root/search(q='${encodeURIComponent(query.trim())}')?$top=50`,
  )
  const json = (await res.json()) as { value: DriveItem[] }
  return json.value
}

/**
 * URL pré-signée pour télécharger directement un fichier (valable ~1h).
 * Permet d'ouvrir/télécharger sans renvoyer le token Bearer.
 */
export async function getDownloadUrl(itemId: string, driveId?: string): Promise<string | null> {
  const base = driveId
    ? `${GRAPH}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`
    : `${GRAPH}/me/drive/items/${encodeURIComponent(itemId)}`
  const res = await authedFetch(`${base}?$select=id,name,@microsoft.graph.downloadUrl`)
  const json = (await res.json()) as DriveItem
  return json['@microsoft.graph.downloadUrl'] ?? null
}

/** Helper : true si l'item est un dossier (couvre les items partagés via remoteItem). */
export function isFolder(item: DriveItem): boolean {
  return !!(item.folder ?? item.remoteItem?.folder)
}

/**
 * Reconstitue un chemin lisible "/Apolline/Dossiers/Bernard Sébastien" à partir
 * d'un DriveItem (utilise parentReference.path). Gère aussi les items partagés
 * dont le path réel est dans remoteItem.parentReference.
 */
export function pathOf(item: DriveItem): string {
  const ref = item.remoteItem?.parentReference ?? item.parentReference
  const raw = ref?.path ?? ''
  // Format Graph : "/drive/root:/Apolline/Dossiers" → on garde après "root:"
  const m = raw.match(/^.*root:(.*)$/)
  const parent = m ? m[1] : ''
  return `${parent}/${item.name}`.replace(/\/+/g, '/')
}

/** Date de dernière modif (couvre les items partagés via remoteItem). */
export function lastModifiedOf(item: DriveItem): string | undefined {
  return item.lastModifiedDateTime ?? item.remoteItem?.lastModifiedDateTime
}

/** Taille (couvre les items partagés via remoteItem). */
export function sizeOf(item: DriveItem): number | undefined {
  return item.size ?? item.remoteItem?.size
}

/** WebUrl (couvre les items partagés via remoteItem). */
export function webUrlOf(item: DriveItem): string | undefined {
  return item.webUrl ?? item.remoteItem?.webUrl
}

/** Compteur d'enfants pour un dossier (couvre remoteItem). */
export function childCountOf(item: DriveItem): number | undefined {
  return item.folder?.childCount ?? item.remoteItem?.folder?.childCount
}

/** Formatage taille de fichier en Ko/Mo. */
export function formatSize(bytes: number | undefined): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

export type PieceCategorie = 'P1' | 'P2' | 'P3' | 'P4' | 'P5'

/**
 * Détecte la catégorie P1-P5 depuis le préfixe du nom de fichier.
 *
 * Tolère plusieurs conventions usuelles :
 *   - `P1_CNI_DUMAS.pdf` (convention historique Apolline)
 *   - `P1-CNI-DUMAS.pdf`
 *   - `P1 CNI DUMAS.pdf`
 *   - `P1.CNI.pdf`
 *   - `P1CNI.pdf` (sans séparateur)
 *   - `P1.pdf` (= juste la catégorie)
 *   - `1_CNI.pdf` ou `1 - CNI.pdf` (préfixe numérique sans P)
 *   - tolère espaces / accents en début de nom
 *
 * Stratégie : on lit les caractères en début de nom (après trim et après
 * éventuels espaces/dots), et si on trouve un chiffre 1-5 isolé (pas
 * collé à un autre chiffre, pour éviter de matcher "12_xxx" ou "2026_xxx"),
 * on retient cette catégorie.
 */
export function categoryFromFilename(name: string): PieceCategorie | null {
  const trimmed = name.trim()
  // 1) Préfixe avec "P" explicite : P1, P-1, P 1, etc., suivi de quoi que
  //    ce soit qui n'est pas un autre chiffre (sinon "P12" matcherait P1).
  const withP = trimmed.match(/^P\s*[_\-.\s]?\s*([1-5])(?!\d)/i)
  if (withP) return `P${withP[1]}` as PieceCategorie
  // 2) Préfixe numérique brut : "1_CNI", "1 - CNI"… mais SEULEMENT si suivi
  //    d'un séparateur explicite (_, -, espace, .) — sinon on risque de
  //    matcher un fichier banal qui commence par un chiffre.
  const withoutP = trimmed.match(/^([1-5])[_\-\s.]/)
  if (withoutP) return `P${withoutP[1]}` as PieceCategorie
  return null
}
