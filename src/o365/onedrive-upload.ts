/**
 * Upload de fichiers vers OneDrive via Microsoft Graph.
 *
 * Pour des fichiers < 4 Mo : PUT direct vers /content (1 requête).
 * Pour des fichiers plus gros : upload session (à implémenter — pas urgent
 * pour les pièces de courtage qui sont quasi toutes des PDF < 4 Mo).
 */
import { getAccessToken } from './msal'
import { O365_CLIENT_ID, O365_TENANT_ID } from './config'

const GRAPH = 'https://graph.microsoft.com/v1.0'

/**
 * Upload un fichier dans un folder donné (par son ID Graph).
 * `driveId` est obligatoire si le folder est partagé (pas dans /me/drive).
 *
 * Stratégie : PUT direct sur l'endpoint enfant du folder. Le nom de fichier
 * est encodé dans l'URL — Graph crée le fichier (ou écrase s'il existe déjà).
 */
export async function uploadFile(
  folderId: string,
  filename: string,
  content: ArrayBuffer | Blob,
  driveId?: string,
): Promise<{ id: string; webUrl: string; name: string }> {
  const token = await getAccessToken(O365_CLIENT_ID, O365_TENANT_ID)
  if (!token) throw new Error('Non connecté à Microsoft 365')

  const base = driveId
    ? `${GRAPH}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(folderId)}`
    : `${GRAPH}/me/drive/items/${encodeURIComponent(folderId)}`
  // `:/<filename>:/content` permet de référencer un fichier par nom dans le folder
  const url = `${base}:/${encodeURIComponent(filename)}:/content`

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
    },
    body: content,
  })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Graph upload ${res.status}: ${err.slice(0, 300)}`)
  }
  const json = await res.json() as { id: string; webUrl: string; name: string }
  return json
}
