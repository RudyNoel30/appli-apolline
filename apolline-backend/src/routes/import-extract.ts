/**
 * Route /api/dossiers/import-extract — import d'un dossier depuis AA summary extract.txt.
 *
 * Le frontend envoie le contenu texte du fichier (lu depuis OneDrive synchronisé
 * localement via Tauri fs plugin). Le backend appelle Claude pour parser le
 * texte vers un JSON conforme au schéma Apolline, puis crée le client + dossier.
 */
import { Hono } from 'hono'
import { authMiddleware, getUser } from '../middleware/auth.js'
import { audit, ctxMeta } from '../lib/audit.js'
import { notifyChange } from '../realtime/notify.js'
import { importExtract } from '../lib/import-extract/engine.js'

export const importExtractRoute = new Hono()

importExtractRoute.post('/dossiers/import-extract', authMiddleware, async (c) => {
  const u = getUser(c)
  const body = await c.req.json().catch(() => null) as { extractText?: string; sourceFolderPath?: string } | null
  if (!body || typeof body.extractText !== 'string') {
    return c.json({ error: 'extractText (string) requis' }, 400)
  }
  if (body.extractText.length > 200_000) {
    return c.json({ error: 'extract trop long (max 200 000 chars)' }, 413)
  }

  const result = await importExtract(body.extractText, u.sub)

  if (result.status === 'failed') {
    audit({
      action: 'create', userId: u.sub, userEmail: u.email,
      entityType: 'dossier', entityId: 'import-failed',
      details: `import AA summary extract échoué: ${result.error}${body.sourceFolderPath ? ` (source: ${body.sourceFolderPath})` : ''}`,
      ...ctxMeta(c),
    })
    return c.json({ error: result.error, usage: result.usage }, 502)
  }

  // Notify sync — les frontends connectés vont re-pull et voir le nouveau dossier
  if (result.dossierId) {
    await notifyChange({ table: 'dossiers' as never, action: 'create', id: result.dossierId })
  }
  if (result.clientId) {
    await notifyChange({ table: 'clients' as never, action: 'create', id: result.clientId })
  }

  audit({
    action: 'create', userId: u.sub, userEmail: u.email,
    entityType: 'dossier', entityId: result.dossierId ?? '?',
    details: `import AA summary extract → ${result.ref} · legacyId=${result.legacyId ?? '—'} · ${result.fieldsImported} champs · coût ≈ ${result.usage.estimatedCostEur}€${body.sourceFolderPath ? ` (source: ${body.sourceFolderPath})` : ''}`,
    ...ctxMeta(c),
  })

  return c.json({
    ok: true,
    dossierId: result.dossierId,
    clientId: result.clientId,
    ref: result.ref,
    legacyId: result.legacyId,
    fieldsImported: result.fieldsImported,
    usage: result.usage,
  })
})
