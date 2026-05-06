/**
 * Route /api/telemetry — réception des erreurs JS et rejets non gérés
 * envoyés par le wrapper télémétrie côté front. Stocke dans audit_log.
 *
 * Auth requis : l'erreur est attribuée au user courant. Le rate-limit global
 * (200/min/IP) protège contre l'abus.
 */
import { Hono } from 'hono'
import { authMiddleware, getUser } from '../middleware/auth.js'
import { audit, ctxMeta } from '../lib/audit.js'

export const telemetryRoute = new Hono()

telemetryRoute.post('/', authMiddleware, async (c) => {
  const u = (() => { try { return getUser(c) } catch { return null } })()
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const meta = ctxMeta(c)
  const message = String(body.message ?? '').slice(0, 1000)
  const kind = String(body.kind ?? 'unknown').slice(0, 100)
  const url = String(body.url ?? '').slice(0, 200)
  audit({
    userId: u?.sub,
    userEmail: u?.email,
    action: 'create' as const,
    entityType: 'telemetry',
    entityId: kind,
    details: `${kind} @ ${url} — ${message}`,
    ...meta,
  })
  return c.json({ ok: true })
})
