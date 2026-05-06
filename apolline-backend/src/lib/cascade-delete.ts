/**
 * Cascade delete : supprime les ressources liées à un dossier ou client AU-DELÀ
 * de ce que le `ON DELETE CASCADE` Postgres fait.
 *
 * Concrètement, le filesystem (pièces uploadées) n'est pas géré par les FK.
 * Sans ce module, supprimer un dossier laisse des fichiers orphelins dans
 * `/var/lib/apolline/pieces/<dossier_id>/`.
 *
 * Doit être appelé AVANT le DELETE BDD pour garder la trace de ce qui était lié.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

const STORAGE_ROOT = process.env.PIECES_STORAGE_DIR ?? '/var/lib/apolline/pieces'

/**
 * Supprime tous les fichiers d'un dossier de courtage (le dossier filesystem
 * complet). Idempotent — pas d'erreur si le dossier n'existe pas.
 *
 * Retourne le nombre de fichiers supprimés (pour audit log).
 */
export async function purgeDossierFiles(dossierId: string): Promise<number> {
  if (!/^[0-9a-f-]{36}$/i.test(dossierId)) {
    throw new Error('dossierId invalide (UUID attendu)')
  }
  const dir = path.join(STORAGE_ROOT, dossierId)
  let count = 0
  try {
    const files = await fs.readdir(dir)
    count = files.length
    await fs.rm(dir, { recursive: true, force: true })
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`[cascade-delete] échec purge ${dir}`, e)
      throw e
    }
    // Dossier déjà absent → 0 fichier supprimé, pas une erreur
  }
  return count
}

/**
 * Supprime tous les fichiers de tous les dossiers d'un client.
 * Utile pour le DELETE client + le droit à l'effacement RGPD article 17.
 *
 * À appeler AVANT le DELETE BDD du client (pour pouvoir lister ses dossiers).
 */
export async function purgeClientFiles(clientId: string): Promise<{ dossiersConcernes: number; fichiersSupprimes: number }> {
  const dossiers = await db.select({ id: schema.dossiers.id })
    .from(schema.dossiers)
    .where(eq(schema.dossiers.clientId, clientId))

  let totalFiles = 0
  for (const d of dossiers) {
    totalFiles += await purgeDossierFiles(d.id).catch((e) => {
      console.warn(`[cascade-delete] dossier ${d.id} purge failed`, e)
      return 0
    })
  }
  return { dossiersConcernes: dossiers.length, fichiersSupprimes: totalFiles }
}
