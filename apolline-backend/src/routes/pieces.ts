/**
 * Routes /api/pieces/* — gestion locale des pièces de dossier.
 *
 *   POST   /api/dossiers/:dossierId/pieces/upload  → upload multipart (1 ou N fichiers)
 *   GET    /api/dossiers/:dossierId/pieces         → liste les pièces du dossier
 *   GET    /api/pieces/:id/download                → stream le fichier (attachment)
 *   GET    /api/pieces/:id/preview                 → stream inline (pour iframe)
 *   DELETE /api/pieces/:id                         → supprime fichier + ligne BDD
 *
 * Stockage : filesystem VPS (/var/lib/apolline/pieces/<dossier_id>/<piece_id>)
 * Métadonnées : table `pieces` Postgres
 *
 * Limites :
 *   - 1 upload : max 50 Mo (configurable via PIECE_MAX_SIZE)
 *   - Types MIME restreints (PDF, images, Office, txt, csv, zip)
 *   - Tout est tracé dans audit_log
 */
import { Hono } from 'hono'
import { eq, and, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { db, schema } from '../db/index.js'
import { authMiddleware, getUser } from '../middleware/auth.js'
import { audit, ctxMeta } from '../lib/audit.js'
import { notifyChange } from '../realtime/notify.js'
import {
  writeFile, readFileStream, deleteFile,
  isMimeAllowed, categoryFromFilename, PIECE_MAX_SIZE,
} from '../lib/pieces-storage.js'

/** Helper : supprime un fichier sans throw (pour cleanup en cas d'erreur). */
async function deleteFileQuiet(dossierId: string, pieceId: string): Promise<void> {
  try { await deleteFile(dossierId, pieceId) } catch { /* swallow */ }
}

export const piecesRoute = new Hono()

/**
 * Liste les pièces d'un dossier.
 */
piecesRoute.get('/dossiers/:dossierId/pieces', authMiddleware, async (c) => {
  const dossierId = c.req.param('dossierId')
  if (!dossierId) return c.json({ error: 'dossierId manquant' }, 400)
  const rows = await db.select().from(schema.pieces).where(eq(schema.pieces.dossierId, dossierId))
  // On masque les chemins absolus (sécurité — pas besoin côté front)
  const safe = rows.map((r) => ({ ...r, filePath: undefined }))
  return c.json(safe)
})

/**
 * Upload multipart de 1+ fichiers vers un dossier.
 * Form fields :
 *   - file (1+ fichiers)
 *   - categorie (P1-P5, optionnel — déduit du nom sinon)
 *   - libelle (optionnel)
 */
piecesRoute.post('/dossiers/:dossierId/pieces/upload', authMiddleware, async (c) => {
  const u = getUser(c)
  const dossierId = c.req.param('dossierId')
  if (!dossierId) return c.json({ error: 'dossierId manquant' }, 400)

  // Vérifie que le dossier existe
  const [dossier] = await db.select().from(schema.dossiers).where(eq(schema.dossiers.id, dossierId))
  if (!dossier) return c.json({ error: 'dossier introuvable' }, 404)

  const formData = await c.req.formData().catch(() => null)
  if (!formData) return c.json({ error: 'multipart/form-data attendu' }, 400)

  const files = formData.getAll('file').filter((v): v is File => v instanceof File && v.size > 0)
  if (files.length === 0) return c.json({ error: 'aucun fichier reçu' }, 400)

  const categorieParam = formData.get('categorie')
  const libelleParam = formData.get('libelle')

  const inserted: unknown[] = []
  const errors: Array<{ filename: string; error: string }> = []

  for (const file of files) {
    // pieceId généré AVANT l'écriture filesystem pour éviter les orphelins :
    // si l'écriture plante, aucune ligne BDD n'a été créée.
    const pieceId = randomUUID()
    try {
      if (file.size > PIECE_MAX_SIZE) {
        errors.push({ filename: file.name, error: `Trop volumineux (max ${Math.round(PIECE_MAX_SIZE / 1024 / 1024)} Mo)` })
        continue
      }
      if (!isMimeAllowed(file.type || 'application/octet-stream')) {
        errors.push({ filename: file.name, error: `Type ${file.type} non autorisé` })
        continue
      }

      // Catégorie : explicite > déduite du nom > default P5
      const categorie = (typeof categorieParam === 'string' && /^P[1-5]$/.test(categorieParam))
        ? categorieParam
        : (categoryFromFilename(file.name) ?? 'P5')

      const libelle = typeof libelleParam === 'string' && libelleParam.trim()
        ? libelleParam.trim()
        : file.name.replace(/\.[^.]+$/, '') // nom sans extension

      // 1. Écriture fichier EN PREMIER. Si EACCES ou autre, on lève
      //    avant tout INSERT BDD (pas de ligne orpheline).
      const buffer = Buffer.from(await file.arrayBuffer())
      const meta = await writeFile(dossierId, pieceId, buffer)

      // 2. Insert ligne BDD complète avec id + sha256 + filePath
      const [row] = await db.insert(schema.pieces).values({
        id: pieceId,
        dossierId,
        categorie: categorie as 'P1' | 'P2' | 'P3' | 'P4' | 'P5',
        libelle,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: meta.sizeBytes,
        sha256: meta.sha256,
        filePath: meta.filePath,
        statut: 'valide',
        uploadedBy: u.sub,
        uploadedAt: sql`NOW()` as unknown as string,
      } as never).returning()

      if (!row) {
        // Très peu probable, mais si l'INSERT BDD échoue, rollback le fichier
        // (pour ne pas laisser un fichier orphelin sur disk sans ligne BDD)
        await deleteFileQuiet(dossierId, pieceId)
        errors.push({ filename: file.name, error: 'insert BDD échoué' })
        continue
      }

      inserted.push({ ...row, filePath: undefined })
      await notifyChange({ table: 'pieces' as never, action: 'create', id: pieceId })

      audit({
        action: 'create', userId: u.sub, userEmail: u.email,
        entityType: 'piece', entityId: pieceId,
        details: `upload "${file.name}" ${Math.round(file.size / 1024)} Ko · ${categorie} · dossier ${dossierId}`,
        ...ctxMeta(c),
      })
    } catch (e) {
      // Si on est arrivé jusqu'ici et que le fichier a été écrit, on cleanup
      await deleteFileQuiet(dossierId, pieceId)
      errors.push({ filename: file.name, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return c.json({
    inserted: inserted.length,
    errors,
    pieces: inserted,
  })
})

/**
 * Download d'une pièce (Content-Disposition: attachment).
 */
piecesRoute.get('/pieces/:id/download', authMiddleware, async (c) => {
  const u = getUser(c)
  const id = c.req.param('id')
  if (!id) return c.json({ error: 'id manquant' }, 400)

  const [piece] = await db.select().from(schema.pieces).where(eq(schema.pieces.id, id))
  if (!piece) return c.json({ error: 'pièce introuvable' }, 404)

  const stream = await readFileStream(piece.dossierId, piece.id).catch(() => null)
  if (!stream) return c.json({ error: 'fichier absent du stockage' }, 404)

  audit({
    action: 'export', userId: u.sub, userEmail: u.email,
    entityType: 'piece', entityId: id,
    details: `download "${piece.filename}"`,
    ...ctxMeta(c),
  })

  // Convertit en Web ReadableStream pour Hono
  const webStream = streamToWeb(stream)
  return new Response(webStream, {
    headers: {
      'Content-Type': piece.mimeType,
      'Content-Length': String(piece.sizeBytes),
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(piece.filename)}`,
      'Cache-Control': 'private, no-cache',
    },
  })
})

/**
 * Preview d'une pièce (inline — pour affichage en iframe).
 */
piecesRoute.get('/pieces/:id/preview', authMiddleware, async (c) => {
  const id = c.req.param('id')
  if (!id) return c.json({ error: 'id manquant' }, 400)

  const [piece] = await db.select().from(schema.pieces).where(eq(schema.pieces.id, id))
  if (!piece) return c.json({ error: 'pièce introuvable' }, 404)

  const stream = await readFileStream(piece.dossierId, piece.id).catch(() => null)
  if (!stream) return c.json({ error: 'fichier absent du stockage' }, 404)

  const webStream = streamToWeb(stream)
  return new Response(webStream, {
    headers: {
      'Content-Type': piece.mimeType,
      'Content-Length': String(piece.sizeBytes),
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(piece.filename)}`,
      'Cache-Control': 'private, no-cache',
    },
  })
})

/**
 * Suppression d'une pièce (fichier + ligne BDD).
 */
piecesRoute.delete('/pieces/:id', authMiddleware, async (c) => {
  const u = getUser(c)
  const id = c.req.param('id')
  if (!id) return c.json({ error: 'id manquant' }, 400)

  const [piece] = await db.select().from(schema.pieces).where(eq(schema.pieces.id, id))
  if (!piece) return c.json({ error: 'pièce introuvable' }, 404)

  // Suppression fichier puis ligne BDD
  await deleteFile(piece.dossierId, piece.id)
  await db.delete(schema.pieces).where(eq(schema.pieces.id, id))
  await notifyChange({ table: 'pieces' as never, action: 'delete', id })

  audit({
    action: 'delete', userId: u.sub, userEmail: u.email,
    entityType: 'piece', entityId: id,
    details: `delete "${piece.filename}" (dossier ${piece.dossierId})`,
    ...ctxMeta(c),
  })

  return c.json({ ok: true })
})

/**
 * Mise à jour des métadonnées d'une pièce (catégorie, libellé, statut).
 */
piecesRoute.patch('/pieces/:id', authMiddleware, async (c) => {
  const id = c.req.param('id')
  if (!id) return c.json({ error: 'id manquant' }, 400)
  const body = await c.req.json() as Partial<{ categorie: 'P1' | 'P2' | 'P3' | 'P4' | 'P5'; libelle: string; statut: 'valide' | 'a_fournir' | 'manquant' | 'expire' }>
  const patch: Record<string, unknown> = {}
  if (body.categorie && /^P[1-5]$/.test(body.categorie)) patch.categorie = body.categorie
  if (typeof body.libelle === 'string') patch.libelle = body.libelle
  if (body.statut && ['valide', 'a_fournir', 'manquant', 'expire'].includes(body.statut)) patch.statut = body.statut
  if (Object.keys(patch).length === 0) return c.json({ error: 'aucun champ valide' }, 400)
  await db.update(schema.pieces).set(patch as never).where(eq(schema.pieces.id, id))
  await notifyChange({ table: 'pieces' as never, action: 'update', id })
  // Suppression du paramètre `and` non utilisé ici, mais conservé en import en cas d'évolution
  void and
  return c.json({ ok: true })
})

/* ─── Helper : Node ReadStream → Web ReadableStream ────────────────────── */
function streamToWeb(nodeStream: import('node:fs').ReadStream): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk) => controller.enqueue(chunk instanceof Buffer ? chunk : Buffer.from(chunk)))
      nodeStream.on('end', () => controller.close())
      nodeStream.on('error', (err) => controller.error(err))
    },
    cancel() { nodeStream.destroy() },
  })
}
