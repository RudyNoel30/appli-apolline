/**
 * Routes /api/ai/* — invocation des skills Claude.
 *
 *   GET  /api/ai/health                    → est-ce que la clé API est configurée ?
 *   GET  /api/ai/skills                    → liste des skills chargés depuis apolline-skills/
 *   POST /api/ai/generate/:skillName       → invoque le skill avec un contexte JSON
 *   POST /api/ai/dossier/:id/:skillName    → enrichit le contexte avec le dossier puis invoque
 *   GET  /api/ai/usage                     → conso parsée depuis audit_log
 *
 * Toutes les routes nécessitent un JWT.
 */
import { Hono } from 'hono'
import { eq, sql } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { authMiddleware, getUser } from '../middleware/auth.js'
import { audit, ctxMeta } from '../lib/audit.js'
import { generate, isConfigured } from '../lib/anthropic.js'
import { listSkillNames, getSkill, refreshSkills } from '../lib/skills/loader.js'
import { tierForSkill, modelForSkill } from '../lib/skills/mapping.js'

export const aiRoute = new Hono()

aiRoute.get('/health', authMiddleware, (c) => {
  return c.json({
    configured: isConfigured(),
    skills: listSkillNames(),
  })
})

/** Liste les skills disponibles avec leur modèle attribué. */
aiRoute.get('/skills', authMiddleware, (c) => {
  const skills = listSkillNames().map((name) => {
    const s = getSkill(name)
    return {
      name,
      tier: tierForSkill(name),
      model: modelForSkill(name),
      title: s?.meta.name ?? s?.meta.display_title ?? name,
      description: s?.meta.description ?? '',
    }
  })
  return c.json({ skills })
})

/** Recharge les skills depuis le filesystem (utile en dev sans restart). */
aiRoute.post('/skills/refresh', authMiddleware, (c) => {
  const u = getUser(c)
  if (u.role !== 'admin') return c.json({ error: 'admin uniquement' }, 403)
  const map = refreshSkills()
  return c.json({ count: map.size, skills: [...map.keys()] })
})

/** Endpoint générique : invoque un skill avec un contexte JSON arbitraire. */
aiRoute.post('/generate/:skillName', authMiddleware, async (c) => {
  const u = getUser(c)
  const meta = ctxMeta(c)
  const skillName = c.req.param('skillName') ?? ''
  if (!getSkill(skillName)) {
    return c.json({ error: `skill "${skillName}" introuvable` }, 400)
  }
  const body = await c.req.json().catch(() => ({})) as { context?: Record<string, unknown>; instructions?: string }
  if (!body.context || typeof body.context !== 'object') {
    return c.json({ error: 'context (objet JSON) requis' }, 400)
  }
  try {
    const result = await generate({
      skill: skillName, context: body.context, instructions: body.instructions,
    })
    audit({
      action: 'create', userId: u.sub, userEmail: u.email,
      entityType: 'ai_generation', entityId: skillName,
      details: `skill=${skillName} model=${result.model} cost=${result.usage.estimatedCostEur}€ tokens_in=${result.usage.inputTokens} tokens_out=${result.usage.outputTokens}`,
      ...meta,
    })
    return c.json(result)
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 503)
  }
})

/** Charge un dossier complet en BDD et l'utilise comme contexte pour invoquer le skill. */
aiRoute.post('/dossier/:id/:skillName', authMiddleware, async (c) => {
  const u = getUser(c)
  const meta = ctxMeta(c)
  const id = c.req.param('id') ?? ''
  const skillName = c.req.param('skillName') ?? ''
  if (!id) return c.json({ error: 'id manquant' }, 400)
  if (!getSkill(skillName)) return c.json({ error: `skill "${skillName}" introuvable` }, 400)

  try {
    const [dossier] = await db.select().from(schema.dossiers).where(eq(schema.dossiers.id, id))
    if (!dossier) return c.json({ error: 'dossier introuvable' }, 404)
    const [client] = await db.select().from(schema.clients).where(eq(schema.clients.id, dossier.clientId))
    const prets = await db.execute(sql`SELECT * FROM prets WHERE dossier_id = ${id}`)
    const notes = await db.execute(sql`SELECT * FROM notes WHERE dossier_id = ${id}`)
    const banques = await db.select().from(schema.banques)
    const pieces = await db.execute(sql`SELECT id, categorie, libelle, filename, mime_type, size_bytes, uploaded_at FROM pieces WHERE dossier_id = ${id}`)

    // Sanitisation : retire passwordHash et autres PII inutiles
    const safeClient = client ? Object.fromEntries(
      Object.entries(client).filter(([k]) => k !== 'passwordHash')
    ) : null

    const context = {
      dossier,
      client: safeClient,
      prets: (prets as unknown as { rows: unknown[] }).rows,
      notes: (notes as unknown as { rows: unknown[] }).rows,
      banques,
      pieces: (pieces as unknown as { rows: unknown[] }).rows,
      courtier: { id: u.sub, email: u.email, prenom: u.prenom, nom: u.nom },
    }

    const result = await generate({ skill: skillName, context })

    audit({
      action: 'create', userId: u.sub, userEmail: u.email,
      entityType: 'ai_generation', entityId: `dossier:${id}:${skillName}`,
      details: `skill=${skillName} model=${result.model} cost=${result.usage.estimatedCostEur}€ tokens_in=${result.usage.inputTokens} tokens_out=${result.usage.outputTokens}`,
      ...meta,
    })

    return c.json(result)
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 503)
  }
})

/** Conso IA agrégée depuis audit_log. */
aiRoute.get('/usage', authMiddleware, async (c) => {
  try {
    const u = getUser(c)
    const days = Math.min(Math.max(Number(c.req.query('days') ?? '30'), 1), 365)
    const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString()

    // Cast explicite vers timestamptz pour éviter "operator does not exist"
    const result = await db.execute(sql`
      SELECT id, ts, user_id, user_email, entity_id, details
      FROM audit_log
      WHERE entity_type = 'ai_generation'
        AND action = 'create'
        AND ts >= ${since}::timestamptz
      ORDER BY ts DESC
      LIMIT 1000
    `)

    // db.execute() peut renvoyer soit { rows: [...] } (node-postgres) soit directement [...] (postgres-js)
    const rawRows: Array<Record<string, unknown>> =
      Array.isArray(result) ? result :
      Array.isArray((result as { rows?: unknown[] })?.rows) ? (result as { rows: Array<Record<string, unknown>> }).rows :
      []

    type Entry = {
      id: string; ts: string; userId: string | null; userEmail: string | null;
      skill: string; cost: number; tokensIn: number; tokensOut: number; model: string;
      /** 'skill' = bouton IA classique, 'coworker' = générée via le panneau Jarvis */
      via: 'skill' | 'coworker';
    }
    const entries: Entry[] = []
    for (const row of rawRows) {
      const details = String(row.details ?? '')
      const skillMatch = details.match(/skill=(\S+)/)
      const modelMatch = details.match(/model=(\S+)/)
      const costMatch = details.match(/cost=([\d.]+)/)
      const inMatch = details.match(/tokens_in=(\d+)/)
      const outMatch = details.match(/tokens_out=(\d+)/)
      const isCoworker = /via=coworker/.test(details) || String(row.entity_id ?? '').startsWith('coworker:')
      const tsRaw = row.ts
      const ts = tsRaw instanceof Date ? tsRaw.toISOString() : String(tsRaw ?? '')
      entries.push({
        id: String(row.id),
        ts,
        userId: (row.user_id as string | null) ?? null,
        userEmail: (row.user_email as string | null) ?? null,
        skill: skillMatch?.[1] ?? 'unknown',
        model: modelMatch?.[1] ?? 'unknown',
        cost: parseFloat(costMatch?.[1] ?? '0'),
        tokensIn: parseInt(inMatch?.[1] ?? '0', 10),
        tokensOut: parseInt(outMatch?.[1] ?? '0', 10),
        via: isCoworker ? 'coworker' : 'skill',
      })
    }

    // Top tools utilisés par Jarvis (depuis audit_log entityType='coworker_tool_call')
    const toolResult = await db.execute(sql`
      SELECT details
      FROM audit_log
      WHERE entity_type = 'coworker_tool_call' AND ts >= ${since}::timestamptz
      LIMIT 5000
    `)
    const toolRows: Array<Record<string, unknown>> =
      Array.isArray(toolResult) ? toolResult :
      Array.isArray((toolResult as { rows?: unknown[] })?.rows) ? (toolResult as { rows: Array<Record<string, unknown>> }).rows :
      []
    const toolCounts = new Map<string, number>()
    for (const r of toolRows) {
      const m = String(r.details ?? '').match(/tool=(\S+)/)
      const name = m?.[1] ?? 'unknown'
      toolCounts.set(name, (toolCounts.get(name) ?? 0) + 1)
    }
    const topTools = [...toolCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }))

    const total = entries.reduce((s, e) => s + e.cost, 0)
    const byDay = new Map<string, { day: string; cost: number; count: number }>()
    const bySkill = new Map<string, { skill: string; cost: number; count: number }>()
    const byUser = new Map<string, { userId: string; userEmail: string; cost: number; count: number }>()
    for (const e of entries) {
      const day = e.ts.slice(0, 10)
      const dayBucket = byDay.get(day) ?? { day, cost: 0, count: 0 }
      dayBucket.cost += e.cost; dayBucket.count++; byDay.set(day, dayBucket)

      const skillBucket = bySkill.get(e.skill) ?? { skill: e.skill, cost: 0, count: 0 }
      skillBucket.cost += e.cost; skillBucket.count++; bySkill.set(e.skill, skillBucket)

      if (e.userId) {
        const userBucket = byUser.get(e.userId) ?? { userId: e.userId, userEmail: e.userEmail ?? '—', cost: 0, count: 0 }
        userBucket.cost += e.cost; userBucket.count++; byUser.set(e.userId, userBucket)
      }
    }

    // Split coworker / skills classiques
    const coworkerEntries = entries.filter(e => e.via === 'coworker')
    const skillEntries = entries.filter(e => e.via === 'skill')
    const splitTotal = (arr: Entry[]) => ({
      cost: Number(arr.reduce((s, e) => s + e.cost, 0).toFixed(4)),
      count: arr.length,
    })

    return c.json({
      period: { days, since },
      total: { cost: Number(total.toFixed(4)), count: entries.length },
      byDay: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
      bySkill: [...bySkill.values()].sort((a, b) => b.cost - a.cost),
      byUser: u.role === 'admin' ? [...byUser.values()].sort((a, b) => b.cost - a.cost) : [],
      recent: entries.slice(0, 50),
      // Nouvelles stats v0.1.61
      split: {
        skills: splitTotal(skillEntries),
        coworker: splitTotal(coworkerEntries),
      },
      topTools,
    })
  } catch (e) {
    console.error('[ai/usage] error:', e)
    return c.json({
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    }, 500)
  }
})
