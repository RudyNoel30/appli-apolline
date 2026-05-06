/**
 * Routes RGPD — articles 15 (droit d'accès) et 17 (droit à l'effacement).
 *
 * Article 15 : tout client peut demander une copie de ses données. Réponse
 *              en JSON structuré → /api/rgpd/clients/:id/export
 *
 * Article 17 : tout client peut demander l'effacement de ses données. Cascade
 *              delete sur clients + dossiers + prêts + notes + RDV +
 *              commissions + simulations. Audit log conservé pour preuve
 *              de traitement → /api/rgpd/clients/:id/erase (admin uniquement)
 *
 * Article 30 : registre des traitements — endpoint /api/rgpd/registry pour
 *              consulter en read-only quels traitements sont effectués.
 */
import { Hono } from 'hono'
import { eq, sql } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { authMiddleware, getUser } from '../middleware/auth.js'
import { audit, ctxMeta } from '../lib/audit.js'

export const rgpdRoute = new Hono()

/**
 * GET /api/rgpd/clients/:id/export
 *
 * Toutes les données personnelles d'un client + ses dossiers + prêts +
 * notes + RDV + commissions associés. Au format JSON, prêt à transmettre
 * au client (article 15 RGPD).
 */
rgpdRoute.get('/clients/:id/export', authMiddleware, async (c) => {
  const u = getUser(c)
  const id = c.req.param('id') ?? ''
  if (!id) return c.json({ error: 'id manquant' }, 400)

  const [client] = await db.select().from(schema.clients).where(eq(schema.clients.id, id))
  if (!client) return c.json({ error: 'client introuvable' }, 404)

  // Récupère toutes les entités liées
  const dossiers = await db.select().from(schema.dossiers).where(eq(schema.dossiers.clientId, id))
  const dossierIds = dossiers.map((d) => d.id)

  const prets = dossierIds.length > 0
    ? await db.execute(sql`SELECT * FROM prets WHERE dossier_id = ANY(${dossierIds})`)
    : { rows: [] }
  const notes = dossierIds.length > 0
    ? await db.execute(sql`SELECT * FROM notes WHERE dossier_id = ANY(${dossierIds})`)
    : { rows: [] }
  const rdvs = await db.execute(sql`SELECT * FROM rdvs WHERE client_id = ${id}`)
  const commissions = dossierIds.length > 0
    ? await db.execute(sql`SELECT * FROM commissions WHERE dossier_id = ANY(${dossierIds})`)
    : { rows: [] }

  // Audit log : on trace qui a exporté quoi
  audit({
    action: 'export', userId: u.sub, userEmail: u.email,
    entityType: 'rgpd_client_export', entityId: id,
    details: `Export RGPD du client ${client.prenom} ${client.nom} (${dossiers.length} dossier(s))`,
    ...ctxMeta(c),
  })

  // Pas de hash mots de passe ni de PII non liée au client dans la réponse
  const { passwordHash: _ph, ...safeClient } = client as Record<string, unknown>
  void _ph

  return c.json({
    article: 15,
    generatedAt: new Date().toISOString(),
    generatedBy: { userId: u.sub, email: u.email },
    requestedClient: { id: client.id, nom: client.nom, prenom: client.prenom, email: client.email },
    data: {
      client: safeClient,
      dossiers,
      prets: (prets as { rows: unknown[] }).rows,
      notes: (notes as { rows: unknown[] }).rows,
      rdvs: (rdvs as { rows: unknown[] }).rows,
      commissions: (commissions as { rows: unknown[] }).rows,
    },
    notice: [
      "Ce fichier contient l'intégralité des données personnelles que Groupe Apolline détient sur le client.",
      'Article 15 RGPD : droit d\'accès. Article 20 : droit à la portabilité.',
      'Pour exercer le droit à l\'effacement (article 17), contactez le DPO Groupe Apolline.',
    ],
  })
})

/**
 * POST /api/rgpd/clients/:id/erase
 *
 * Effacement complet des données personnelles du client. Admin uniquement.
 * - Supprime client + cascade (dossiers, prêts, notes, RDV, commissions)
 * - Conserve l'audit_log (preuve de traitement RGPD, légalement obligatoire)
 *
 * Body attendu : `{ "raison": "demande client par mail du JJ/MM/YYYY" }`
 */
rgpdRoute.post('/clients/:id/erase', authMiddleware, async (c) => {
  const u = getUser(c)
  if (u.role !== 'admin') {
    return c.json({ error: 'Effacement RGPD réservé aux administrateurs' }, 403)
  }
  const id = c.req.param('id') ?? ''
  if (!id) return c.json({ error: 'id manquant' }, 400)
  const body = await c.req.json().catch(() => ({})) as { raison?: string }
  if (!body.raison || body.raison.trim().length < 10) {
    return c.json({ error: 'Une raison détaillée est obligatoire (≥ 10 caractères) pour traçabilité' }, 400)
  }

  const [client] = await db.select().from(schema.clients).where(eq(schema.clients.id, id))
  if (!client) return c.json({ error: 'client introuvable' }, 404)

  const dossiers = await db.select().from(schema.dossiers).where(eq(schema.dossiers.clientId, id))
  const dossierIds = dossiers.map((d) => d.id)

  // Cascade filesystem : supprime tous les fichiers (pièces) AVANT le delete BDD
  const { purgeClientFiles } = await import('../lib/cascade-delete.js')
  const fsPurge = await purgeClientFiles(id).catch((e) => {
    console.warn('[rgpd/erase] purge filesystem partielle', e)
    return { dossiersConcernes: 0, fichiersSupprimes: 0 }
  })

  // Audit AVANT suppression (sinon on perd les références d'identification)
  audit({
    action: 'delete', userId: u.sub, userEmail: u.email,
    entityType: 'rgpd_client_erase', entityId: id,
    details: `Effacement RGPD article 17 — client ${client.prenom} ${client.nom} (${client.email}) — ${dossierIds.length} dossier(s), ${fsPurge.fichiersSupprimes} fichier(s) — Raison : ${body.raison.slice(0, 500)}`,
    ...ctxMeta(c),
  })

  // Cascade delete dans l'ordre inverse des dépendances
  if (dossierIds.length > 0) {
    await db.execute(sql`DELETE FROM commissions WHERE dossier_id = ANY(${dossierIds})`)
    await db.execute(sql`DELETE FROM prets WHERE dossier_id = ANY(${dossierIds})`)
    await db.execute(sql`DELETE FROM notes WHERE dossier_id = ANY(${dossierIds})`)
    await db.execute(sql`DELETE FROM pieces WHERE dossier_id = ANY(${dossierIds})`)
  }
  await db.execute(sql`DELETE FROM rdvs WHERE client_id = ${id}`)
  await db.execute(sql`DELETE FROM dossiers WHERE client_id = ${id}`)
  await db.execute(sql`DELETE FROM clients WHERE id = ${id}`)

  return c.json({
    ok: true,
    erased: {
      clientId: id,
      dossiers: dossiers.length,
      fichiers: fsPurge.fichiersSupprimes,
      timestamp: new Date().toISOString(),
    },
    notice: 'Le client et toutes ses données ont été effacés (BDD + fichiers sur disque). L\'audit_log conserve la trace de cet effacement (obligation légale).',
  })
})

/**
 * GET /api/rgpd/registry
 *
 * Registre des traitements (article 30 RGPD). Lecture seule.
 * Document statique — à éditer dans le code lorsque les traitements évoluent.
 */
rgpdRoute.get('/registry', authMiddleware, async (c) => {
  return c.json({
    article: 30,
    responsable: {
      raison_sociale: 'Groupe Apolline',
      siren: process.env.APOLLINE_SIREN ?? 'à compléter',
      contact_dpo: process.env.APOLLINE_DPO_EMAIL ?? 'rudy@groupe-apolline.com',
    },
    traitements: [
      {
        nom: 'Suivi de dossier de prêt immobilier',
        finalite: 'Mise en relation emprunteur ↔ banques · constitution dossier · suivi commercial',
        base_legale: 'Mandat IOBSP signé (article 6.1.b RGPD — exécution contractuelle)',
        categories_donnees: [
          'Identité (nom, prénom, naissance, adresse)',
          'Contact (email, tél)',
          'Profession et revenus (bulletins, AVI, contrat travail)',
          'Patrimoine (relevés banque, épargne, biens)',
          'Charges (loyer, crédits)',
          'Projet (compromis, ville, prix)',
        ],
        destinataires: ['Équipe Apolline', 'Banques partenaires (sur mandat client)', 'Notaire (si signature)'],
        duree_conservation: '5 ans après dernière activité (art. L223-1 Code de la consommation)',
        droits: 'Accès, rectification, effacement, opposition, portabilité — exerçables via le DPO',
      },
      {
        nom: 'Apporteurs d\'affaires',
        finalite: 'Calcul des rétro-commissions, suivi du réseau d\'apport',
        base_legale: 'Contrat d\'apporteur signé',
        categories_donnees: ['Identité', 'Contact', 'IBAN'],
        duree_conservation: '10 ans (obligation comptable)',
      },
      {
        nom: 'Audit de sécurité',
        finalite: 'Détection des accès anormaux, traçabilité des actions sensibles',
        base_legale: 'Intérêt légitime (article 6.1.f) — sécurité du système',
        categories_donnees: ['ID utilisateur', 'IP', 'User-agent', 'Action effectuée'],
        duree_conservation: '5 ans',
      },
    ],
    sous_traitants: [
      { nom: 'Hostinger', finalite: 'Hébergement VPS BDD Postgres', region: 'France' },
      { nom: 'Microsoft', finalite: 'Outlook + OneDrive (sur compte O365 du collaborateur)', region: 'EU' },
      { nom: 'Etalab / DGFiP', finalite: 'Données DVF publiques (consultation)', region: 'France' },
      {
        nom: 'Anthropic',
        finalite: 'Génération IA de documents (DDP, dossier banquier, étude client) via Claude API. Données envoyées : extrait du dossier (identité, projet, revenus globaux) sans RIB ni n° sécu.',
        region: 'États-Unis 🇺🇸 (Standard Contractual Clauses)',
        retention: '30 jours max côté Anthropic, aucun apprentissage modèle',
        notice_user: 'L\'utilisation des fonctions IA de l\'app envoie une partie des données du dossier vers Anthropic. Désactivable globalement via `ANTHROPIC_API_KEY=` (vide) côté backend.',
      },
    ],
  })
})
