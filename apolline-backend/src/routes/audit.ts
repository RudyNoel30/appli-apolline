/**
 * Route /api/audit — admin uniquement, lecture seule.
 * Permet de visualiser le journal d'audit depuis l'UI Paramètres → Audit.
 */
import { Hono } from 'hono'
import { authMiddleware, getUser } from '../middleware/auth.js'
import { listAudit } from '../lib/audit.js'

export const auditRoute = new Hono()

auditRoute.get('/', authMiddleware, async (c) => {
  const u = getUser(c)
  if (u.role !== 'admin') {
    return c.json({ error: 'admin uniquement' }, 403)
  }
  const limit = Number(c.req.query('limit') ?? 200)
  const userId = c.req.query('userId') ?? undefined
  const rows = await listAudit({ limit, userId })
  return c.json(rows)
})
