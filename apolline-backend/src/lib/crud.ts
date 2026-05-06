/**
 * Factory CRUD générique pour Drizzle + Hono.
 * Génère 5 endpoints standards :
 *   GET    /         → list
 *   GET    /:id      → one
 *   POST   /         → create
 *   PATCH  /:id      → update partiel
 *   DELETE /:id      → delete
 *
 * Émet un NOTIFY après chaque mutation pour le realtime SSE.
 *
 * Usage :
 *   const r = crudRoute({ table: schema.clients, name: 'clients', idType: 'uuid' })
 *   app.route('/api/clients', r)
 */
import { Hono } from 'hono'
import type { Context } from 'hono'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { notifyChange } from '../realtime/notify.js'
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core'

type IdType = 'uuid' | 'text'

type CrudOptions = {
  table: PgTable & { id: PgColumn }
  name: string                                          // utilisé pour le channel NOTIFY
  idType?: IdType                                       // 'uuid' (par défaut) ou 'text'
  /** Optionnel : transform avant insertion (ex: hash de mot de passe). */
  beforeInsert?: (data: Record<string, unknown>) => Promise<Record<string, unknown>>
  beforeUpdate?: (data: Record<string, unknown>, id: string) => Promise<Record<string, unknown>>
  /**
   * Optionnel : hook AVANT le DELETE BDD (utilisé pour cascade filesystem).
   * Reçoit l'ID à supprimer ; retourne (optionnel) une string descriptive
   * loguée dans audit_log details.
   */
  beforeDelete?: (id: string) => Promise<string | void>
  /** Optionnel : filtre les champs renvoyés au client (ex: cacher passwordHash). */
  serialize?: (row: Record<string, unknown>) => Record<string, unknown>
}

export function crudRoute(opts: CrudOptions): Hono {
  const router = new Hono()
  router.use('*', authMiddleware)

  const idCol = opts.table.id
  const ser = opts.serialize ?? ((r: Record<string, unknown>) => r)

  // GET / → liste tout
  router.get('/', async (c) => {
    const rows = await db.select().from(opts.table)
    return c.json(rows.map(ser))
  })

  // GET /:id
  router.get('/:id', async (c) => {
    const id = c.req.param('id')
    const [row] = await db.select().from(opts.table).where(eq(idCol, id))
    if (!row) return c.json({ error: 'not found' }, 404)
    return c.json(ser(row as Record<string, unknown>))
  })

  // POST / → create
  router.post('/', async (c) => {
    let body = await c.req.json() as Record<string, unknown>
    if (opts.beforeInsert) body = await opts.beforeInsert(body)
    body = sanitizeForInsert(body, opts.idType ?? 'uuid')
    const [created] = await db.insert(opts.table).values(body as never).returning()
    if (created) {
      await notifyChange({ table: opts.name, action: 'create', id: String((created as Record<string, unknown>).id) })
    }
    return c.json(ser(created as Record<string, unknown>), 201)
  })

  // PATCH /:id → update partiel
  router.patch('/:id', async (c) => {
    const id = c.req.param('id')
    let body = await c.req.json() as Record<string, unknown>
    if (opts.beforeUpdate) body = await opts.beforeUpdate(body, id)
    body = sanitizeForInsert(body, opts.idType ?? 'uuid')
    delete body.id
    // updated_at force-set à NOW pour déclencher les triggers / cache invalidation
    const updateValues = { ...body, updatedAt: sql`NOW()` }
    const [updated] = await db.update(opts.table)
      .set(updateValues as never)
      .where(eq(idCol, id))
      .returning()
    if (!updated) return c.json({ error: 'not found' }, 404)
    await notifyChange({ table: opts.name, action: 'update', id })
    return c.json(ser(updated as Record<string, unknown>))
  })

  // DELETE /:id
  router.delete('/:id', async (c) => {
    const id = c.req.param('id')
    // Hook beforeDelete : permet de purger des ressources externes
    // (filesystem, autres BDD) AVANT le delete cascade Postgres.
    let beforeMsg: string | void = undefined
    if (opts.beforeDelete) {
      try {
        beforeMsg = await opts.beforeDelete(id)
      } catch (e) {
        console.warn(`[crud] beforeDelete ${opts.name}/${id} failed`, e)
        // On continue quand même : la BDD reste cohérente même si le hook
        // a partiellement échoué (mieux que de bloquer la suppression).
      }
    }
    const [deleted] = await db.delete(opts.table).where(eq(idCol, id)).returning()
    if (!deleted) return c.json({ error: 'not found' }, 404)
    await notifyChange({ table: opts.name, action: 'delete', id })
    // Audit log : la suppression est l'action la plus sensible (potentielle
    // perte de données, contestable client). On enregistre qui/quoi/quand.
    try {
      const { audit, ctxMeta } = await import('./audit.js')
      const { getUser } = await import('../middleware/auth.js')
      const u = (() => { try { return getUser(c) } catch { return null } })()
      audit({
        action: 'delete', entityType: opts.name, entityId: id,
        userId: u?.sub, userEmail: u?.email,
        details: `delete ${opts.name}/${id}${beforeMsg ? ` · ${beforeMsg}` : ''}`,
        ...ctxMeta(c),
      })
    } catch { /* swallow, l'audit ne doit pas casser le delete */ }
    return c.json({ ok: true })
  })

  return router
}

/** Helper pour parser un body JSON Zod-validé (optionnel, à utiliser dans les routes custom). */
export async function parseJson<T>(c: Context, schema: { parse: (d: unknown) => T }): Promise<T> {
  const data = await c.req.json()
  return schema.parse(data)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Nettoie un body avant insertion/update :
 *  - Strip les champs legacy non mappés au schéma PG (dossierIds, motDePasse…)
 *  - Strip les timestamps gérés par PG (createdAt, updatedAt)
 *  - Si idType=uuid et que l'id fourni n'est pas un UUID valide → strip pour
 *    laisser PG en générer un nouveau (évite "invalid input syntax for type uuid")
 *  - Strip les FK uuid non-UUID (apporteurId='Axxx', clientId='Cxxx', etc.)
 *  - Strip les "" sur les FK uuid (Drizzle tente la cast et échoue)
 */
function sanitizeForInsert(body: Record<string, unknown>, idType: 'uuid' | 'text'): Record<string, unknown> {
  const out: Record<string, unknown> = { ...body }

  // PG-managed timestamps
  delete out.createdAt
  delete out.updatedAt

  // Legacy fields qui n'existent pas dans le schéma
  delete out.dossierIds
  delete out.motDePasse           // côté collaborateurs : remplacé par passwordHash via beforeInsert

  // ID : si type uuid et valeur non-UUID → laisse PG générer
  if (idType === 'uuid' && typeof out.id === 'string' && !UUID_RE.test(out.id)) {
    delete out.id
  }

  // FK UUID : strip valeurs non-UUID ou chaîne vide
  // Exceptions : ids qui finissent en `Id` mais ne sont PAS des UUID Postgres
  // (id externe, identifiant Graph Microsoft, etc.) — on ne les touche pas.
  const ID_EXCEPTIONS = new Set([
    'graphId',           // Microsoft Graph (events, mails) — id alphanumérique
    'legacyId',          // Compat Cifacil — id court 'D001'
    'oneDriveFolderId',  // Microsoft Graph drive item id
    'oneDriveDriveId',   // Microsoft Graph drive id
  ])
  for (const key of Object.keys(out)) {
    if (!key.endsWith('Id') || ID_EXCEPTIONS.has(key)) continue
    const v = out[key]
    if (v === '' || v === null) {
      out[key] = null
      continue
    }
    if (typeof v === 'string' && !UUID_RE.test(v)) {
      // FK qui pointe vers un id legacy → on retire (la relation se rétablira plus tard)
      delete out[key]
    }
  }

  return out
}
