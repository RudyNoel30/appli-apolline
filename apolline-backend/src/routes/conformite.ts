/**
 * Routes /api/conformite/* — tracker conformité IOBSP.
 *
 * Endpoints :
 *   GET    /certifs                          → liste des certifs (admin = tous, user = les siens)
 *   POST   /certifs                          → création
 *   PATCH  /certifs/:id                      → modification
 *   DELETE /certifs/:id                      → suppression
 *
 *   GET    /formations                       → liste des formations
 *   POST   /formations                       → ajoute une session
 *   DELETE /formations/:id                   → supprime
 *
 *   GET    /status                           → statut global du collab connecté (KPIs + alertes)
 *
 * Toutes les routes nécessitent JWT. Un courtier ne voit que ses propres
 * données ; un admin voit tout le monde.
 */
import { Hono } from 'hono'
import { eq, and, desc, gte, sql } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { authMiddleware, getUser } from '../middleware/auth.js'
import { audit, ctxMeta } from '../lib/audit.js'

export const conformiteRoute = new Hono()

type Role = 'admin' | 'courtier' | 'gestionnaire' | 'assistante'

// Heures de formation continue obligatoires (CMF R.519-15)
const HEURES_FORMATION_OBLIGATOIRES = 15

// ────────────────────────────────────────────────────────────────────
// CERTIFS
// ────────────────────────────────────────────────────────────────────

conformiteRoute.get('/certifs', authMiddleware, async (c) => {
  const u = getUser(c)
  const collab = await getCollab(u.sub)
  const collabFilter = c.req.query('collaborateurId')

  // Admin peut voir tout, sinon on force au current user
  let where
  if (collab?.role === 'admin' && collabFilter) {
    where = eq(schema.conformiteCertifs.collaborateurId, collabFilter)
  } else if (collab?.role !== 'admin') {
    where = eq(schema.conformiteCertifs.collaborateurId, u.sub)
  }

  const rows = await db.select().from(schema.conformiteCertifs)
    .where(where)
    .orderBy(desc(schema.conformiteCertifs.expireLe))
    .limit(200)
  return c.json({ certifs: rows })
})

conformiteRoute.post('/certifs', authMiddleware, async (c) => {
  const u = getUser(c)
  const meta = ctxMeta(c)
  const body = await c.req.json().catch(() => ({})) as Partial<{
    collaborateurId: string
    type: string
    libelle: string
    organismeEmetteur: string | null
    numero: string | null
    emiseLe: string | null
    valideDu: string | null
    expireLe: string | null
    montantGarantie: number | null
    alerteJoursAvant: number
    notes: string | null
  }>
  if (!body.type || !body.libelle) {
    return c.json({ error: 'type et libelle requis' }, 400)
  }
  // Le user ne peut créer que ses propres certifs (sauf admin)
  const collab = await getCollab(u.sub)
  const targetCollabId = (collab?.role === 'admin' && body.collaborateurId) ? body.collaborateurId : u.sub

  // Montant en centimes si fourni en EUR
  const montantCents = body.montantGarantie != null ? Math.round(body.montantGarantie * 100) : null

  const inserted = await db.insert(schema.conformiteCertifs).values({
    collaborateurId: targetCollabId,
    type: body.type as never,
    libelle: body.libelle,
    organismeEmetteur: body.organismeEmetteur ?? null,
    numero: body.numero ?? null,
    emiseLe: body.emiseLe ?? null,
    valideDu: body.valideDu ?? null,
    expireLe: body.expireLe ?? null,
    montantGarantie: montantCents,
    alerteJoursAvant: body.alerteJoursAvant ?? 60,
    notes: body.notes ?? null,
    createdBy: u.sub,
  } as never).returning()
  const certif = inserted[0]
  if (!certif) return c.json({ error: 'Échec création' }, 500)

  audit({
    action: 'create', userId: u.sub, userEmail: u.email,
    entityType: 'conformite_certif', entityId: certif.id,
    details: `create type=${body.type} ${body.libelle}${body.expireLe ? ' exp=' + body.expireLe.slice(0, 10) : ''}`,
    ip: meta.ip, userAgent: meta.userAgent,
  })

  return c.json({ certif })
})

conformiteRoute.patch('/certifs/:id', authMiddleware, async (c) => {
  const u = getUser(c)
  const meta = ctxMeta(c)
  const id = c.req.param('id') ?? ''
  if (!id) return c.json({ error: 'id manquant' }, 400)

  const [existing] = await db.select().from(schema.conformiteCertifs).where(eq(schema.conformiteCertifs.id, id))
  if (!existing) return c.json({ error: 'Certif introuvable' }, 404)

  const collab = await getCollab(u.sub)
  if (collab?.role !== 'admin' && existing.collaborateurId !== u.sub) {
    return c.json({ error: 'Accès refusé' }, 403)
  }

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  const ALLOWED = ['libelle', 'organismeEmetteur', 'numero', 'emiseLe', 'valideDu', 'expireLe', 'alerteJoursAvant', 'notes']
  for (const k of ALLOWED) if (k in body) update[k] = body[k]
  if ('montantGarantie' in body && typeof body.montantGarantie === 'number') {
    update.montantGarantie = Math.round((body.montantGarantie as number) * 100)
  }

  const [updated] = await db.update(schema.conformiteCertifs).set(update as never)
    .where(eq(schema.conformiteCertifs.id, id)).returning()

  audit({
    action: 'update', userId: u.sub, userEmail: u.email,
    entityType: 'conformite_certif', entityId: id,
    details: `update fields=${Object.keys(body).join(',')}`,
    ip: meta.ip, userAgent: meta.userAgent,
  })

  return c.json({ certif: updated })
})

conformiteRoute.delete('/certifs/:id', authMiddleware, async (c) => {
  const u = getUser(c)
  const meta = ctxMeta(c)
  const id = c.req.param('id') ?? ''
  if (!id) return c.json({ error: 'id manquant' }, 400)

  const [existing] = await db.select().from(schema.conformiteCertifs).where(eq(schema.conformiteCertifs.id, id))
  if (!existing) return c.json({ error: 'Certif introuvable' }, 404)

  const collab = await getCollab(u.sub)
  if (collab?.role !== 'admin' && existing.collaborateurId !== u.sub) {
    return c.json({ error: 'Accès refusé' }, 403)
  }

  await db.delete(schema.conformiteCertifs).where(eq(schema.conformiteCertifs.id, id))

  audit({
    action: 'delete', userId: u.sub, userEmail: u.email,
    entityType: 'conformite_certif', entityId: id,
    details: `delete ${existing.libelle}`,
    ip: meta.ip, userAgent: meta.userAgent,
  })

  return c.json({ ok: true })
})

// ────────────────────────────────────────────────────────────────────
// FORMATIONS
// ────────────────────────────────────────────────────────────────────

conformiteRoute.get('/formations', authMiddleware, async (c) => {
  const u = getUser(c)
  const collab = await getCollab(u.sub)
  const collabFilter = c.req.query('collaborateurId')

  let where
  if (collab?.role === 'admin' && collabFilter) {
    where = eq(schema.conformiteFormations.collaborateurId, collabFilter)
  } else if (collab?.role !== 'admin') {
    where = eq(schema.conformiteFormations.collaborateurId, u.sub)
  }

  const rows = await db.select().from(schema.conformiteFormations)
    .where(where)
    .orderBy(desc(schema.conformiteFormations.dateDebut))
    .limit(500)
  return c.json({ formations: rows })
})

conformiteRoute.post('/formations', authMiddleware, async (c) => {
  const u = getUser(c)
  const meta = ctxMeta(c)
  const body = await c.req.json().catch(() => ({})) as Partial<{
    collaborateurId: string
    titre: string
    organismeFormateur: string | null
    type: 'initiale' | 'continue' | 'thematique'
    theme: string | null
    dateDebut: string
    dateFin: string | null
    dureeHeures: number
    notes: string | null
  }>
  if (!body.titre || !body.dateDebut) {
    return c.json({ error: 'titre et dateDebut requis' }, 400)
  }
  const collab = await getCollab(u.sub)
  const targetCollabId = (collab?.role === 'admin' && body.collaborateurId) ? body.collaborateurId : u.sub

  const inserted = await db.insert(schema.conformiteFormations).values({
    collaborateurId: targetCollabId,
    titre: body.titre,
    organismeFormateur: body.organismeFormateur ?? null,
    type: (body.type ?? 'continue') as never,
    theme: body.theme ?? null,
    dateDebut: body.dateDebut,
    dateFin: body.dateFin ?? null,
    dureeHeures: Number(body.dureeHeures ?? 0),
    notes: body.notes ?? null,
    createdBy: u.sub,
  } as never).returning()
  const formation = inserted[0]
  if (!formation) return c.json({ error: 'Échec création' }, 500)

  audit({
    action: 'create', userId: u.sub, userEmail: u.email,
    entityType: 'conformite_formation', entityId: formation.id,
    details: `formation "${body.titre}" ${body.dureeHeures}h le ${body.dateDebut.slice(0, 10)}`,
    ip: meta.ip, userAgent: meta.userAgent,
  })

  return c.json({ formation })
})

conformiteRoute.delete('/formations/:id', authMiddleware, async (c) => {
  const u = getUser(c)
  const meta = ctxMeta(c)
  const id = c.req.param('id') ?? ''
  if (!id) return c.json({ error: 'id manquant' }, 400)

  const [existing] = await db.select().from(schema.conformiteFormations).where(eq(schema.conformiteFormations.id, id))
  if (!existing) return c.json({ error: 'Formation introuvable' }, 404)

  const collab = await getCollab(u.sub)
  if (collab?.role !== 'admin' && existing.collaborateurId !== u.sub) {
    return c.json({ error: 'Accès refusé' }, 403)
  }

  await db.delete(schema.conformiteFormations).where(eq(schema.conformiteFormations.id, id))

  audit({
    action: 'delete', userId: u.sub, userEmail: u.email,
    entityType: 'conformite_formation', entityId: id,
    details: `delete ${existing.titre}`,
    ip: meta.ip, userAgent: meta.userAgent,
  })

  return c.json({ ok: true })
})

// ────────────────────────────────────────────────────────────────────
// STATUS — Synthèse pour le collab connecté (ou un autre si admin)
// ────────────────────────────────────────────────────────────────────

conformiteRoute.get('/status', authMiddleware, async (c) => {
  const u = getUser(c)
  const requested = c.req.query('collaborateurId')
  const collab = await getCollab(u.sub)
  const targetId = (collab?.role === 'admin' && requested) ? requested : u.sub

  // 1. Certifs avec calcul du statut
  const certifs = await db.select().from(schema.conformiteCertifs)
    .where(eq(schema.conformiteCertifs.collaborateurId, targetId))

  const now = Date.now()
  type CertifStatut = {
    id: string
    type: string
    libelle: string
    expireLe: string | null
    daysUntilExpire: number | null
    statut: 'ok' | 'alerte' | 'expire' | 'manquant'
  }
  const certifsAvecStatut: CertifStatut[] = certifs.map((cf) => {
    if (!cf.expireLe) {
      return { id: cf.id, type: cf.type, libelle: cf.libelle, expireLe: null, daysUntilExpire: null, statut: 'ok' }
    }
    const diff = Math.floor((new Date(cf.expireLe).getTime() - now) / 86400000)
    let statut: 'ok' | 'alerte' | 'expire' = 'ok'
    if (diff < 0) statut = 'expire'
    else if (diff <= cf.alerteJoursAvant) statut = 'alerte'
    return { id: cf.id, type: cf.type, libelle: cf.libelle, expireLe: cf.expireLe, daysUntilExpire: diff, statut }
  })

  // 2. Types essentiels manquants : ORIAS / RC pro / Garantie financière / Carte pro
  const TYPES_REQUIS = ['orias', 'rc_pro', 'garantie_financiere', 'carte_pro']
  const typesPresents = new Set<string>(certifs.map((c) => c.type as string))
  const typesManquants = TYPES_REQUIS.filter((t) => !typesPresents.has(t))

  // 3. Formations continues année en cours + année précédente
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString()
  const yearStartPrev = new Date(new Date().getFullYear() - 1, 0, 1).toISOString()
  const yearEndPrev = new Date(new Date().getFullYear() - 1, 11, 31, 23, 59, 59).toISOString()

  const formationsAnnee = await db.execute(sql`
    SELECT COALESCE(SUM(duree_heures), 0)::float AS h
    FROM conformite_formations
    WHERE collaborateur_id = ${targetId}
      AND type = 'continue'
      AND date_debut >= ${yearStart}::timestamptz
  `)
  const formationsAnneePrev = await db.execute(sql`
    SELECT COALESCE(SUM(duree_heures), 0)::float AS h
    FROM conformite_formations
    WHERE collaborateur_id = ${targetId}
      AND type = 'continue'
      AND date_debut >= ${yearStartPrev}::timestamptz
      AND date_debut <= ${yearEndPrev}::timestamptz
  `)
  const heuresAnneeFn = (r: unknown): number => {
    const rows: Array<Record<string, unknown>> =
      Array.isArray(r) ? r :
      Array.isArray((r as { rows?: unknown[] })?.rows) ? (r as { rows: Array<Record<string, unknown>> }).rows : []
    return Number(rows[0]?.h ?? 0)
  }
  const heuresAnnee = heuresAnneeFn(formationsAnnee)
  const heuresAnneePrev = heuresAnneeFn(formationsAnneePrev)

  // 4. Score global de conformité (0-100)
  const nbAlertes = certifsAvecStatut.filter((c) => c.statut === 'alerte').length
  const nbExpire = certifsAvecStatut.filter((c) => c.statut === 'expire').length
  const formationOk = heuresAnnee >= HEURES_FORMATION_OBLIGATOIRES
  const score =
    100
    - typesManquants.length * 20  // -20 par type essentiel manquant
    - nbExpire * 25               // -25 par certif expirée
    - nbAlertes * 5               // -5 par certif en alerte
    - (formationOk ? 0 : 15)      // -15 si pas les 15h de l'année

  // Statut global :
  //   ok : tout OK ; warn : alerte mais pas critique ; ko : expiration ou manquant
  let global: 'ok' | 'warn' | 'ko' = 'ok'
  if (nbExpire > 0 || typesManquants.length > 0) global = 'ko'
  else if (nbAlertes > 0 || (!formationOk && new Date().getMonth() >= 9)) global = 'warn'

  return c.json({
    collaborateurId: targetId,
    score: Math.max(0, Math.min(100, score)),
    global,
    certifs: certifsAvecStatut,
    typesManquants,
    formation: {
      heuresObligatoires: HEURES_FORMATION_OBLIGATOIRES,
      heuresAnnee,
      heuresAnneePrev,
      anneeOk: formationOk,
      pourcentage: Math.min(100, Math.round((heuresAnnee / HEURES_FORMATION_OBLIGATOIRES) * 100)),
    },
    alertes: certifsAvecStatut.filter((c) => c.statut !== 'ok'),
  })
})

// ────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────

async function getCollab(id: string): Promise<{ id: string; role: Role } | null> {
  const [collab] = await db.select({ id: schema.collaborateurs.id, role: schema.collaborateurs.role })
    .from(schema.collaborateurs).where(eq(schema.collaborateurs.id, id))
  return (collab as { id: string; role: Role } | undefined) ?? null
}
