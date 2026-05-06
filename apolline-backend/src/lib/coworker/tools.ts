/**
 * Registry des tools disponibles pour le Coworker (Claude tool_use).
 *
 * Chaque tool a :
 *  - un schéma JSON Schema pour Anthropic (input_schema)
 *  - un handler async qui s'exécute côté backend avec accès BDD/skills
 *  - un niveau de risque (1 = lecture, 2 = mutations cadrées, 3 = création/suppression)
 *
 * Les tools de niveau 3 sont DÉSACTIVÉS par défaut — il faut les passer en
 * `enabled: true` explicitement (contrôlé via /api/coworker/chat?levels=1,2 par exemple).
 *
 * Conventions :
 *  - Les tools mutatifs (niveau 2+) sont audités dans `audit_log` (action='coworker_tool_call')
 *  - En cas d'erreur, on renvoie { error: string } — Claude le gère gracieusement
 *  - Les retours sont des objets JS sérialisables (pas de Date raw, pas de circular refs)
 */
import { eq, ilike, or, sql, desc, and } from 'drizzle-orm'
import { db, schema } from '../../db/index.js'
import { audit } from '../audit.js'
import { generate as generateAi } from '../anthropic.js'
import { listSkillNames, getSkill } from '../skills/loader.js'

export type ToolLevel = 1 | 2 | 3

export type ToolContext = {
  userId: string
  userEmail: string
  userRole: string
  /** Contexte UI au moment de l'envoi (dossierId courant, page, etc.) */
  uiContext: Record<string, unknown>
  /** ip / userAgent pour audit */
  ip: string
  userAgent: string
}

export type ToolDefinition = {
  name: string
  description: string
  level: ToolLevel
  /** Schéma JSON pour input — converti pour Anthropic */
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
  handler: (input: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>
}

// ─────────────────────────────────────────────────────────────────────────────
// NIVEAU 1 — LECTURE (pas d'audit, lecture seule en BDD)
// ─────────────────────────────────────────────────────────────────────────────

const list_dossiers: ToolDefinition = {
  name: 'list_dossiers',
  description: 'Recherche des dossiers dans Apolline. Filtre optionnel par texte (nom client, ref, ville) et statut. Retourne max 20 résultats. Utilise ce tool dès que l\'utilisateur mentionne un dossier ou demande à voir des dossiers.',
  level: 1,
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Texte recherché (nom, prénom, référence, ville)' },
      statut: { type: 'string', description: 'Filtre statut exact : R0, R1_prevu, R1_fait, montage, depot_banque, accord, signature, archive' },
      limit: { type: 'number', description: 'Nombre max de résultats (défaut 20)' },
    },
  },
  handler: async (input) => {
    const q = typeof input.query === 'string' ? input.query.trim() : ''
    const statut = typeof input.statut === 'string' ? input.statut : null
    const limit = Math.min(Math.max(Number(input.limit ?? 20), 1), 50)

    let where = undefined
    const conditions = []
    if (q) {
      const like = `%${q}%`
      conditions.push(or(
        ilike(schema.dossiers.clientNom, like),
        ilike(schema.dossiers.ref, like),
        ilike(schema.dossiers.villeBien, like),
      ))
    }
    if (statut) conditions.push(eq(schema.dossiers.statut, statut))
    if (conditions.length === 1) where = conditions[0]
    else if (conditions.length > 1) where = and(...conditions)

    const rows = await db.select({
      id: schema.dossiers.id,
      ref: schema.dossiers.ref,
      clientNom: schema.dossiers.clientNom,
      statut: schema.dossiers.statut,
      typeProjet: schema.dossiers.typeProjet,
      villeBien: schema.dossiers.villeBien,
      montantBien: schema.dossiers.montantBien,
      montantPret: schema.dossiers.montantPret,
      hcsfOk: schema.dossiers.hcsfOk,
      updatedAt: schema.dossiers.updatedAt,
    }).from(schema.dossiers)
      .where(where)
      .orderBy(desc(schema.dossiers.updatedAt))
      .limit(limit)

    return { count: rows.length, dossiers: rows }
  },
}

const get_dossier: ToolDefinition = {
  name: 'get_dossier',
  description: 'Retourne la fiche complète d\'un dossier (champs métier, prêts, notes, pièces). Utilise ce tool quand on connaît l\'ID exact ou la référence.',
  level: 1,
  input_schema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'UUID du dossier OU référence interne (ex: "DOS-2026-042")' },
    },
    required: ['id'],
  },
  handler: async (input) => {
    const id = String(input.id ?? '').trim()
    if (!id) return { error: 'id requis' }
    // Cherche par UUID ou par ref
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    const [dossier] = isUuid
      ? await db.select().from(schema.dossiers).where(eq(schema.dossiers.id, id))
      : await db.select().from(schema.dossiers).where(eq(schema.dossiers.ref, id))
    if (!dossier) return { error: `Dossier "${id}" introuvable` }

    const [client] = await db.select().from(schema.clients).where(eq(schema.clients.id, dossier.clientId))
    const prets = await db.select().from(schema.prets).where(eq(schema.prets.dossierId, dossier.id))
    const dossierNotes = await db.select().from(schema.notes).where(eq(schema.notes.dossierId, dossier.id))
    const dossierPieces = await db.select({
      id: schema.pieces.id, categorie: schema.pieces.categorie, libelle: schema.pieces.libelle,
      filename: schema.pieces.filename, statut: schema.pieces.statut,
    }).from(schema.pieces).where(eq(schema.pieces.dossierId, dossier.id))

    const safeClient = client ? Object.fromEntries(
      Object.entries(client).filter(([k]) => k !== 'passwordHash')
    ) : null

    return { dossier, client: safeClient, prets, notes: dossierNotes, pieces: dossierPieces }
  },
}

const list_clients: ToolDefinition = {
  name: 'list_clients',
  description: 'Recherche des clients/prospects par nom, prénom ou email. Retourne max 20 résultats.',
  level: 1,
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Texte recherché' },
      statut: { type: 'string', description: '"prospect" ou "client"' },
      limit: { type: 'number' },
    },
  },
  handler: async (input) => {
    const q = typeof input.query === 'string' ? input.query.trim() : ''
    const limit = Math.min(Math.max(Number(input.limit ?? 20), 1), 50)
    const conditions = []
    if (q) {
      const like = `%${q}%`
      conditions.push(or(
        ilike(schema.clients.nom, like),
        ilike(schema.clients.prenom, like),
        ilike(schema.clients.email, like),
      ))
    }
    if (input.statut === 'prospect' || input.statut === 'client') {
      conditions.push(eq(schema.clients.statutCommercial, input.statut))
    }
    const where = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions)

    const rows = await db.select({
      id: schema.clients.id,
      prenom: schema.clients.prenom,
      nom: schema.clients.nom,
      email: schema.clients.email,
      tel: schema.clients.tel,
      ville: schema.clients.ville,
      profession: schema.clients.profession,
      revenuMensuelNet: schema.clients.revenuMensuelNet,
      statutCommercial: schema.clients.statutCommercial,
      lastActivity: schema.clients.lastActivity,
    }).from(schema.clients)
      .where(where)
      .orderBy(desc(schema.clients.lastActivity))
      .limit(limit)

    return { count: rows.length, clients: rows }
  },
}

const get_client: ToolDefinition = {
  name: 'get_client',
  description: 'Retourne la fiche complète d\'un client par UUID, plus la liste de ses dossiers.',
  level: 1,
  input_schema: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  },
  handler: async (input) => {
    const id = String(input.id ?? '')
    const [client] = await db.select().from(schema.clients).where(eq(schema.clients.id, id))
    if (!client) return { error: `Client "${id}" introuvable` }
    const dossiers = await db.select({
      id: schema.dossiers.id, ref: schema.dossiers.ref, statut: schema.dossiers.statut,
      typeProjet: schema.dossiers.typeProjet, villeBien: schema.dossiers.villeBien,
      montantBien: schema.dossiers.montantBien, updatedAt: schema.dossiers.updatedAt,
    }).from(schema.dossiers).where(eq(schema.dossiers.clientId, id)).orderBy(desc(schema.dossiers.updatedAt))
    return { client, dossiers }
  },
}

const compute_hcsf: ToolDefinition = {
  name: 'compute_hcsf',
  description: 'Calcule le taux d\'endettement et la conformité HCSF (max 35% endettement, max 25 ans durée). Donne aussi la mensualité estimée et le reste à vivre.',
  level: 1,
  input_schema: {
    type: 'object',
    properties: {
      montant_pret: { type: 'number', description: 'Montant emprunté en EUR' },
      duree_mois: { type: 'number', description: 'Durée en mois' },
      taux_nominal: { type: 'number', description: 'Taux nominal annuel en décimal (ex: 0.034 pour 3,4%)' },
      taux_assurance: { type: 'number', description: 'Taux assurance annuel sur capital initial (ex: 0.0036)' },
      revenu_mensuel: { type: 'number', description: 'Revenu net mensuel total du ménage en EUR' },
      charges_mensuelles: { type: 'number', description: 'Autres charges mensuelles (crédits, pensions) en EUR' },
    },
    required: ['montant_pret', 'duree_mois', 'taux_nominal', 'revenu_mensuel'],
  },
  handler: async (input) => {
    const M = Number(input.montant_pret)
    const n = Number(input.duree_mois)
    const tx = Number(input.taux_nominal)
    const txA = Number(input.taux_assurance ?? 0)
    const rev = Number(input.revenu_mensuel)
    const charges = Number(input.charges_mensuelles ?? 0)
    if (M <= 0 || n <= 0 || tx < 0 || rev <= 0) return { error: 'Paramètres invalides' }
    const i = tx / 12
    const mensHorsAss = i === 0 ? M / n : (M * i) / (1 - Math.pow(1 + i, -n))
    const mensAss = (M * txA) / 12
    const mensTotale = mensHorsAss + mensAss
    const endettement = (mensTotale + charges) / rev
    const dureeAns = n / 12
    const resteAVivre = rev - mensTotale - charges
    return {
      mensualite_hors_assurance_eur: Math.round(mensHorsAss * 100) / 100,
      mensualite_assurance_eur: Math.round(mensAss * 100) / 100,
      mensualite_totale_eur: Math.round(mensTotale * 100) / 100,
      taux_endettement: Math.round(endettement * 10000) / 10000,
      taux_endettement_pct: `${(endettement * 100).toFixed(2)}%`,
      duree_ans: dureeAns,
      reste_a_vivre_eur: Math.round(resteAVivre * 100) / 100,
      hcsf: {
        endettement_ok: endettement <= 0.35,
        duree_ok: dureeAns <= 25,
        global_ok: endettement <= 0.35 && dureeAns <= 25,
      },
    }
  },
}

const list_pieces: ToolDefinition = {
  name: 'list_pieces',
  description: 'Liste les pièces (P1-P5) d\'un dossier avec leur statut.',
  level: 1,
  input_schema: {
    type: 'object',
    properties: { dossier_id: { type: 'string' } },
    required: ['dossier_id'],
  },
  handler: async (input) => {
    const dossierId = String(input.dossier_id ?? '')
    const rows = await db.select({
      id: schema.pieces.id, categorie: schema.pieces.categorie, libelle: schema.pieces.libelle,
      filename: schema.pieces.filename, mimeType: schema.pieces.mimeType, sizeBytes: schema.pieces.sizeBytes,
      statut: schema.pieces.statut, uploadedAt: schema.pieces.uploadedAt,
    }).from(schema.pieces).where(eq(schema.pieces.dossierId, dossierId))
    return { count: rows.length, pieces: rows }
  },
}

const get_current_context: ToolDefinition = {
  name: 'get_current_context',
  description: 'Retourne ce que l\'utilisateur regarde actuellement dans Apolline (page courante, dossier ou client ouvert). Utile pour comprendre les références implicites comme "ce dossier" ou "ce client".',
  level: 1,
  input_schema: { type: 'object', properties: {} },
  handler: async (_input, ctx) => {
    return { ...ctx.uiContext, user: { id: ctx.userId, email: ctx.userEmail, role: ctx.userRole } }
  },
}

const list_skills: ToolDefinition = {
  name: 'list_skills',
  description: 'Liste les skills Apolline disponibles (DDP, dossier banquier, étude client R1, etc.). À consulter avant d\'invoquer run_skill si l\'utilisateur n\'a pas précisé.',
  level: 1,
  input_schema: { type: 'object', properties: {} },
  handler: async () => {
    const skills = listSkillNames().map((name) => {
      const s = getSkill(name)
      return { name, title: s?.meta.name ?? name, description: s?.meta.description ?? '' }
    })
    return { count: skills.length, skills }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// NIVEAU 2 — MUTATIONS CADRÉES (auditées)
// ─────────────────────────────────────────────────────────────────────────────

const create_note: ToolDefinition = {
  name: 'create_note',
  description: 'Ajoute une note à un dossier au nom de l\'utilisateur courant. Utile pour consigner un point évoqué en RDV ou un suivi.',
  level: 2,
  input_schema: {
    type: 'object',
    properties: {
      dossier_id: { type: 'string', description: 'UUID du dossier' },
      contenu: { type: 'string', description: 'Texte de la note (max 2000 caractères)' },
    },
    required: ['dossier_id', 'contenu'],
  },
  handler: async (input, ctx) => {
    const dossierId = String(input.dossier_id ?? '')
    const contenu = String(input.contenu ?? '').slice(0, 2000)
    if (!dossierId || !contenu) return { error: 'dossier_id et contenu requis' }
    const [collab] = await db.select().from(schema.collaborateurs).where(eq(schema.collaborateurs.id, ctx.userId))
    if (!collab) return { error: 'Utilisateur introuvable' }
    const inserted = await db.insert(schema.notes).values({
      dossierId, contenu, auteurId: ctx.userId,
      auteurNom: `${collab.prenom} ${collab.nom}`,
    }).returning()
    const note = inserted[0]
    if (!note) return { error: 'Impossible de créer la note' }
    audit({
      action: 'create', userId: ctx.userId, userEmail: ctx.userEmail,
      entityType: 'coworker_tool_call', entityId: `create_note:${note.id}`,
      details: `tool=create_note dossier=${dossierId} note=${note.id}`,
      ip: ctx.ip, userAgent: ctx.userAgent,
    })
    return { ok: true, note }
  },
}

const update_dossier_statut: ToolDefinition = {
  name: 'update_dossier_statut',
  description: 'Déplace un dossier dans le pipeline (change son statut). Statuts valides : R0, R1_prevu, R1_fait, montage, depot_banque, accord, signature, archive.',
  level: 2,
  input_schema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'UUID du dossier' },
      statut: { type: 'string', description: 'Nouveau statut' },
    },
    required: ['id', 'statut'],
  },
  handler: async (input, ctx) => {
    const id = String(input.id ?? '')
    const statut = String(input.statut ?? '')
    const VALID = ['R0', 'R1_prevu', 'R1_fait', 'montage', 'depot_banque', 'accord', 'signature', 'archive']
    if (!VALID.includes(statut)) return { error: `Statut invalide. Valides : ${VALID.join(', ')}` }
    const [before] = await db.select({ statut: schema.dossiers.statut }).from(schema.dossiers).where(eq(schema.dossiers.id, id))
    if (!before) return { error: `Dossier ${id} introuvable` }
    const [updated] = await db.update(schema.dossiers).set({ statut, updatedAt: new Date().toISOString() })
      .where(eq(schema.dossiers.id, id)).returning({ id: schema.dossiers.id, ref: schema.dossiers.ref, statut: schema.dossiers.statut })
    audit({
      action: 'update', userId: ctx.userId, userEmail: ctx.userEmail,
      entityType: 'coworker_tool_call', entityId: `update_dossier_statut:${id}`,
      details: `tool=update_dossier_statut dossier=${id} ${before.statut}→${statut}`,
      ip: ctx.ip, userAgent: ctx.userAgent,
    })
    return { ok: true, dossier: updated, previous_statut: before.statut }
  },
}

const update_dossier: ToolDefinition = {
  name: 'update_dossier',
  description: 'Modifie certains champs d\'un dossier (montants, durée, dates, type projet…). Champs autorisés uniquement.',
  level: 2,
  input_schema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'UUID du dossier' },
      patch: {
        type: 'object',
        description: 'Champs à mettre à jour. Autorisés : typeProjet, villeBien, montantBien, montantPret, apport, dureeMois, r1Date, signatureDate',
        properties: {
          typeProjet: { type: 'string' },
          villeBien: { type: 'string' },
          montantBien: { type: 'number' },
          montantPret: { type: 'number' },
          apport: { type: 'number' },
          dureeMois: { type: 'number' },
          r1Date: { type: 'string' },
          signatureDate: { type: 'string' },
        },
      },
    },
    required: ['id', 'patch'],
  },
  handler: async (input, ctx) => {
    const id = String(input.id ?? '')
    const patchInput = (input.patch ?? {}) as Record<string, unknown>
    const ALLOWED = ['typeProjet', 'villeBien', 'montantBien', 'montantPret', 'apport', 'dureeMois', 'r1Date', 'signatureDate']
    const patch: Record<string, unknown> = {}
    for (const k of ALLOWED) if (k in patchInput) patch[k] = patchInput[k]
    if (Object.keys(patch).length === 0) return { error: 'Aucun champ autorisé fourni dans patch' }
    patch.updatedAt = new Date().toISOString()
    const [updated] = await db.update(schema.dossiers).set(patch as never)
      .where(eq(schema.dossiers.id, id)).returning()
    if (!updated) return { error: `Dossier ${id} introuvable` }
    audit({
      action: 'update', userId: ctx.userId, userEmail: ctx.userEmail,
      entityType: 'coworker_tool_call', entityId: `update_dossier:${id}`,
      details: `tool=update_dossier dossier=${id} fields=${Object.keys(patch).filter(k => k !== 'updatedAt').join(',')}`,
      ip: ctx.ip, userAgent: ctx.userAgent,
    })
    return { ok: true, dossier: updated }
  },
}

const run_skill: ToolDefinition = {
  name: 'run_skill',
  description: 'Invoque un skill Apolline sur un dossier (ddp-pdf, dossier-html, dossier-r1-etude-client, …). Le résultat est le HTML/JSON/texte généré par Claude. Coût ~0,05-0,20€ par invocation. Utiliser list_skills d\'abord pour voir les skills disponibles.',
  level: 2,
  input_schema: {
    type: 'object',
    properties: {
      skill_name: { type: 'string', description: 'Nom du skill (ex: "dossier-html-pro")' },
      dossier_id: { type: 'string', description: 'UUID du dossier à traiter' },
    },
    required: ['skill_name', 'dossier_id'],
  },
  handler: async (input, ctx) => {
    const skillName = String(input.skill_name ?? '')
    const dossierId = String(input.dossier_id ?? '')
    if (!getSkill(skillName)) return { error: `Skill "${skillName}" introuvable` }
    const [dossier] = await db.select().from(schema.dossiers).where(eq(schema.dossiers.id, dossierId))
    if (!dossier) return { error: `Dossier ${dossierId} introuvable` }
    const [client] = await db.select().from(schema.clients).where(eq(schema.clients.id, dossier.clientId))
    const prets = await db.select().from(schema.prets).where(eq(schema.prets.dossierId, dossierId))
    const notesRows = await db.select().from(schema.notes).where(eq(schema.notes.dossierId, dossierId))
    const banques = await db.select().from(schema.banques)
    const piecesRows = await db.select({
      id: schema.pieces.id, categorie: schema.pieces.categorie, libelle: schema.pieces.libelle,
      filename: schema.pieces.filename, statut: schema.pieces.statut,
    }).from(schema.pieces).where(eq(schema.pieces.dossierId, dossierId))
    const safeClient = client ? Object.fromEntries(Object.entries(client).filter(([k]) => k !== 'passwordHash')) : null

    const result = await generateAi({
      skill: skillName,
      context: { dossier, client: safeClient, prets, notes: notesRows, banques, pieces: piecesRows,
        courtier: { id: ctx.userId, email: ctx.userEmail } },
    })
    audit({
      action: 'create', userId: ctx.userId, userEmail: ctx.userEmail,
      entityType: 'ai_generation', entityId: `coworker:${skillName}:${dossierId}`,
      details: `skill=${skillName} model=${result.model} cost=${result.usage.estimatedCostEur}€ tokens_in=${result.usage.inputTokens} tokens_out=${result.usage.outputTokens} via=coworker`,
      ip: ctx.ip, userAgent: ctx.userAgent,
    })
    return {
      ok: true,
      skill: skillName,
      content_preview: result.content.slice(0, 500) + (result.content.length > 500 ? '…' : ''),
      content_length: result.content.length,
      model: result.model,
      cost_eur: result.usage.estimatedCostEur,
      tokens_in: result.usage.inputTokens,
      tokens_out: result.usage.outputTokens,
      // Le frontend pourra récupérer le HTML complet via un autre canal (l'objet en mémoire,
      // ou via un endpoint /api/coworker/last-skill-result/:convId). Pour le moment on
      // donne juste un aperçu — Claude n'a pas besoin du HTML complet pour répondre à l'user.
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// NIVEAU 3 — CRÉATION / SUPPRESSION (confirmation utilisateur requise)
// Mécanisme : le tool renvoie d'abord { needs_confirmation: true, ... } et
// n'exécute QUE si `confirmed: true` est passé dans l'input. Le frontend
// affiche une UI de confirmation et rejoue le tool avec ce flag.
// ─────────────────────────────────────────────────────────────────────────────

const create_dossier: ToolDefinition = {
  name: 'create_dossier',
  description: 'Crée un nouveau dossier pour un client existant. SENSIBLE : nécessite confirmation utilisateur (l\'app affichera une carte "Confirmer la création" avant exécution).',
  level: 3,
  input_schema: {
    type: 'object',
    properties: {
      client_id: { type: 'string', description: 'UUID du client (utiliser list_clients d\'abord)' },
      type_projet: { type: 'string', description: 'Ancien | Neuf | VEFA | Construction | Terrain | Rachat | Travaux' },
      ville_bien: { type: 'string' },
      montant_bien: { type: 'number', description: 'Prix FAI en EUR' },
      montant_pret: { type: 'number', description: 'Montant emprunté en EUR' },
      apport: { type: 'number', description: 'Apport personnel en EUR' },
      duree_mois: { type: 'number', description: 'Durée en mois (240 = 20 ans)' },
      confirmed: { type: 'boolean', description: 'Mettre true uniquement après confirmation utilisateur explicite' },
    },
    required: ['client_id', 'type_projet'],
  },
  handler: async (input, ctx) => {
    const confirmed = input.confirmed === true
    if (!confirmed) {
      return {
        needs_confirmation: true,
        action: 'create_dossier',
        summary: `Créer un dossier pour le client ${input.client_id} : ${input.type_projet} à ${input.ville_bien ?? '—'} (${input.montant_bien ?? '—'} €)`,
        params: input,
      }
    }
    const clientId = String(input.client_id)
    const [client] = await db.select().from(schema.clients).where(eq(schema.clients.id, clientId))
    if (!client) return { error: `Client ${clientId} introuvable` }
    const ref = `DOS-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000 + 10000)}`
    const inserted = await db.insert(schema.dossiers).values({
      clientId, ref, clientNom: `${client.nom} ${client.prenom}`,
      statut: 'R0',
      typeProjet: String(input.type_projet ?? 'Ancien'),
      villeBien: String(input.ville_bien ?? ''),
      montantBien: Number(input.montant_bien ?? 0),
      montantPret: Number(input.montant_pret ?? 0),
      apport: Number(input.apport ?? 0),
      dureeMois: Number(input.duree_mois ?? 240),
    } as never).returning()
    const dossier = inserted[0]
    if (!dossier) return { error: 'Impossible de créer le dossier' }
    audit({
      action: 'create', userId: ctx.userId, userEmail: ctx.userEmail,
      entityType: 'coworker_tool_call', entityId: `create_dossier:${dossier.id}`,
      details: `tool=create_dossier dossier=${dossier.id} ref=${ref} client=${clientId}`,
      ip: ctx.ip, userAgent: ctx.userAgent,
    })
    return { ok: true, dossier }
  },
}

const create_client: ToolDefinition = {
  name: 'create_client',
  description: 'Crée un nouveau client/prospect. SENSIBLE : nécessite confirmation utilisateur.',
  level: 3,
  input_schema: {
    type: 'object',
    properties: {
      prenom: { type: 'string' },
      nom: { type: 'string' },
      email: { type: 'string' },
      tel: { type: 'string' },
      ville: { type: 'string' },
      profession: { type: 'string' },
      revenu_mensuel_net: { type: 'number' },
      statut_commercial: { type: 'string', description: '"prospect" ou "client" (défaut prospect)' },
      confirmed: { type: 'boolean' },
    },
    required: ['prenom', 'nom', 'email'],
  },
  handler: async (input, ctx) => {
    const confirmed = input.confirmed === true
    if (!confirmed) {
      return {
        needs_confirmation: true,
        action: 'create_client',
        summary: `Créer un nouveau ${input.statut_commercial ?? 'prospect'} : ${input.prenom} ${input.nom} (${input.email})`,
        params: input,
      }
    }
    const inserted = await db.insert(schema.clients).values({
      prenom: String(input.prenom),
      nom: String(input.nom),
      email: String(input.email),
      tel: String(input.tel ?? ''),
      ville: String(input.ville ?? ''),
      profession: String(input.profession ?? ''),
      revenuMensuelNet: Number(input.revenu_mensuel_net ?? 0),
      statutCommercial: (input.statut_commercial === 'client' ? 'client' : 'prospect') as 'prospect' | 'client',
    } as never).returning()
    const client = inserted[0]
    if (!client) return { error: 'Impossible de créer le client' }
    audit({
      action: 'create', userId: ctx.userId, userEmail: ctx.userEmail,
      entityType: 'coworker_tool_call', entityId: `create_client:${client.id}`,
      details: `tool=create_client client=${client.id}`,
      ip: ctx.ip, userAgent: ctx.userAgent,
    })
    return { ok: true, client }
  },
}

const search_recent_audit: ToolDefinition = {
  name: 'search_recent_audit',
  description: 'Cherche dans le journal d\'audit (actions récentes des collaborateurs : créations, modifs, exports, logins). Admin uniquement.',
  level: 2,
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Filtre sur details (ex: "delete dossier")' },
      days: { type: 'number', description: 'Période en jours (défaut 7, max 90)' },
      limit: { type: 'number' },
    },
  },
  handler: async (input, ctx) => {
    if (ctx.userRole !== 'admin') return { error: 'Réservé aux admins' }
    const days = Math.min(Math.max(Number(input.days ?? 7), 1), 90)
    const limit = Math.min(Math.max(Number(input.limit ?? 50), 1), 200)
    const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString()
    const q = typeof input.query === 'string' ? input.query : ''
    const rows = await db.execute(sql`
      SELECT id, ts, user_email, action, entity_type, entity_id, details
      FROM audit_log
      WHERE ts >= ${since}::timestamptz
      ${q ? sql`AND details ILIKE ${'%' + q + '%'}` : sql``}
      ORDER BY ts DESC LIMIT ${limit}
    `)
    const result = (rows as unknown as { rows?: unknown[] })?.rows ?? (Array.isArray(rows) ? rows : [])
    return { count: (result as unknown[]).length, entries: result }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTURATION (Niveau 1 + 2 + 3)
// Module facturation Cifacil-style : honoraires, commissions, ristournes, avoirs.
// ─────────────────────────────────────────────────────────────────────────────

const list_factures: ToolDefinition = {
  name: 'list_factures',
  description: 'Liste les factures (honoraires/commissions/ristournes/avoirs). Filtres : dossier_id, statut (prevue/emise/reglee_partiel/reglee/avoir_emis/annulee), période, type. Retourne max 50.',
  level: 1,
  input_schema: {
    type: 'object',
    properties: {
      dossier_id: { type: 'string', description: 'UUID du dossier (optionnel)' },
      statut: { type: 'string', description: 'Filtre statut exact' },
      type: { type: 'string', description: 'honoraires | comm_banque | comm_autre | ristourne | avoir_*' },
      since: { type: 'string', description: 'Date ISO depuis quand (filtre sur emise_le)' },
      limit: { type: 'number' },
    },
  },
  handler: async (input) => {
    const limit = Math.min(Math.max(Number(input.limit ?? 50), 1), 200)
    const conditions = []
    if (input.dossier_id) conditions.push(eq(schema.factures.dossierId, String(input.dossier_id)))
    if (input.statut) conditions.push(eq(schema.factures.statut, input.statut as never))
    if (input.type) conditions.push(eq(schema.factures.type, input.type as never))
    const where = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions)
    const rows = await db.select({
      id: schema.factures.id, ref: schema.factures.ref, type: schema.factures.type,
      dossierId: schema.factures.dossierId, partenaireNom: schema.factures.partenaireNom,
      montantTtc: schema.factures.montantTtc, montantRegle: schema.factures.montantRegle,
      statut: schema.factures.statut, emiseLe: schema.factures.emiseLe, echeanceLe: schema.factures.echeanceLe,
    }).from(schema.factures).where(where).orderBy(desc(schema.factures.createdAt)).limit(limit)
    // Convertit montants centimes → EUR pour Claude
    const factures = rows.map(r => ({
      ...r,
      montant_ttc_eur: r.montantTtc / 100,
      montant_regle_eur: r.montantRegle / 100,
    }))
    return { count: factures.length, factures }
  },
}

const get_facture: ToolDefinition = {
  name: 'get_facture',
  description: 'Détail complet d\'une facture par ID ou par ref (ex: F26-0042).',
  level: 1,
  input_schema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'UUID OU ref (F26-0042)' } },
    required: ['id'],
  },
  handler: async (input) => {
    const id = String(input.id ?? '')
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    const [facture] = isUuid
      ? await db.select().from(schema.factures).where(eq(schema.factures.id, id))
      : await db.select().from(schema.factures).where(eq(schema.factures.ref, id))
    if (!facture) return { error: `Facture "${id}" introuvable` }
    return {
      ...facture,
      montant_ht_eur: facture.montantHt / 100,
      montant_tva_eur: facture.montantTva / 100,
      montant_ttc_eur: facture.montantTtc / 100,
      montant_regle_eur: facture.montantRegle / 100,
    }
  },
}

const create_facture: ToolDefinition = {
  name: 'create_facture',
  description: 'Crée une facture (honoraires/comm_banque/comm_autre/ristourne) ou un avoir. SENSIBLE Niveau 3 : nécessite confirmation utilisateur. Numérotation auto (F26-NNNN ou R26-NNNN).',
  level: 3,
  input_schema: {
    type: 'object',
    properties: {
      dossier_id: { type: 'string' },
      type: { type: 'string', description: 'honoraires | comm_banque | comm_autre | ristourne | avoir_*' },
      partenaire_nom: { type: 'string' },
      partenaire_email: { type: 'string' },
      montant_ht_eur: { type: 'number', description: 'En EUR (pas centimes)' },
      tva_taux: { type: 'number', description: '0.20 par défaut sur honoraires, 0 sur commissions banque' },
      emise_le: { type: 'string', description: 'Date ISO (par défaut aujourd\'hui)' },
      echeance_le: { type: 'string' },
      prestation: { type: 'string' },
      confirmed: { type: 'boolean' },
    },
    required: ['dossier_id', 'type', 'montant_ht_eur'],
  },
  handler: async (input, ctx) => {
    if (input.confirmed !== true) {
      return {
        needs_confirmation: true,
        action: 'create_facture',
        summary: `Créer une facture ${input.type} de ${input.montant_ht_eur} € HT pour ${input.partenaire_nom ?? 'le partenaire'} (dossier ${input.dossier_id})`,
        params: input,
      }
    }
    const dossierId = String(input.dossier_id)
    const [dossier] = await db.select().from(schema.dossiers).where(eq(schema.dossiers.id, dossierId))
    if (!dossier) return { error: 'Dossier introuvable' }

    // Numérotation
    const type = String(input.type)
    const prefix = (type === 'ristourne' || type === 'avoir_ristourne') ? 'R' : 'F'
    const year = new Date().getFullYear()
    const counterRes = await db.execute(sql`
      INSERT INTO factures_counters (prefix, year, next)
      VALUES (${prefix}, ${year}, 2)
      ON CONFLICT (prefix, year) DO UPDATE SET next = factures_counters.next + 1
      RETURNING next - 1 AS used
    `)
    const counterRows: Array<Record<string, unknown>> =
      Array.isArray(counterRes) ? counterRes :
      Array.isArray((counterRes as { rows?: unknown[] })?.rows) ? (counterRes as { rows: Array<Record<string, unknown>> }).rows :
      []
    const used = Number(counterRows[0]?.used ?? 1)
    const ref = `${prefix}${String(year).slice(-2)}-${String(used).padStart(4, '0')}`

    const TVA_DEFAULT: Record<string, number> = {
      honoraires: 0.20, comm_banque: 0, comm_autre: 0.20, ristourne: 0,
      avoir_honoraires: 0.20, avoir_comm_banque: 0, avoir_comm_autre: 0.20, avoir_ristourne: 0,
    }
    const tvaTaux = input.tva_taux != null ? Number(input.tva_taux) : (TVA_DEFAULT[type] ?? 0.20)
    const ht = Math.round(Number(input.montant_ht_eur) * 100)
    const tva = Math.round(ht * tvaTaux)
    const ttc = ht + tva

    const inserted = await db.insert(schema.factures).values({
      ref, type: type as never,
      dossierId, clientId: dossier.clientId,
      partenaireNom: (input.partenaire_nom as string) ?? null,
      partenaireEmail: (input.partenaire_email as string) ?? null,
      montantHt: ht, tvaTaux, montantTva: tva, montantTtc: ttc,
      emiseLe: (input.emise_le as string) ?? new Date().toISOString(),
      echeanceLe: (input.echeance_le as string) ?? null,
      prestation: (input.prestation as string) ?? null,
      statut: 'emise' as never,
      createdBy: ctx.userId,
    } as never).returning()
    const facture = inserted[0]
    if (!facture) return { error: 'Échec insertion' }

    audit({
      action: 'create', userId: ctx.userId, userEmail: ctx.userEmail,
      entityType: 'coworker_tool_call', entityId: `create_facture:${facture.id}`,
      details: `tool=create_facture ref=${ref} type=${type} ttc=${(ttc / 100).toFixed(2)}€`,
      ip: ctx.ip, userAgent: ctx.userAgent,
    })
    return { ok: true, facture: { ...facture, montant_ttc_eur: ttc / 100 } }
  },
}

const mark_facture_reglee: ToolDefinition = {
  name: 'mark_facture_reglee',
  description: 'Marque une facture comme réglée (statut → reglee, date règlement, mode, n° pièce). Niveau 2 — exécuté directement.',
  level: 2,
  input_schema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'UUID OU ref (F26-0042)' },
      reglee_le: { type: 'string', description: 'Date ISO (défaut: aujourd\'hui)' },
      montant_regle_eur: { type: 'number', description: 'Si omis = montant TTC complet' },
      mode_reglement: { type: 'string', description: 'virement | cheque | prelevement | cb | numeraire | via_notaire | via_banque | autre' },
      numero_piece: { type: 'string' },
    },
    required: ['id'],
  },
  handler: async (input, ctx) => {
    const id = String(input.id ?? '')
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    const [facture] = isUuid
      ? await db.select().from(schema.factures).where(eq(schema.factures.id, id))
      : await db.select().from(schema.factures).where(eq(schema.factures.ref, id))
    if (!facture) return { error: `Facture "${id}" introuvable` }

    const montantRegleCents = input.montant_regle_eur != null ? Math.round(Number(input.montant_regle_eur) * 100) : facture.montantTtc
    const isPartial = montantRegleCents < facture.montantTtc
    const newStatut = isPartial ? 'reglee_partiel' : 'reglee'

    const updated = await db.update(schema.factures).set({
      statut: newStatut as never,
      regleeLe: (input.reglee_le as string) ?? new Date().toISOString(),
      montantRegle: montantRegleCents,
      modeReglement: (input.mode_reglement ?? facture.modeReglement) as never,
      numeroPiece: (input.numero_piece as string) ?? facture.numeroPiece,
      updatedAt: new Date().toISOString(),
    } as never).where(eq(schema.factures.id, facture.id)).returning()

    audit({
      action: 'update', userId: ctx.userId, userEmail: ctx.userEmail,
      entityType: 'coworker_tool_call', entityId: `mark_facture_reglee:${facture.id}`,
      details: `tool=mark_facture_reglee ref=${facture.ref} ${(montantRegleCents / 100).toFixed(2)}€${isPartial ? ' (partiel)' : ''}`,
      ip: ctx.ip, userAgent: ctx.userAgent,
    })
    return { ok: true, facture: updated[0], partiel: isPartial }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_TOOLS: ToolDefinition[] = [
  // Niveau 1 — lecture
  list_dossiers, get_dossier, list_clients, get_client,
  compute_hcsf, list_pieces, get_current_context, list_skills,
  list_factures, get_facture,
  // Niveau 2 — mutations cadrées
  create_note, update_dossier_statut, update_dossier, run_skill, search_recent_audit,
  mark_facture_reglee,
  // Niveau 3 — création (confirmation utilisateur requise)
  create_dossier, create_client, create_facture,
]

export function toolsForLevels(maxLevel: ToolLevel): ToolDefinition[] {
  return ALL_TOOLS.filter(t => t.level <= maxLevel)
}

export function findTool(name: string): ToolDefinition | null {
  return ALL_TOOLS.find(t => t.name === name) ?? null
}

/** Convertit la registry au format attendu par Anthropic Messages API. */
export function toAnthropicTools(tools: ToolDefinition[]): Array<{ name: string; description: string; input_schema: ToolDefinition['input_schema'] }> {
  return tools.map(t => ({ name: t.name, description: t.description, input_schema: t.input_schema }))
}
