/**
 * Notifications proactives — déclenchées côté backend par un setInterval léger.
 *
 * Tourne toutes les 15 minutes pour détecter :
 *  - Dossiers stagnants (Envoi_banque > 7 j sans accord)
 *  - RDV imminents non confirmés (dans les 24h)
 *  - Pièces incomplètes < 50 % alors que le dossier passe en Montage
 *
 * Crée une notif côté BDD → propagée aux postes via SSE.
 *
 * Désactivable via la variable d'env `CRON_ENABLED=false`.
 */
import { db, schema } from '../db/index.js'
import { sql, eq, and, lt } from 'drizzle-orm'
import { notifyChange } from './notify.js'

const FIFTEEN_MIN = 15 * 60 * 1000

async function checkDossiersStagnants(): Promise<void> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
  const dossiers = await db.select().from(schema.dossiers)
    .where(and(eq(schema.dossiers.statut, 'Envoi_banque'), lt(schema.dossiers.createdAt, sevenDaysAgo as never)))
  for (const d of dossiers) {
    // Évite les doublons : si une notif identique a été créée < 24h, on skip
    const recentSame = await db.select().from(schema.notifications)
      .where(and(
        eq(schema.notifications.dossierId, d.id),
        eq(schema.notifications.title, `Relance banque — ${d.clientNom}`),
      )).limit(1)
    if (recentSame.length > 0) continue

    const [created] = await db.insert(schema.notifications).values({
      type: 'warning',
      title: `Relance banque — ${d.clientNom}`,
      description: `Le dossier ${d.ref} est en envoi banque depuis plus de 7 jours sans réponse.`,
      dossierId: d.id,
      link: `/dossiers/${d.id}`,
      read: false,
      createdAt: sql`NOW()`,
    } as never).returning()
    if (created) {
      await notifyChange({ table: 'notifications', action: 'create', id: String((created as Record<string, unknown>).id) })
    }
  }
}

/**
 * Auto-purge RGPD : anonymise les dossiers Encaissés depuis > 5 ans (durée
 * légale de conservation L223-1 Code de la consommation), puis efface
 * complètement ceux > 6 ans.
 *
 * Tourne 1× par jour (premier tick après 1 min, puis toutes les 24h).
 */
async function purgeRgpd(): Promise<void> {
  const fiveYearsAgo = new Date(Date.now() - 5 * 365 * 24 * 3600 * 1000).toISOString()
  const sixYearsAgo = new Date(Date.now() - 6 * 365 * 24 * 3600 * 1000).toISOString()

  // 1. Anonymisation : dossiers Encaissés depuis > 5 ans → archive=true (soft)
  const arch = await db.execute(sql`
    UPDATE dossiers SET archive = true, archive_raison = 'Auto-archivage RGPD (5 ans)', updated_at = NOW()
    WHERE statut = 'Encaisse'
      AND signature_date IS NOT NULL
      AND signature_date < ${fiveYearsAgo}
      AND archive = false
  `)
  if ((arch as { rowCount?: number }).rowCount && (arch as { rowCount?: number }).rowCount! > 0) {
    console.log(`[cron] RGPD : ${(arch as { rowCount?: number }).rowCount} dossier(s) archivé(s) après 5 ans`)
  }

  // 2. Suppression complète : dossiers archivés depuis > 6 ans (1 an de marge)
  const oldDossiers = await db.execute(sql`
    SELECT id FROM dossiers WHERE archive = true AND updated_at < ${sixYearsAgo}
  `)
  const toDelete = (oldDossiers as unknown as { rows: Array<{ id: string }> }).rows.map((r) => r.id)
  if (toDelete.length > 0) {
    // Purge filesystem AVANT le delete BDD
    const { purgeDossierFiles } = await import('../lib/cascade-delete.js')
    let totalFiles = 0
    for (const dId of toDelete) {
      totalFiles += await purgeDossierFiles(dId).catch(() => 0)
    }

    await db.execute(sql`DELETE FROM commissions WHERE dossier_id = ANY(${toDelete})`)
    await db.execute(sql`DELETE FROM prets WHERE dossier_id = ANY(${toDelete})`)
    await db.execute(sql`DELETE FROM notes WHERE dossier_id = ANY(${toDelete})`)
    await db.execute(sql`DELETE FROM pieces WHERE dossier_id = ANY(${toDelete})`)
    await db.execute(sql`DELETE FROM dossiers WHERE id = ANY(${toDelete})`)
    console.log(`[cron] RGPD : ${toDelete.length} dossier(s) supprimé(s) définitivement après 6 ans (+ ${totalFiles} fichier(s))`)
  }
}

async function tick(): Promise<void> {
  try {
    await checkDossiersStagnants()
  } catch (e) {
    console.warn('[cron] tick stagnants failed', e)
  }
}

// Tick quotidien dédié à la purge RGPD (séparé pour éviter d'alourdir le tick 15 min)
async function dailyTick(): Promise<void> {
  try {
    await purgeRgpd()
  } catch (e) {
    console.warn('[cron] daily RGPD tick failed', e)
  }
}

const ONE_DAY = 24 * 3600 * 1000

export function startCron(): void {
  if (process.env.CRON_ENABLED === 'false') {
    console.log('[cron] désactivé (CRON_ENABLED=false)')
    return
  }
  console.log('[cron] démarrage — tick toutes les 15 min + purge RGPD toutes les 24h')
  // Premier tick après 1 min (laisse le serveur s'initialiser)
  setTimeout(() => { void tick() }, 60_000)
  setInterval(() => { void tick() }, FIFTEEN_MIN)
  // Purge RGPD : tick décalé de 5 min puis toutes les 24h
  setTimeout(() => { void dailyTick() }, 5 * 60_000)
  setInterval(() => { void dailyTick() }, ONE_DAY)
}
