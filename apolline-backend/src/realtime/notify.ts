/**
 * Émet une notification PostgreSQL pour propager un changement à tous les clients SSE.
 * Format du payload : { table, action, id, userId? }
 *
 * Postgres limite NOTIFY à 8000 octets. On envoie donc seulement l'identifiant de la
 * ressource — chaque client refait un GET pour récupérer la version fraîche.
 */
import { pool } from '../db/index.js'

export type ChangeAction = 'create' | 'update' | 'delete'

export type ChangeEvent = {
  table: string
  action: ChangeAction
  id: string
  userId?: string                                        // pour scope notif perso
}

const CHANNEL = 'apolline_changes'

export async function notifyChange(event: ChangeEvent): Promise<void> {
  const payload = JSON.stringify(event)
  // Échappe les apostrophes pour SQL litéral (NOTIFY n'accepte pas les params $1)
  const safe = payload.replace(/'/g, "''")
  await pool.query(`NOTIFY ${CHANNEL}, '${safe}'`)
}
