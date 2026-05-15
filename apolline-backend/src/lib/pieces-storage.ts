/**
 * Stockage des pièces de courtage sur le filesystem du VPS.
 *
 * Layout : /var/lib/apolline/pieces/<dossier_id>/<piece_id>
 *  - 1 dossier par dossier de courtage
 *  - 1 fichier par pièce, nommé par son UUID (le filename original est en BDD)
 *
 * À configurer côté VPS (1 fois) :
 *   sudo mkdir -p /var/lib/apolline/pieces
 *   sudo chown -R apolline:apolline /var/lib/apolline/pieces
 *   (ou le user qui fait tourner le backend)
 *
 * Backup : ajouter ce dossier dans /usr/local/bin/apolline-backup.sh
 *   tar czf "$BACKUP_DIR/pieces-$TIMESTAMP.tar.gz" /var/lib/apolline/pieces
 */
import { promises as fs, createReadStream, type ReadStream } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { sql, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

const STORAGE_ROOT = process.env.PIECES_STORAGE_DIR ?? '/var/lib/apolline/pieces'

export const PIECE_MAX_SIZE = Number(process.env.PIECE_MAX_SIZE ?? '52428800') // 50 Mo par défaut

/** Type MIME autorisés. Restrictif pour éviter les exécutables. */
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/heic', 'image/webp', 'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'application/zip',
])

export function isMimeAllowed(mime: string): boolean {
  return ALLOWED_MIME.has(mime)
}

export function pathFor(dossierId: string, pieceId: string): string {
  // Sanity check : pas de '..' ni de slashes dans les IDs (UUID seul accepté)
  if (!/^[0-9a-f-]{36}$/i.test(dossierId)) throw new Error('dossierId invalide')
  if (!/^[0-9a-f-]{36}$/i.test(pieceId)) throw new Error('pieceId invalide')
  return path.join(STORAGE_ROOT, dossierId, pieceId)
}

export async function ensureDossierDir(dossierId: string): Promise<string> {
  if (!/^[0-9a-f-]{36}$/i.test(dossierId)) throw new Error('dossierId invalide')
  const dir = path.join(STORAGE_ROOT, dossierId)
  await fs.mkdir(dir, { recursive: true, mode: 0o700 })
  return dir
}

/**
 * Écrit un buffer vers le filesystem et retourne les métadonnées.
 * - Calcule le sha256
 * - Sécurise les permissions (0600)
 */
export async function writeFile(dossierId: string, pieceId: string, buffer: Buffer): Promise<{ sha256: string; sizeBytes: number; filePath: string }> {
  await ensureDossierDir(dossierId)
  const filePath = pathFor(dossierId, pieceId)
  const sha256 = createHash('sha256').update(buffer).digest('hex')
  await fs.writeFile(filePath, buffer, { mode: 0o600 })
  return { sha256, sizeBytes: buffer.length, filePath }
}

export async function readFileStream(dossierId: string, pieceId: string): Promise<ReadStream> {
  const filePath = pathFor(dossierId, pieceId)
  await fs.access(filePath) // throw si introuvable
  return createReadStream(filePath)
}

export async function deleteFile(dossierId: string, pieceId: string): Promise<void> {
  const filePath = pathFor(dossierId, pieceId)
  try {
    await fs.unlink(filePath)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
    // Si le fichier n'existe pas, on log mais on ne bloque pas (la ligne BDD doit pouvoir être supprimée)
    console.warn(`[pieces-storage] fichier déjà absent : ${filePath}`)
  }
}

/**
 * Recompte le nombre de pièces réellement présentes en BDD pour ce dossier et
 * met à jour `dossiers.piecesFournies` en conséquence (atomique via COUNT(*)
 * dans le UPDATE — pas de race condition possible).
 *
 * À appeler après chaque INSERT / DELETE / mise à jour pieces. Idempotent.
 *
 * Le compteur `piecesTotal` n'est PAS touché — il représente la convention
 * métier (24 pièces non optionnelles côté front, ou ce que le user a paramétré).
 * Si dossier.piecesTotal vaut 0 (jamais initialisé), on le règle au défaut 24
 * pour que le ratio fourni/total soit affichable d'office.
 */
export async function recomputePiecesCount(dossierId: string): Promise<{ piecesFournies: number; piecesTotal: number }> {
  // 1. UPDATE atomique du compteur fournies depuis le COUNT réel
  const updated = await db
    .update(schema.dossiers)
    .set({
      piecesFournies: sql`(SELECT COUNT(*)::int FROM pieces WHERE dossier_id = ${dossierId})`,
      // Si piecesTotal n'a jamais été défini (vaut 0), on initialise à 24
      // (= nombre de pièces non optionnelles dans la convention Apolline)
      piecesTotal: sql`CASE WHEN dossiers.pieces_total = 0 THEN 24 ELSE dossiers.pieces_total END`,
    })
    .where(eq(schema.dossiers.id, dossierId))
    .returning({
      piecesFournies: schema.dossiers.piecesFournies,
      piecesTotal: schema.dossiers.piecesTotal,
    })
  const row = updated[0]
  return {
    piecesFournies: row?.piecesFournies ?? 0,
    piecesTotal: row?.piecesTotal ?? 24,
  }
}

/**
 * Détermine la catégorie P1-P5 depuis le nom du fichier (préfixe convention Apolline).
 */
export function categoryFromFilename(name: string): 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | null {
  const m = name.trim().match(/^P\s*[_\-.\s]?\s*([1-5])(?!\d)/i)
  if (m) return `P${m[1]}` as 'P1' | 'P2' | 'P3' | 'P4' | 'P5'
  const m2 = name.trim().match(/^([1-5])[_\-\s.]/)
  if (m2) return `P${m2[1]}` as 'P1' | 'P2' | 'P3' | 'P4' | 'P5'
  return null
}
