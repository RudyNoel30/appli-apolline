/**
 * Apolline backend — point d'entrée.
 * - CORS strict (origines listées dans .env)
 * - Auth JWT (toutes les routes /api/* sauf /api/auth/login)
 * - CRUD générique pour 9 entités
 * - Realtime SSE via PG NOTIFY/LISTEN
 */
import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serve } from '@hono/node-server'
import { schema } from './db/index.js'
import { crudRoute } from './lib/crud.js'
import { authRoute } from './routes/auth.js'
import { auditRoute } from './routes/audit.js'
import { telemetryRoute } from './routes/telemetry.js'
import { rgpdRoute } from './routes/rgpd.js'
import { piecesRoute } from './routes/pieces.js'
import { aiRoute } from './routes/ai.js'
import { coworkerRoute } from './routes/coworker.js'
import { facturesRoute } from './routes/factures.js'
import { conformiteRoute } from './routes/conformite.js'
import { sseRoute } from './realtime/sse.js'
import { startCron } from './realtime/cron.js'
import { hashPassword } from './middleware/auth.js'

const app = new Hono()

// ─── Middleware globaux ───
app.use('*', logger())

// ─── Rate limiting léger (en mémoire, par IP) ─────────────────────────────
// Protège contre un compte compromis qui essaierait de dump la BDD ou contre
// du brute-force sur /api/auth/login. Pas de Redis : on est sur 1 seul VPS.
// Limite : 200 req/min par IP toutes routes confondues, 10 req/min sur login.
const rlBuckets = new Map<string, { count: number; resetAt: number }>()
function rateLimit(ip: string, key: string, max: number, windowMs: number): boolean {
  const k = `${key}:${ip}`
  const now = Date.now()
  const bucket = rlBuckets.get(k)
  if (!bucket || bucket.resetAt < now) {
    rlBuckets.set(k, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (bucket.count >= max) return false
  bucket.count++
  return true
}
// GC ponctuel pour ne pas faire grossir la map (toutes les 5 min)
setInterval(() => {
  const now = Date.now()
  for (const [k, b] of rlBuckets) if (b.resetAt < now) rlBuckets.delete(k)
}, 5 * 60_000)

app.use('*', async (c, next) => {
  const ip = (c.req.header('x-forwarded-for')?.split(',')[0] ?? '').trim() || 'unknown'
  const path = c.req.path
  // Login : strict (10 essais/min/IP)
  if (path === '/api/auth/login' && c.req.method === 'POST') {
    if (!rateLimit(ip, 'login', 10, 60_000)) {
      return c.json({ error: 'Trop de tentatives. Réessayez dans 1 minute.' }, 429)
    }
  }
  // Reste de l'API : 200 req/min/IP
  if (path.startsWith('/api/')) {
    if (!rateLimit(ip, 'api', 200, 60_000)) {
      return c.json({ error: 'Rate limit atteint. Patientez 1 minute.' }, 429)
    }
  }
  await next()
})

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
app.use('*', cors({
  origin: (origin) => {
    if (!origin) return ''
    return allowedOrigins.includes(origin) ? origin : ''
  },
  credentials: true,
  allowHeaders: ['Authorization', 'Content-Type'],
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  maxAge: 86400,
}))

// ─── Healthcheck ───
app.get('/healthz', (c) => c.json({ ok: true, ts: Date.now() }))

// Healthcheck riche : vérifie aussi l'état BDD + version + uptime. Consommé
// par le panneau "État du système" côté front (Paramètres → Données).
app.get('/api/health', async (c) => {
  const startedAt = process.uptime() * 1000
  let dbOk = false
  let dbLatencyMs: number | null = null
  let dbError: string | null = null
  try {
    const t = Date.now()
    const { db } = await import('./db/index.js')
    const { sql } = await import('drizzle-orm')
    await db.execute(sql`SELECT 1`)
    dbLatencyMs = Date.now() - t
    dbOk = true
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e)
  }
  return c.json({
    ok: dbOk,
    ts: Date.now(),
    uptimeMs: Math.round(startedAt),
    version: process.env.APP_VERSION ?? 'dev',
    db: { ok: dbOk, latencyMs: dbLatencyMs, error: dbError },
    node: process.version,
  })
})

// ─── Auth ───
app.route('/api/auth', authRoute)
app.route('/api/audit', auditRoute)
app.route('/api/telemetry', telemetryRoute)
app.route('/api/rgpd', rgpdRoute)
app.route('/api', piecesRoute)
app.route('/api/ai', aiRoute)
app.route('/api/coworker', coworkerRoute)
app.route('/api/factures', facturesRoute)
app.route('/api/conformite', conformiteRoute)

// ─── CRUD entités métier ───
app.route('/api/clients', crudRoute({
  table: schema.clients,
  name: 'clients',
  // Cascade : supprime tous les fichiers de tous les dossiers du client
  // AVANT le DELETE BDD (qui cascade les lignes via FK ON DELETE CASCADE).
  beforeDelete: async (id) => {
    const { purgeClientFiles } = await import('./lib/cascade-delete.js')
    const r = await purgeClientFiles(id)
    return `cascade fichiers : ${r.dossiersConcernes} dossier(s), ${r.fichiersSupprimes} fichier(s) supprimé(s)`
  },
}))
app.route('/api/dossiers', crudRoute({
  table: schema.dossiers,
  name: 'dossiers',
  // Cascade : supprime le dossier filesystem `/var/lib/apolline/pieces/<id>/`
  // AVANT le DELETE BDD.
  beforeDelete: async (id) => {
    const { purgeDossierFiles } = await import('./lib/cascade-delete.js')
    const n = await purgeDossierFiles(id)
    return `cascade fichiers : ${n} fichier(s) supprimé(s)`
  },
}))
app.route('/api/prets', crudRoute({
  table: schema.prets,
  name: 'prets',
}))
app.route('/api/rdvs', crudRoute({
  table: schema.rdvs,
  name: 'rdvs',
}))
app.route('/api/notes', crudRoute({
  table: schema.notes,
  name: 'notes',
}))
app.route('/api/apporteurs', crudRoute({
  table: schema.apporteurs,
  name: 'apporteurs',
}))
app.route('/api/banques', crudRoute({
  table: schema.banques,
  name: 'banques',
  idType: 'text',
}))
app.route('/api/commissions', crudRoute({
  table: schema.commissions,
  name: 'commissions',
}))
app.route('/api/simulations', crudRoute({
  table: schema.simulations,
  name: 'simulations',
}))
app.route('/api/templates', crudRoute({
  table: schema.templates,
  name: 'templates',
}))
app.route('/api/notifications', crudRoute({
  table: schema.notifications,
  name: 'notifications',
}))
// ⚠️ Pas de CRUD générique sur pieces — les routes upload/download/preview/delete
// sont définies dans piecesRoute (/api/pieces/:id/* et /api/dossiers/:id/pieces*)
// pour gérer le filesystem en plus de la BDD.

// ─── Collaborateurs (admin only — endpoints CRUD avec hash mot de passe) ───
app.route('/api/collaborateurs', crudRoute({
  table: schema.collaborateurs,
  name: 'collaborateurs',
  idType: 'text',
  beforeInsert: async (data) => {
    // Accepte 'password' (anglais) ou 'motDePasse' (français — convention frontend)
    const pwd = typeof data.password === 'string' && data.password.length > 0
      ? data.password
      : typeof data.motDePasse === 'string' && data.motDePasse.length > 0
        ? data.motDePasse
        : null
    if (pwd) data.passwordHash = await hashPassword(pwd)
    delete data.password
    delete data.motDePasse
    return data
  },
  beforeUpdate: async (data) => {
    const pwd = typeof data.password === 'string' && data.password.length > 0
      ? data.password
      : typeof data.motDePasse === 'string' && data.motDePasse.length > 0
        ? data.motDePasse
        : null
    if (pwd) data.passwordHash = await hashPassword(pwd)
    delete data.password
    delete data.motDePasse
    return data
  },
  serialize: (row) => {
    const { passwordHash: _ph, ...safe } = row
    return safe
  },
}))

// ─── Realtime SSE ───
app.route('/api', sseRoute)

// ─── Démarrage ───
const port = Number(process.env.PORT ?? 3000)
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[apolline-backend] http://127.0.0.1:${info.port}`)
  console.log(`[apolline-backend] CORS allowed origins: ${allowedOrigins.join(', ') || '(aucune — bloqué)'}`)
  startCron()
})
