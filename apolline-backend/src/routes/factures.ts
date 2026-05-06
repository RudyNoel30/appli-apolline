/**
 * Routes /api/factures/* — module Facturation Apolline.
 *
 *   GET    /api/factures                            → liste filtrée (avec stats)
 *   GET    /api/factures/:id                        → détail + dossier + client
 *   POST   /api/factures                            → création (numéro auto)
 *   PATCH  /api/factures/:id                        → modification partielle
 *   DELETE /api/factures/:id                        → soft delete (statut → annulee)
 *   POST   /api/factures/:id/regler                 → marque réglée (statut + dates)
 *   POST   /api/factures/:id/avoir                  → crée un avoir lié à cette facture
 *   GET    /api/factures/dossier/:dossierId         → factures d'un dossier
 *   GET    /api/factures/stats?period=...           → KPIs (à émettre, en attente, encaissé)
 *
 * Numérotation : F26-0001 / R26-0001 (compteur séquentiel par préfixe + année,
 * UPSERT atomique sur factures_counters).
 *
 * Toutes les routes nécessitent un JWT.
 */
import { Hono } from 'hono'
import { eq, and, desc, sql, gte, lte, inArray, or, ilike } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { authMiddleware, getUser } from '../middleware/auth.js'
import { audit, ctxMeta } from '../lib/audit.js'

export const facturesRoute = new Hono()

const TVA_DEFAULT_BY_TYPE: Record<string, number> = {
  honoraires: 0.20,
  comm_banque: 0,        // refacturation, pas de TVA
  comm_autre: 0.20,
  ristourne: 0,          // ristourne brute par défaut, ajustable
  avoir_honoraires: 0.20,
  avoir_comm_banque: 0,
  avoir_comm_autre: 0.20,
  avoir_ristourne: 0,
}

// Préfixe selon type : F pour les factures, R pour les ristournes
function prefixForType(type: string): 'F' | 'R' {
  return type === 'ristourne' || type === 'avoir_ristourne' ? 'R' : 'F'
}

/** Calcule HT/TVA/TTC à partir d'un montant HT et taux. Tout en centimes (entiers). */
function computeAmounts(montantHt: number, tvaTaux: number): { montantHt: number; montantTva: number; montantTtc: number } {
  const ht = Math.round(montantHt)
  const tva = Math.round(ht * tvaTaux)
  const ttc = ht + tva
  return { montantHt: ht, montantTva: tva, montantTtc: ttc }
}

/** Génère le prochain numéro pour un préfixe + année (transactionnel via UPSERT). */
async function nextRef(prefix: 'F' | 'R', year: number): Promise<string> {
  // UPSERT atomique : insère ou incrémente
  const result = await db.execute(sql`
    INSERT INTO factures_counters (prefix, year, next)
    VALUES (${prefix}, ${year}, 2)
    ON CONFLICT (prefix, year) DO UPDATE SET next = factures_counters.next + 1
    RETURNING next - 1 AS used
  `)
  const rows: Array<Record<string, unknown>> =
    Array.isArray(result) ? result :
    Array.isArray((result as { rows?: unknown[] })?.rows) ? (result as { rows: Array<Record<string, unknown>> }).rows :
    []
  const used = Number((rows[0]?.used ?? 1))
  const yy = String(year).slice(-2)
  return `${prefix}${yy}-${String(used).padStart(4, '0')}`
}

/** Paramètres d'une facture acceptés en POST/PATCH. */
type FacturePatch = {
  type?: string
  dossierId?: string
  clientId?: string | null
  partenaireType?: string | null
  partenaireId?: string | null
  partenaireNom?: string | null
  partenaireEmail?: string | null
  montantHt?: number  // EUR (pas centimes — converti côté backend)
  tvaTaux?: number
  emiseLe?: string | null
  echeanceLe?: string | null
  regleeLe?: string | null
  prevueLe?: string | null
  acteLe?: string | null
  modeReglement?: string | null
  montantRegle?: number  // EUR
  numeroPiece?: string | null
  statut?: string
  commissionId?: string | null
  factureAvoirId?: string | null
  prestation?: string | null
  infoReglement?: string | null
  commentaire?: string | null
}

// ────────────────────────────────────────────────────────────────────
// LIST avec filtres
// ────────────────────────────────────────────────────────────────────

facturesRoute.get('/', authMiddleware, async (c) => {
  const types = c.req.query('types')?.split(',').filter(Boolean) ?? null
  const statuts = c.req.query('statuts')?.split(',').filter(Boolean) ?? null
  const dossierId = c.req.query('dossierId')
  const clientId = c.req.query('clientId')
  const partenaireType = c.req.query('partenaireType')
  const since = c.req.query('since')
  const until = c.req.query('until')
  const dateField = c.req.query('dateField') as 'emise_le' | 'reglee_le' | 'prevue_le' | undefined
  const search = c.req.query('search')?.trim()
  const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 200), 1), 1000)

  const conditions: ReturnType<typeof eq>[] = []
  if (types && types.length > 0) conditions.push(inArray(schema.factures.type, types as never[]))
  if (statuts && statuts.length > 0) conditions.push(inArray(schema.factures.statut, statuts as never[]))
  if (dossierId) conditions.push(eq(schema.factures.dossierId, dossierId))
  if (clientId) conditions.push(eq(schema.factures.clientId, clientId))
  if (partenaireType) conditions.push(eq(schema.factures.partenaireType, partenaireType as never))
  if (since && dateField) conditions.push(gte((schema.factures as never)[dateField] ?? schema.factures.createdAt, since) as never)
  if (until && dateField) conditions.push(lte((schema.factures as never)[dateField] ?? schema.factures.createdAt, until) as never)
  if (search) {
    const like = `%${search}%`
    conditions.push(or(
      ilike(schema.factures.ref, like),
      ilike(schema.factures.partenaireNom, like),
      ilike(schema.factures.commentaire, like),
    ) as never)
  }

  const where = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions)
  const rows = await db.select().from(schema.factures)
    .where(where)
    .orderBy(desc(schema.factures.createdAt))
    .limit(limit)

  return c.json({ count: rows.length, factures: rows })
})

// ────────────────────────────────────────────────────────────────────
// STATS / KPIs
// ────────────────────────────────────────────────────────────────────

facturesRoute.get('/stats', authMiddleware, async (c) => {
  const days = Math.min(Math.max(Number(c.req.query('days') ?? '90'), 1), 365)
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString()

  const result = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE statut = 'prevue')::int                           AS nb_prevues,
      COUNT(*) FILTER (WHERE statut = 'emise')::int                            AS nb_emises,
      COUNT(*) FILTER (WHERE statut IN ('reglee', 'reglee_partiel'))::int      AS nb_reglees,
      COALESCE(SUM(montant_ttc) FILTER (WHERE statut = 'prevue'), 0)::int      AS mt_prevu,
      COALESCE(SUM(montant_ttc) FILTER (WHERE statut = 'emise'), 0)::int       AS mt_emis_attente,
      COALESCE(SUM(montant_regle) FILTER (WHERE reglee_le >= ${since}::timestamptz), 0)::int AS mt_encaisse_periode,
      COALESCE(SUM(montant_ttc - montant_regle) FILTER (WHERE statut IN ('emise', 'reglee_partiel') AND echeance_le < now()), 0)::int AS mt_retard
    FROM factures
    WHERE statut <> 'annulee' AND statut <> 'avoir_emis'
  `)
  const rows: Array<Record<string, unknown>> =
    Array.isArray(result) ? result :
    Array.isArray((result as { rows?: unknown[] })?.rows) ? (result as { rows: Array<Record<string, unknown>> }).rows :
    []
  const stats = rows[0] ?? {}
  return c.json({
    period: { days, since },
    nbPrevues: Number(stats.nb_prevues ?? 0),
    nbEmises: Number(stats.nb_emises ?? 0),
    nbReglees: Number(stats.nb_reglees ?? 0),
    /** Montants en centimes — le front convertit. */
    mtPrevu: Number(stats.mt_prevu ?? 0),
    mtEmisAttente: Number(stats.mt_emis_attente ?? 0),
    mtEncaissePeriode: Number(stats.mt_encaisse_periode ?? 0),
    mtRetard: Number(stats.mt_retard ?? 0),
  })
})

// ────────────────────────────────────────────────────────────────────
// GET par dossier
// ────────────────────────────────────────────────────────────────────

facturesRoute.get('/dossier/:dossierId', authMiddleware, async (c) => {
  const dossierId = c.req.param('dossierId') ?? ''
  if (!dossierId) return c.json({ error: 'dossierId manquant' }, 400)
  const rows = await db.select().from(schema.factures)
    .where(eq(schema.factures.dossierId, dossierId))
    .orderBy(desc(schema.factures.createdAt))
  return c.json({ count: rows.length, factures: rows })
})

// ────────────────────────────────────────────────────────────────────
// GET détail
// ────────────────────────────────────────────────────────────────────

facturesRoute.get('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id') ?? ''
  if (!id) return c.json({ error: 'id manquant' }, 400)
  const [facture] = await db.select().from(schema.factures).where(eq(schema.factures.id, id))
  if (!facture) return c.json({ error: 'Facture introuvable' }, 404)
  const [dossier] = await db.select().from(schema.dossiers).where(eq(schema.dossiers.id, facture.dossierId))
  const [client] = facture.clientId
    ? await db.select().from(schema.clients).where(eq(schema.clients.id, facture.clientId))
    : [null]
  const safeClient = client ? Object.fromEntries(Object.entries(client).filter(([k]) => k !== 'passwordHash')) : null
  return c.json({ facture, dossier, client: safeClient })
})

// ────────────────────────────────────────────────────────────────────
// POST création (numérotation auto)
// ────────────────────────────────────────────────────────────────────

facturesRoute.post('/', authMiddleware, async (c) => {
  const u = getUser(c)
  const meta = ctxMeta(c)
  const body = await c.req.json().catch(() => ({})) as FacturePatch

  if (!body.type || !body.dossierId) {
    return c.json({ error: 'type et dossierId requis' }, 400)
  }

  const [dossier] = await db.select().from(schema.dossiers).where(eq(schema.dossiers.id, body.dossierId))
  if (!dossier) return c.json({ error: 'Dossier introuvable' }, 404)

  // Numérotation auto
  const prefix = prefixForType(body.type)
  const ref = await nextRef(prefix, new Date().getFullYear())

  // Montants : reçu en EUR, stocké en centimes
  const montantHtCents = Math.round((body.montantHt ?? 0) * 100)
  const tvaTaux = body.tvaTaux ?? TVA_DEFAULT_BY_TYPE[body.type] ?? 0.20
  const amounts = computeAmounts(montantHtCents, tvaTaux)
  const montantRegleCents = body.montantRegle != null ? Math.round(body.montantRegle * 100) : 0

  const inserted = await db.insert(schema.factures).values({
    ref,
    type: body.type as never,
    dossierId: body.dossierId,
    clientId: body.clientId ?? dossier.clientId,
    partenaireType: (body.partenaireType ?? null) as never,
    partenaireId: body.partenaireId ?? null,
    partenaireNom: body.partenaireNom ?? null,
    partenaireEmail: body.partenaireEmail ?? null,
    montantHt: amounts.montantHt,
    tvaTaux,
    montantTva: amounts.montantTva,
    montantTtc: amounts.montantTtc,
    montantRegle: montantRegleCents,
    emiseLe: body.emiseLe ?? null,
    echeanceLe: body.echeanceLe ?? null,
    regleeLe: body.regleeLe ?? null,
    prevueLe: body.prevueLe ?? null,
    acteLe: body.acteLe ?? null,
    modeReglement: (body.modeReglement ?? null) as never,
    numeroPiece: body.numeroPiece ?? null,
    statut: (body.statut ?? (body.emiseLe ? 'emise' : 'prevue')) as never,
    commissionId: body.commissionId ?? null,
    factureAvoirId: body.factureAvoirId ?? null,
    prestation: body.prestation ?? null,
    infoReglement: body.infoReglement ?? null,
    commentaire: body.commentaire ?? null,
    createdBy: u.sub,
  } as never).returning()
  const facture = inserted[0]
  if (!facture) return c.json({ error: 'Échec de création' }, 500)

  audit({
    action: 'create', userId: u.sub, userEmail: u.email,
    entityType: 'facture', entityId: facture.id,
    details: `create ref=${ref} type=${body.type} dossier=${body.dossierId} ttc=${(amounts.montantTtc / 100).toFixed(2)}€`,
    ip: meta.ip, userAgent: meta.userAgent,
  })

  return c.json({ facture })
})

// ────────────────────────────────────────────────────────────────────
// PATCH modification
// ────────────────────────────────────────────────────────────────────

facturesRoute.patch('/:id', authMiddleware, async (c) => {
  const u = getUser(c)
  const meta = ctxMeta(c)
  const id = c.req.param('id') ?? ''
  if (!id) return c.json({ error: 'id manquant' }, 400)
  const body = await c.req.json().catch(() => ({})) as FacturePatch

  const [existing] = await db.select().from(schema.factures).where(eq(schema.factures.id, id))
  if (!existing) return c.json({ error: 'Facture introuvable' }, 404)

  const update: Partial<typeof existing> = { updatedAt: new Date().toISOString() } as never

  if (body.partenaireNom !== undefined) update.partenaireNom = body.partenaireNom
  if (body.partenaireEmail !== undefined) update.partenaireEmail = body.partenaireEmail
  if (body.partenaireType !== undefined) update.partenaireType = body.partenaireType as never
  if (body.partenaireId !== undefined) update.partenaireId = body.partenaireId
  if (body.tvaTaux !== undefined) update.tvaTaux = body.tvaTaux
  if (body.montantHt !== undefined) {
    const montantHtCents = Math.round(body.montantHt * 100)
    const tvaTaux = body.tvaTaux ?? existing.tvaTaux
    const a = computeAmounts(montantHtCents, tvaTaux)
    update.montantHt = a.montantHt
    update.montantTva = a.montantTva
    update.montantTtc = a.montantTtc
  }
  if (body.montantRegle !== undefined) update.montantRegle = Math.round(body.montantRegle * 100)
  if (body.emiseLe !== undefined) update.emiseLe = body.emiseLe ?? null
  if (body.echeanceLe !== undefined) update.echeanceLe = body.echeanceLe ?? null
  if (body.regleeLe !== undefined) update.regleeLe = body.regleeLe ?? null
  if (body.prevueLe !== undefined) update.prevueLe = body.prevueLe ?? null
  if (body.acteLe !== undefined) update.acteLe = body.acteLe ?? null
  if (body.modeReglement !== undefined) update.modeReglement = body.modeReglement as never
  if (body.numeroPiece !== undefined) update.numeroPiece = body.numeroPiece
  if (body.statut !== undefined) update.statut = body.statut as never
  if (body.prestation !== undefined) update.prestation = body.prestation
  if (body.infoReglement !== undefined) update.infoReglement = body.infoReglement
  if (body.commentaire !== undefined) update.commentaire = body.commentaire

  const [updated] = await db.update(schema.factures).set(update as never).where(eq(schema.factures.id, id)).returning()

  audit({
    action: 'update', userId: u.sub, userEmail: u.email,
    entityType: 'facture', entityId: id,
    details: `update fields=${Object.keys(body).join(',')}`,
    ip: meta.ip, userAgent: meta.userAgent,
  })

  return c.json({ facture: updated })
})

// ────────────────────────────────────────────────────────────────────
// DELETE (soft : passe en 'annulee')
// ────────────────────────────────────────────────────────────────────

facturesRoute.delete('/:id', authMiddleware, async (c) => {
  const u = getUser(c)
  const meta = ctxMeta(c)
  const id = c.req.param('id') ?? ''
  if (!id) return c.json({ error: 'id manquant' }, 400)

  const [existing] = await db.select().from(schema.factures).where(eq(schema.factures.id, id))
  if (!existing) return c.json({ error: 'Facture introuvable' }, 404)

  await db.update(schema.factures)
    .set({ statut: 'annulee', updatedAt: new Date().toISOString() } as never)
    .where(eq(schema.factures.id, id))

  audit({
    action: 'delete', userId: u.sub, userEmail: u.email,
    entityType: 'facture', entityId: id,
    details: `annule ref=${existing.ref}`,
    ip: meta.ip, userAgent: meta.userAgent,
  })

  return c.json({ ok: true })
})

// ────────────────────────────────────────────────────────────────────
// POST /:id/regler — marque comme réglée
// ────────────────────────────────────────────────────────────────────

facturesRoute.post('/:id/regler', authMiddleware, async (c) => {
  const u = getUser(c)
  const meta = ctxMeta(c)
  const id = c.req.param('id') ?? ''
  if (!id) return c.json({ error: 'id manquant' }, 400)
  const body = await c.req.json().catch(() => ({})) as {
    regleeLe?: string
    montantRegle?: number  // EUR ; si omis = montant_ttc complet
    modeReglement?: string
    numeroPiece?: string
  }

  const [existing] = await db.select().from(schema.factures).where(eq(schema.factures.id, id))
  if (!existing) return c.json({ error: 'Facture introuvable' }, 404)

  const montantRegleCents = body.montantRegle != null ? Math.round(body.montantRegle * 100) : existing.montantTtc
  const isPartial = montantRegleCents < existing.montantTtc
  const newStatut = isPartial ? 'reglee_partiel' : 'reglee'

  const [updated] = await db.update(schema.factures).set({
    statut: newStatut as never,
    regleeLe: body.regleeLe ?? new Date().toISOString(),
    montantRegle: montantRegleCents,
    modeReglement: (body.modeReglement ?? existing.modeReglement) as never,
    numeroPiece: body.numeroPiece ?? existing.numeroPiece,
    updatedAt: new Date().toISOString(),
  } as never).where(eq(schema.factures.id, id)).returning()

  audit({
    action: 'update', userId: u.sub, userEmail: u.email,
    entityType: 'facture', entityId: id,
    details: `regler ref=${existing.ref} ${(montantRegleCents / 100).toFixed(2)}€${isPartial ? ' (partiel)' : ''}`,
    ip: meta.ip, userAgent: meta.userAgent,
  })

  return c.json({ facture: updated })
})

// ────────────────────────────────────────────────────────────────────
// POST /:id/avoir — crée un avoir lié
// ────────────────────────────────────────────────────────────────────

facturesRoute.post('/:id/avoir', authMiddleware, async (c) => {
  const u = getUser(c)
  const meta = ctxMeta(c)
  const id = c.req.param('id') ?? ''
  if (!id) return c.json({ error: 'id manquant' }, 400)
  const body = await c.req.json().catch(() => ({})) as { motif?: string; montantHt?: number }

  const [src] = await db.select().from(schema.factures).where(eq(schema.factures.id, id))
  if (!src) return c.json({ error: 'Facture source introuvable' }, 404)

  // Le type d'avoir correspond au type source
  const avoirType = `avoir_${src.type}`.replace('avoir_avoir_', 'avoir_') // safe en cas de double appel
  const prefix = prefixForType(avoirType)
  const ref = await nextRef(prefix, new Date().getFullYear())

  const montantHt = body.montantHt != null ? Math.round(body.montantHt * 100) : src.montantHt
  const a = computeAmounts(-Math.abs(montantHt), src.tvaTaux) // négatif (avoir = remboursement)

  const inserted = await db.insert(schema.factures).values({
    ref,
    type: avoirType as never,
    dossierId: src.dossierId,
    clientId: src.clientId,
    partenaireType: src.partenaireType,
    partenaireId: src.partenaireId,
    partenaireNom: src.partenaireNom,
    partenaireEmail: src.partenaireEmail,
    montantHt: a.montantHt,
    tvaTaux: src.tvaTaux,
    montantTva: a.montantTva,
    montantTtc: a.montantTtc,
    emiseLe: new Date().toISOString(),
    statut: 'emise' as never,
    factureAvoirId: src.id,
    commentaire: body.motif ?? `Avoir sur ${src.ref}`,
    createdBy: u.sub,
  } as never).returning()
  const avoir = inserted[0]

  // Marque la facture source en 'avoir_emis'
  await db.update(schema.factures)
    .set({ statut: 'avoir_emis' as never, updatedAt: new Date().toISOString() } as never)
    .where(eq(schema.factures.id, src.id))

  audit({
    action: 'create', userId: u.sub, userEmail: u.email,
    entityType: 'facture', entityId: avoir?.id ?? '',
    details: `avoir ref=${ref} sur=${src.ref} ttc=${(a.montantTtc / 100).toFixed(2)}€`,
    ip: meta.ip, userAgent: meta.userAgent,
  })

  return c.json({ avoir })
})
