/**
 * Route /api/dossiers/:id/import-simulation — import des prêts depuis un
 * AA summary simulation.txt produit par le skill /dossier-extract-simulation.
 *
 * Le frontend envoie le contenu texte du fichier (lu depuis OneDrive synchronisé
 * via Tauri fs plugin, ou collé manuellement par l'utilisateur). Le backend
 * appelle Claude pour parser le plan de financement Cifacil → liste de prêts,
 * puis insère ces prêts dans la table prets (sans toucher au dossier existant).
 */
import { Hono } from 'hono'
import { authMiddleware, getUser } from '../middleware/auth.js'
import { audit, ctxMeta } from '../lib/audit.js'
import { notifyChange } from '../realtime/notify.js'
import { importSimulation } from '../lib/import-simulation/engine.js'

export const importSimulationRoute = new Hono()

importSimulationRoute.post('/dossiers/:id/import-simulation', authMiddleware, async (c) => {
  const u = getUser(c)
  const dossierId = c.req.param('id')
  if (!dossierId) {
    return c.json({ error: 'dossier id requis' }, 400)
  }
  const body = await c.req.json().catch(() => null) as { simulationText?: string; sourceFolderPath?: string } | null
  if (!body || typeof body.simulationText !== 'string') {
    return c.json({ error: 'simulationText (string) requis' }, 400)
  }
  if (body.simulationText.length > 200_000) {
    return c.json({ error: 'simulation trop longue (max 200 000 chars)' }, 413)
  }

  const result = await importSimulation(dossierId, body.simulationText)

  if (result.status === 'failed') {
    audit({
      action: 'create', userId: u.sub, userEmail: u.email,
      entityType: 'pret', entityId: 'import-failed',
      details: `import AA summary simulation échoué (dossier ${dossierId}): ${result.error}${body.sourceFolderPath ? ` (source: ${body.sourceFolderPath})` : ''}`,
      ...ctxMeta(c),
    })
    return c.json({ error: result.error, usage: result.usage }, 502)
  }

  // Notifier les frontends connectés pour qu'ils re-pull les prêts
  for (const p of result.pretsCrees ?? []) {
    await notifyChange({ table: 'prets' as never, action: 'create', id: p.id })
  }

  audit({
    action: 'create', userId: u.sub, userEmail: u.email,
    entityType: 'pret', entityId: dossierId,
    details: `import AA summary simulation → ${result.pretsCrees?.length ?? 0} prêt(s) créé(s) sur ${result.banquePortante || 'banque inconnue'} · coût ≈ ${result.usage.estimatedCostEur}€${body.sourceFolderPath ? ` (source: ${body.sourceFolderPath})` : ''}`,
    ...ctxMeta(c),
  })

  return c.json({
    ok: true,
    dossierId: result.dossierId,
    banquePortante: result.banquePortante,
    pretsCrees: result.pretsCrees ?? [],
    usage: result.usage,
  })
})
