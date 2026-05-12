/**
 * Route /api/dossiers/:id/audit — audit IA d'un dossier via Claude.
 *
 * Renvoie un rapport structuré : points forts, points faibles, HCSF,
 * cohérence, banques recommandées, suggestion DDP.
 */
import { Hono } from 'hono'
import { authMiddleware, getUser } from '../middleware/auth.js'
import { audit, ctxMeta } from '../lib/audit.js'
import { auditDossier } from '../lib/audit-dossier/engine.js'

export const auditDossierRoute = new Hono()

auditDossierRoute.post('/dossiers/:id/audit', authMiddleware, async (c) => {
  const u = getUser(c)
  const id = c.req.param('id')
  if (!id) return c.json({ error: 'id manquant' }, 400)

  const result = await auditDossier(id)

  audit({
    action: 'export',  // pas de type "audit_ia" existant, on classe en export
    userId: u.sub, userEmail: u.email,
    entityType: 'dossier', entityId: id,
    details: `audit IA · ${result.status} · coût ≈ ${result.usage.estimatedCostEur}€`,
    ...ctxMeta(c),
  })

  if (result.status === 'failed') {
    return c.json({ error: result.error ?? 'Audit échoué', usage: result.usage }, 502)
  }

  return c.json({
    ok: true,
    data: result.data,
    usage: result.usage,
    relevesAttaches: result.relevesAttaches ?? 0,
  })
})
