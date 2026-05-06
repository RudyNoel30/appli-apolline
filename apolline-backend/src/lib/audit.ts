/**
 * Audit log : trace des actions sensibles dans la BDD pour conformité IOBSP / RGPD.
 *
 * Lecture seule via /api/audit (admin uniquement). Aucune route d'édition/suppression
 * — c'est un journal append-only. La purge se fait par cron côté serveur (rétention 5 ans).
 */
import type { Context } from 'hono'
import { db, schema } from '../db/index.js'
import { desc, eq } from 'drizzle-orm'

export type AuditAction = 'login' | 'logout' | 'login_failed' | 'create' | 'update' | 'delete' | 'export' | 'password_changed' | 'permissions_changed'

export type AuditEntry = {
  userId?: string
  userEmail?: string
  action: AuditAction
  entityType?: string
  entityId?: string
  details?: string
  ip?: string
  userAgent?: string
}

/**
 * Enregistre une entrée d'audit. Fire-and-forget : si l'écriture audit échoue,
 * l'action métier n'est pas bloquée (mais log warn côté backend).
 */
export function audit(entry: AuditEntry): void {
  db.insert(schema.auditLog).values(entry).catch((e) => {
    console.warn('[audit] failed to log', entry.action, e)
  })
}

/** Helper pour extraire les méta-infos depuis un Hono Context. */
export function ctxMeta(c: Context): { ip: string; userAgent: string } {
  const ip = (c.req.header('x-forwarded-for')?.split(',')[0] ?? '').trim() || 'unknown'
  const userAgent = c.req.header('user-agent') ?? ''
  return { ip, userAgent }
}

/** Liste paginée des entrées d'audit (admin uniquement). */
export async function listAudit(opts: { limit?: number; userId?: string }): Promise<unknown[]> {
  const limit = Math.min(opts.limit ?? 200, 1000)
  if (opts.userId) {
    return db.select().from(schema.auditLog)
      .where(eq(schema.auditLog.userId, opts.userId))
      .orderBy(desc(schema.auditLog.ts))
      .limit(limit)
  }
  return db.select().from(schema.auditLog)
    .orderBy(desc(schema.auditLog.ts))
    .limit(limit)
}
