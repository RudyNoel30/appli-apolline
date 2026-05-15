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
  recomputePiecesCount,
} from '../lib/pieces-storage.js'
import {
  classifyDocument, extractDocument, isExtractionAvailable,
} from '../lib/extraction/engine.js'
import type { ExtractionType } from '../lib/extraction/prompts.js'

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

  // Recompte piecesFournies au dossier (atomique) après tous les inserts.
  // Met aussi à jour le row du dossier dans le store via notifyChange.
  if (inserted.length > 0) {
    await recomputePiecesCount(dossierId).catch((e) => {
      console.warn('[pieces] recomputePiecesCount upload échec', e)
    })
    await notifyChange({ table: 'dossiers' as never, action: 'update', id: dossierId })
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

  // Décrémente le compteur dossier (recompute atomique = pas de désynchro)
  await recomputePiecesCount(piece.dossierId).catch((e) => {
    console.warn('[pieces] recomputePiecesCount delete échec', e)
  })
  await notifyChange({ table: 'dossiers' as never, action: 'update', id: piece.dossierId })

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

// ─────────────────────────────────────────────────────────────────────────────
// OCR / Extraction automatique (Phase 1) — bulletin_salaire + avis_imposition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lance l'extraction OCR + structuration d'une pièce.
 * Body optionnel : { type?: ExtractionType, autoClassify?: boolean }
 *   - Si type fourni → on l'utilise directement
 *   - Sinon (ou autoClassify=true) → on classifie d'abord puis on extrait
 */
piecesRoute.post('/pieces/:id/extract', authMiddleware, async (c) => {
  const u = getUser(c)
  const id = c.req.param('id')
  if (!id) return c.json({ error: 'id manquant' }, 400)
  if (!isExtractionAvailable()) {
    return c.json({ error: 'Extraction indisponible — ANTHROPIC_API_KEY non configurée côté backend' }, 503)
  }

  const [piece] = await db.select().from(schema.pieces).where(eq(schema.pieces.id, id))
  if (!piece) return c.json({ error: 'pièce introuvable' }, 404)

  const body = await c.req.json().catch(() => ({})) as { type?: string; autoClassify?: boolean }

  // 1. Détermine le type cible
  let targetType: ExtractionType
  if (body.type && ['bulletin_salaire', 'avis_imposition', 'rib', 'cni', 'justif_domicile', 'compromis', 'dpe', 'autre'].includes(body.type)) {
    targetType = body.type as ExtractionType
  } else {
    // Marque la pièce en cours de classification (UX feedback côté front)
    await db.update(schema.pieces)
      .set({ extractionStatus: 'processing' } as never)
      .where(eq(schema.pieces.id, id))
    const cls = await classifyDocument(piece.dossierId, piece.id, piece.mimeType)
    targetType = cls.type
    if (cls.type === 'autre') {
      // Pas la peine d'extraire un document inconnu — on stoppe ici avec un statut "failed"
      await db.update(schema.pieces).set({
        extractionStatus: 'failed',
        extractionType: 'autre',
        extractionError: `Type non reconnu (${cls.reason || 'classification incertaine'})`,
        extractedAt: sql`NOW()` as unknown as string,
      } as never).where(eq(schema.pieces.id, id))
      return c.json({
        ok: false,
        status: 'failed',
        type: 'autre',
        error: cls.reason || 'Type non reconnu',
      })
    }
  }

  // 2. Marque processing + sauve le type détecté
  await db.update(schema.pieces).set({
    extractionStatus: 'processing',
    extractionType: targetType,
  } as never).where(eq(schema.pieces.id, id))

  // 3. Extraction Claude
  const result = await extractDocument(piece.dossierId, piece.id, piece.mimeType, targetType)

  // 4. Persist résultat
  if (result.status === 'completed') {
    await db.update(schema.pieces).set({
      extractionStatus: 'completed',
      extractionType: result.type,
      extractedData: result.data as never,
      extractionConfidence: result.confidence,
      extractionError: null,
      extractedAt: sql`NOW()` as unknown as string,
    } as never).where(eq(schema.pieces.id, id))
  } else {
    await db.update(schema.pieces).set({
      extractionStatus: 'failed',
      extractionType: result.type,
      extractionError: result.error ?? 'Erreur inconnue',
      extractedAt: sql`NOW()` as unknown as string,
    } as never).where(eq(schema.pieces.id, id))
  }

  await notifyChange({ table: 'pieces' as never, action: 'update', id })
  audit({
    action: 'update', userId: u.sub, userEmail: u.email,
    entityType: 'piece', entityId: id,
    details: `extraction ${targetType} · ${result.status} · confidence=${result.confidence.toFixed(2)} · coût ≈ ${result.usage.estimatedCostEur}€`,
    ...ctxMeta(c),
  })

  return c.json({
    ok: result.status === 'completed',
    status: result.status,
    type: result.type,
    data: result.data,
    confidence: result.confidence,
    error: result.error,
    usage: result.usage,
  })
})

/**
 * Applique les données extraites au dossier / client.
 * Body : { fields: { [path: string]: value } }
 *   - path est une chaîne dot-notation (ex: "client.emprunteur1.revenuMensuelNet")
 *   - Le front choisit quels champs il veut appliquer (peut rejeter ou corriger)
 *
 * Met aussi le statut extraction_status à 'applied'.
 */
piecesRoute.post('/pieces/:id/apply-extraction', authMiddleware, async (c) => {
  const u = getUser(c)
  const id = c.req.param('id')
  if (!id) return c.json({ error: 'id manquant' }, 400)

  const [piece] = await db.select().from(schema.pieces).where(eq(schema.pieces.id, id))
  if (!piece) return c.json({ error: 'pièce introuvable' }, 404)
  if (piece.extractionStatus !== 'completed' && piece.extractionStatus !== 'applied') {
    return c.json({ error: `extraction non disponible (statut: ${piece.extractionStatus ?? 'aucun'})` }, 400)
  }

  const body = await c.req.json().catch(() => null) as {
    dossierPatch?: Record<string, unknown>
    clientPatch?: Record<string, unknown>
  } | null
  if (!body) return c.json({ error: 'body JSON requis' }, 400)

  // Charge dossier + client
  const [dossier] = await db.select().from(schema.dossiers).where(eq(schema.dossiers.id, piece.dossierId))
  if (!dossier) return c.json({ error: 'dossier introuvable' }, 404)

  // Applique les patches
  if (body.dossierPatch && Object.keys(body.dossierPatch).length > 0) {
    await db.update(schema.dossiers)
      .set(body.dossierPatch as never)
      .where(eq(schema.dossiers.id, piece.dossierId))
    await notifyChange({ table: 'dossiers' as never, action: 'update', id: piece.dossierId })
  }
  if (body.clientPatch && Object.keys(body.clientPatch).length > 0 && dossier.clientId) {
    await db.update(schema.clients)
      .set(body.clientPatch as never)
      .where(eq(schema.clients.id, dossier.clientId))
    await notifyChange({ table: 'clients' as never, action: 'update', id: dossier.clientId })
  }

  // Marque la pièce comme appliquée
  await db.update(schema.pieces).set({
    extractionStatus: 'applied',
    appliedAt: sql`NOW()` as unknown as string,
    appliedBy: u.sub,
  } as never).where(eq(schema.pieces.id, id))

  audit({
    action: 'update', userId: u.sub, userEmail: u.email,
    entityType: 'piece', entityId: id,
    details: `extraction appliquée au dossier ${piece.dossierId}`,
    ...ctxMeta(c),
  })

  return c.json({ ok: true })
})

/**
 * Rejette une extraction (le user a vu le résultat et ne veut pas l'appliquer).
 * Garde la trace pour audit, mais désactive l'overlay côté UI.
 */
piecesRoute.post('/pieces/:id/reject-extraction', authMiddleware, async (c) => {
  const u = getUser(c)
  const id = c.req.param('id')
  if (!id) return c.json({ error: 'id manquant' }, 400)

  await db.update(schema.pieces).set({
    extractionStatus: 'rejected',
  } as never).where(eq(schema.pieces.id, id))

  audit({
    action: 'update', userId: u.sub, userEmail: u.email,
    entityType: 'piece', entityId: id,
    details: 'extraction rejetée par utilisateur',
    ...ctxMeta(c),
  })

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
