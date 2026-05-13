/**
 * Schéma Drizzle ORM — Apolline
 * Conventions :
 *  - Toutes les PK sont des UUID v4 (sauf collaborateurs qui gardent leur ID human-readable)
 *  - Champs créés/modifiés gérés par défaut PG : `created_at`, `updated_at`
 *  - Structures complexes (Emprunteur, listes Cifacil-style) stockées en jsonb pour flexibilité
 *  - Index sur les FK + champs souvent filtrés (statut, email, statutCommercial)
 */
import {
  pgTable, uuid, text, timestamp, integer, boolean, jsonb, real, index, primaryKey,
} from 'drizzle-orm/pg-core'

// ─────────────────────────────────────────────────────────────────────────────
// COLLABORATEURS (utilisateurs auth)
// ─────────────────────────────────────────────────────────────────────────────
export const collaborateurs = pgTable('collaborateurs', {
  id: text('id').primaryKey(),                         // 'U001', 'U002'… (compat avec seed actuel)
  prenom: text('prenom').notNull(),
  nom: text('nom').notNull(),
  email: text('email').notNull().unique(),
  role: text('role', { enum: ['admin', 'courtier', 'gestionnaire', 'assistante'] }).notNull(),
  roleLabel: text('role_label').notNull(),
  telephone: text('telephone').notNull().default(''),
  passwordHash: text('password_hash').notNull(),       // bcrypt-style hash
  avatarGradient: text('avatar_gradient').notNull().default(''),
  avatarAccent: text('avatar_accent').notNull().default(''),
  bio: text('bio'),
  signatureHtml: text('signature_html'),
  signatureAutoInsert: boolean('signature_auto_insert').default(true),
  actif: boolean('actif').notNull().default(true),
  dossiersAssignes: integer('dossiers_assignes').notNull().default(0),
  creeLe: timestamp('cree_le', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  dernierAcces: timestamp('dernier_acces', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
})

// ─────────────────────────────────────────────────────────────────────────────
// APPORTEURS
// ─────────────────────────────────────────────────────────────────────────────
export const apporteurs = pgTable('apporteurs', {
  id: uuid('id').defaultRandom().primaryKey(),
  nom: text('nom').notNull(),
  type: text('type').notNull(),                        // 'Agent immobilier' | 'Notaire' | …
  email: text('email'),
  telephone: text('telephone'),
  societe: text('societe'),
  ville: text('ville'),
  reference: text('reference'),
  retrocession: real('retrocession'),
  notes: text('notes'),
  importeDeCifacil: boolean('importe_de_cifacil').default(false),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (t) => ({
  nomIdx: index('apporteurs_nom_idx').on(t.nom),
  typeIdx: index('apporteurs_type_idx').on(t.type),
}))

// ─────────────────────────────────────────────────────────────────────────────
// BANQUES
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOG
// Trace des actions sensibles (suppression dossier, modif client,
// export massif, login, changement de mot de passe…). Lecture seule depuis
// l'UI Paramètres → Audit (admin uniquement).
// ─────────────────────────────────────────────────────────────────────────────
export const auditLog = pgTable('audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  ts: timestamp('ts', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  /** ID du collaborateur auteur de l'action (peut être null si système). */
  userId: text('user_id'),
  userEmail: text('user_email'),
  /** Type d'action : "login", "logout", "delete", "update", "export", … */
  action: text('action').notNull(),
  /** Entité concernée (ex: "dossier", "client") + son ID. */
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  /** Description lisible de l'action. */
  details: text('details'),
  /** IP + user agent pour la traçabilité. */
  ip: text('ip'),
  userAgent: text('user_agent'),
}, (t) => ({
  tsIdx: index('audit_log_ts_idx').on(t.ts),
  userIdx: index('audit_log_user_id_idx').on(t.userId),
  actionIdx: index('audit_log_action_idx').on(t.action),
}))

export const banques = pgTable('banques', {
  id: text('id').primaryKey(),                         // 'CEBFC', 'LBP'… (compat seed)
  nom: text('nom').notNull(),
  couleur: text('couleur').notNull().default('#1f3a7a'),
  // Taux par durée (en décimal — ex: 0.0325 pour 3,25 %). tauxMoyen reste la
  // valeur de fallback / d'affichage simplifiée.
  tauxMoyen: real('taux_moyen').notNull().default(0),
  taux15: real('taux_15').notNull().default(0),
  taux20: real('taux_20').notNull().default(0),
  taux25: real('taux_25').notNull().default(0),
  taegMoyen: real('taeg_moyen').notNull().default(0),
  assuranceGroupePct: real('assurance_groupe_pct').notNull().default(0),
  fraisDossier: integer('frais_dossier').notNull().default(0),
  dureesMax: integer('durees_max').notNull().default(300),
  // Date à laquelle le courtier a saisi/validé ces barèmes (≠ updatedAt qui
  // bouge à chaque PATCH même si le taux n'a pas changé).
  dateMaj: text('date_maj'),
  // Notes libres du courtier (ex: "Retire temporairement le 25 ans", "Décote
  // supplémentaire sur primo-accédants", etc.)
  notes: text('notes'),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
})

// ─────────────────────────────────────────────────────────────────────────────
// CLIENTS / PROSPECTS
// ─────────────────────────────────────────────────────────────────────────────
export const clients = pgTable('clients', {
  id: uuid('id').defaultRandom().primaryKey(),
  legacyId: text('legacy_id').unique(),                // 'C001'… pour la compat seed initial
  prenom: text('prenom').notNull(),
  nom: text('nom').notNull(),
  email: text('email').notNull(),
  tel: text('tel').notNull().default(''),
  naissance: text('naissance').notNull().default(''),
  ville: text('ville').notNull().default(''),
  profession: text('profession').notNull().default(''),
  conjoint: text('conjoint'),
  revenuMensuelNet: integer('revenu_mensuel_net').notNull().default(0),
  apporteur: text('apporteur').notNull().default(''),  // saisie libre + autocomplete
  apporteurId: uuid('apporteur_id').references(() => apporteurs.id, { onDelete: 'set null' }),
  statutCommercial: text('statut_commercial', { enum: ['prospect', 'client'] }).notNull().default('prospect'),
  mandatEnvoyeLe: text('mandat_envoye_le'),
  notes: text('notes'),
  lastActivity: timestamp('last_activity', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (t) => ({
  emailIdx: index('clients_email_idx').on(t.email),
  statutIdx: index('clients_statut_idx').on(t.statutCommercial),
  apporteurIdIdx: index('clients_apporteur_id_idx').on(t.apporteurId),
}))

// ─────────────────────────────────────────────────────────────────────────────
// DOSSIERS (gros objet — Emprunteur1/2 + listes complexes en jsonb)
// ─────────────────────────────────────────────────────────────────────────────
export const dossiers = pgTable('dossiers', {
  id: uuid('id').defaultRandom().primaryKey(),
  legacyId: text('legacy_id').unique(),                // 'D001'…
  ref: text('ref').notNull().unique(),                 // référence interne
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  clientNom: text('client_nom').notNull(),

  // Statut & projet
  statut: text('statut').notNull(),                    // R0|R1_prevu|… (cf. STATUTS)
  typeProjet: text('type_projet').notNull(),
  villeBien: text('ville_bien').notNull().default(''),

  // Montants
  montantBien: integer('montant_bien').notNull().default(0),
  montantPret: integer('montant_pret').notNull().default(0),
  apport: integer('apport').notNull().default(0),
  dureeMois: integer('duree_mois').notNull().default(240),

  // ⚠️ Champs deprecated retirés (banque/banqueId/tauxNominal/mensualite/commission) —
  // migrent désormais sur la table `prets` (un dossier peut héberger plusieurs prêts
  // de banques distinctes : Cifacil-style). Voir migration drop_dossier_legacy_loan_fields.sql.

  // Conformité / scoring
  hcsfOk: boolean('hcsf_ok').notNull().default(false),
  ltv: real('ltv').notNull().default(0),
  scoreConfiance: integer('score_confiance').notNull().default(0),
  piecesFournies: integer('pieces_fournies').notNull().default(0),
  piecesTotal: integer('pieces_total').notNull().default(0),
  alertes: jsonb('alertes').$type<string[]>().notNull().default([]),

  // Jalons
  r1Date: text('r1_date'),
  signatureDate: text('signature_date'),

  // Cifacil-style enrichi (tout optionnel) — stockés en jsonb pour flexibilité
  emprunteur1: jsonb('emprunteur1'),                   // type Emprunteur côté front
  emprunteur2: jsonb('emprunteur2'),
  rfMenage: integer('rf_menage'),
  allocFamiliales: integer('alloc_familiales'),
  aplAlActuelle: integer('apl_al_actuelle'),
  epargneMenage: integer('epargne_menage'),
  loyerMenage: integer('loyer_menage'),
  autresDepensesMenage: integer('autres_depenses_menage'),
  empruntsLocatifsMenage: integer('emprunts_locatifs_menage'),
  empruntsNonLocatifsMenage: integer('emprunts_non_locatifs_menage'),
  ponderationRF: real('ponderation_rf'),
  rfReferenceN1: integer('rf_reference_n1'),
  rfReferenceN2: integer('rf_reference_n2'),
  dateReleveEndettement: text('date_releve_endettement'),

  creditsExistants: jsonb('credits_existants').$type<unknown[]>().default([]),
  patrimoine: jsonb('patrimoine').$type<unknown[]>().default([]),
  droitsEL: jsonb('droits_el').$type<unknown[]>().default([]),

  typeAchat: text('type_achat'),
  destination: text('destination'),
  typeLogement: text('type_logement'),
  compromisSigne: boolean('compromis_signe'),
  actePrevuLe: text('acte_prevu_le'),
  ptzZone: text('ptz_zone'),

  coutTerrain: integer('cout_terrain'),
  coutLogement: integer('cout_logement'),
  coutTravaux: integer('cout_travaux'),
  coutViabilisation: integer('cout_viabilisation'),
  coutMobilier: integer('cout_mobilier'),
  fraisEtablissement: integer('frais_etablissement'),
  fraisExpertise: integer('frais_expertise'),
  fraisAgence: integer('frais_agence'),
  fraisNotaire: integer('frais_notaire'),
  rachatCreditCout: integer('rachat_credit_cout'),

  // Caractéristiques détaillées du bien (extraites du dossier-extract §5)
  // jsonb : surfaceHabitable, surfaceTerrain, anneeConstruction, dpe,
  // ges, consoEnergie, coutEnergieAnnuel, auditEnergetique, etc.
  bienDetails: jsonb('bien_details').default({}),

  commercialId: text('commercial_id').references(() => collaborateurs.id, { onDelete: 'set null' }),
  backOfficeId: text('back_office_id').references(() => collaborateurs.id, { onDelete: 'set null' }),
  apporteurNom: text('apporteur_nom'),
  apporteurReference: text('apporteur_reference'),
  notaireNom: text('notaire_nom'),
  venteADistance: boolean('vente_a_distance'),
  archive: boolean('archive').default(false),
  archiveRaison: text('archive_raison'),
  identifiantEmprunteur: text('identifiant_emprunteur'),
  identifiantCoEmprunteur: text('identifiant_co_emprunteur'),

  // ─── OneDrive (association partagée entre collaborateurs) ───
  // Tous en text car les ids Microsoft Graph ne sont PAS des UUID Postgres.
  oneDriveFolderId: text('onedrive_folder_id'),
  oneDriveDriveId: text('onedrive_drive_id'),
  oneDriveFolderName: text('onedrive_folder_name'),
  oneDriveFolderPath: text('onedrive_folder_path'),
  oneDriveFolderWebUrl: text('onedrive_folder_web_url'),

  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (t) => ({
  clientIdx: index('dossiers_client_id_idx').on(t.clientId),
  statutIdx: index('dossiers_statut_idx').on(t.statut),
  refIdx: index('dossiers_ref_idx').on(t.ref),
}))

// ─────────────────────────────────────────────────────────────────────────────
// PRÊTS (composantes du plan de financement d'un dossier — style Cifacil)
// Un dossier contient 1 à N prêts (principal amortissable + PTZ + Action
// Logement + Relais + In Fine + Lissage…), potentiellement chez des banques
// différentes. Les agrégats (mensualité totale, TAEG global, taux d'endettement)
// sont calculés côté front depuis cette liste.
// ─────────────────────────────────────────────────────────────────────────────
export const prets = pgTable('prets', {
  id: uuid('id').defaultRandom().primaryKey(),
  dossierId: uuid('dossier_id').notNull().references(() => dossiers.id, { onDelete: 'cascade' }),
  rang: integer('rang').notNull().default(0),

  // Identification
  libelle: text('libelle'),                            // Ex: "Prêt lissage TF - 25 ans"
  type: text('type').notNull(),                        // amortissable | ptz | action_logement | epargne_logement | relais | in_fine | lissage
  profilAmortissement: text('profil_amortissement'),   // standard | paliers_lissage | in_fine | differe

  // Banque
  banque: text('banque'),
  banqueId: text('banque_id').references(() => banques.id, { onDelete: 'set null' }),

  // Statut métier
  sollicite: boolean('sollicite').default(true),
  commissionnable: boolean('commissionnable').default(true),

  // Conditions
  montant: integer('montant').notNull().default(0),
  montantDebloque: integer('montant_debloque'),
  dureeMois: integer('duree_mois').notNull().default(240),
  tauxNominal: real('taux_nominal'),
  fraisBanque: integer('frais_banque'),

  // Différé
  differeAmortissement: integer('differe_amortissement'),
  differeTotal: integer('differe_total'),

  // Flags
  revisable: boolean('revisable').default(false),
  modulable: boolean('modulable').default(false),

  // Assurance(s) — JSONB pour gérer plusieurs lignes (emprunteur + co-emprunteur)
  assurances: jsonb('assurances').$type<unknown[]>().default([]),
  tauxAssurance: real('taux_assurance'),               // legacy/résumé

  // Mensualités
  mensualiteHorsAssurance: integer('mensualite_hors_assurance'),
  mensualiteAssurance: integer('mensualite_assurance'),
  mensualiteTotale: integer('mensualite_totale'),

  // Paliers (lissage) — JSONB jusqu'à 5 paliers
  paliers: jsonb('paliers').$type<unknown[]>().default([]),

  // Garantie
  garantieType: text('garantie_type'),
  garantieMontant: integer('garantie_montant'),

  // TAEG / frais
  taeg: real('taeg'),
  fraisDossier: integer('frais_dossier').default(0),
  commission: integer('commission'),

  // Suivi
  statut: text('statut').notNull().default('propose'),
  numeroPretBanque: text('numero_pret_banque'),
  dateOffre: text('date_offre'),
  dateSignature: text('date_signature'),
  notes: text('notes'),

  // Affichage
  couleur: text('couleur'),

  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (t) => ({
  dossierIdx: index('prets_dossier_id_idx').on(t.dossierId),
  banqueIdx: index('prets_banque_id_idx').on(t.banqueId),
  statutIdx: index('prets_statut_idx').on(t.statut),
}))

// ─────────────────────────────────────────────────────────────────────────────
// RDV (Agenda — synchronisés avec Outlook via graphId)
// ─────────────────────────────────────────────────────────────────────────────
export const rdvs = pgTable('rdvs', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
  clientNom: text('client_nom'),
  type: text('type').notNull(),                        // R0|R1|R2|Signature|Autre
  date: timestamp('date', { withTimezone: true, mode: 'string' }).notNull(),
  duree: integer('duree').notNull().default(60),       // minutes
  lieu: text('lieu').notNull().default('Visio'),
  rappel: text('rappel'),
  graphId: text('graph_id').unique(),                  // ID Microsoft Graph (Outlook)
  ownerId: text('owner_id').references(() => collaborateurs.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (t) => ({
  dateIdx: index('rdvs_date_idx').on(t.date),
  clientIdx: index('rdvs_client_id_idx').on(t.clientId),
  graphIdx: index('rdvs_graph_id_idx').on(t.graphId),
}))

// ─────────────────────────────────────────────────────────────────────────────
// NOTES (par dossier)
// ─────────────────────────────────────────────────────────────────────────────
export const notes = pgTable('notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  dossierId: uuid('dossier_id').notNull().references(() => dossiers.id, { onDelete: 'cascade' }),
  auteurId: text('auteur_id').notNull().references(() => collaborateurs.id, { onDelete: 'restrict' }),
  auteurNom: text('auteur_nom').notNull(),
  contenu: text('contenu').notNull(),
  date: timestamp('date', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (t) => ({
  dossierIdx: index('notes_dossier_id_idx').on(t.dossierId),
}))

// ─────────────────────────────────────────────────────────────────────────────
// COMMISSIONS
// ─────────────────────────────────────────────────────────────────────────────
export const commissions = pgTable('commissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  mois: text('mois').notNull(),                        // '2026-04'
  dossierId: uuid('dossier_id').references(() => dossiers.id, { onDelete: 'set null' }),
  clientNom: text('client_nom').notNull(),
  banque: text('banque').notNull().default(''),
  montantPret: integer('montant_pret').notNull().default(0),
  tauxCom: real('taux_com').notNull().default(0),
  brut: integer('brut').notNull().default(0),
  gsupport: integer('gsupport').notNull().default(0),
  net: integer('net').notNull().default(0),
  encaisse: boolean('encaisse').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (t) => ({
  moisIdx: index('commissions_mois_idx').on(t.mois),
  dossierIdx: index('commissions_dossier_id_idx').on(t.dossierId),
}))

// ─────────────────────────────────────────────────────────────────────────────
// SIMULATIONS
// ─────────────────────────────────────────────────────────────────────────────
export const simulations = pgTable('simulations', {
  id: uuid('id').defaultRandom().primaryKey(),
  label: text('label').notNull(),
  clientNom: text('client_nom'),
  dossierId: uuid('dossier_id').references(() => dossiers.id, { onDelete: 'set null' }),
  montant: integer('montant').notNull().default(0),
  duree: integer('duree').notNull().default(240),
  apport: integer('apport').notNull().default(0),
  revenu: integer('revenu').notNull().default(0),
  assurance: text('assurance', { enum: ['groupe', 'delegataire'] }).notNull().default('groupe'),
  meilleureBanque: text('meilleure_banque').notNull().default(''),
  meilleureMensualite: integer('meilleure_mensualite').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
})

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATES (PDF / HTML / PNG / Email)
// ─────────────────────────────────────────────────────────────────────────────
export const templates = pgTable('templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  nom: text('nom').notNull(),
  type: text('type', { enum: ['PDF', 'HTML', 'PNG', 'Email'] }).notNull(),
  contenu: text('contenu').notNull(),
  description: text('description'),
  actif: boolean('actif').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
})

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS (par utilisateur)
// ─────────────────────────────────────────────────────────────────────────────
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => collaborateurs.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['info', 'success', 'warning', 'danger'] }).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  dossierId: uuid('dossier_id').references(() => dossiers.id, { onDelete: 'set null' }),
  link: text('link'),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (t) => ({
  userIdx: index('notifications_user_id_idx').on(t.userId),
  readIdx: index('notifications_read_idx').on(t.read),
}))

// ─────────────────────────────────────────────────────────────────────────────
// PIÈCES (par dossier — P1-P5)
// ─────────────────────────────────────────────────────────────────────────────
export const pieces = pgTable('pieces', {
  id: uuid('id').defaultRandom().primaryKey(),
  dossierId: uuid('dossier_id').notNull().references(() => dossiers.id, { onDelete: 'cascade' }),
  categorie: text('categorie', { enum: ['P1', 'P2', 'P3', 'P4', 'P5'] }).notNull(),
  libelle: text('libelle').notNull(),
  // Fichier stocké sur le VPS dans /var/lib/apolline/pieces/<dossier_id>/<piece_id>
  filename: text('filename').notNull(),                 // Nom original du fichier (ex: "CNI_Bernard.pdf")
  mimeType: text('mime_type').notNull().default('application/octet-stream'),
  sizeBytes: integer('size_bytes').notNull().default(0),
  sha256: text('sha256'),                               // Hash pour dédup + intégrité
  filePath: text('file_path'),                          // Chemin absolu sur le VPS (rempli par le backend)
  uploadedBy: text('uploaded_by'),                      // ID du collaborateur qui a uploadé
  uploadedAt: timestamp('uploaded_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  // Champs legacy conservés pour rétro-compat (anciens dossiers OneDrive)
  fichier: text('fichier'),                             // @deprecated chemin OneDrive ou nom local
  statut: text('statut', { enum: ['valide', 'a_fournir', 'manquant', 'expire'] }).notNull().default('a_fournir'),
  dateAjout: timestamp('date_ajout', { withTimezone: true, mode: 'string' }),
  // ─── OCR / Extraction automatique (Phase 1) ──────────────────────────────
  extractionType: text('extraction_type', {
    enum: ['bulletin_salaire', 'avis_imposition', 'rib', 'cni', 'justif_domicile', 'compromis', 'dpe', 'autre'],
  }),
  extractionStatus: text('extraction_status', {
    enum: ['pending', 'processing', 'completed', 'failed', 'applied', 'rejected'],
  }),
  extractedData: jsonb('extracted_data').$type<Record<string, unknown> | null>(),
  extractionConfidence: real('extraction_confidence'),
  extractionError: text('extraction_error'),
  extractedAt: timestamp('extracted_at', { withTimezone: true, mode: 'string' }),
  appliedAt: timestamp('applied_at', { withTimezone: true, mode: 'string' }),
  appliedBy: text('applied_by'),
}, (t) => ({
  dossierIdx: index('pieces_dossier_id_idx').on(t.dossierId),
  sha256Idx: index('pieces_sha256_idx').on(t.sha256),
}))

// ─────────────────────────────────────────────────────────────────────────────
// FACTURATION (note d'honoraires, commissions bancaires, ristournes apporteurs, avoirs)
// Convention numérotation : F<yy>-NNNN (factures), R<yy>-NNNN (ristournes)
// 8 types : 4 émissions + 4 avoirs.
// Lié au dossier (cascade delete) et indirectement à la table commissions
// (via commissionId pour matcher avec le suivi commercial existant).
// ─────────────────────────────────────────────────────────────────────────────
export const factures = pgTable('factures', {
  id: uuid('id').defaultRandom().primaryKey(),
  ref: text('ref').notNull().unique(),

  type: text('type', {
    enum: [
      'honoraires', 'comm_banque', 'comm_autre', 'ristourne',
      'avoir_honoraires', 'avoir_comm_banque', 'avoir_comm_autre', 'avoir_ristourne',
    ],
  }).notNull(),

  dossierId: uuid('dossier_id').notNull().references(() => dossiers.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),

  partenaireType: text('partenaire_type', { enum: ['client', 'banque', 'apporteur', 'autre'] }),
  partenaireId: text('partenaire_id'), // text car peut être uuid (apporteur) ou text (banque)
  partenaireNom: text('partenaire_nom'),
  partenaireEmail: text('partenaire_email'),

  /** Montants en centimes (precision) */
  montantHt: integer('montant_ht').notNull().default(0),
  tvaTaux: real('tva_taux').notNull().default(0.20),
  montantTva: integer('montant_tva').notNull().default(0),
  montantTtc: integer('montant_ttc').notNull().default(0),

  emiseLe: timestamp('emise_le', { withTimezone: true, mode: 'string' }),
  echeanceLe: timestamp('echeance_le', { withTimezone: true, mode: 'string' }),
  regleeLe: timestamp('reglee_le', { withTimezone: true, mode: 'string' }),
  prevueLe: timestamp('prevue_le', { withTimezone: true, mode: 'string' }),
  acteLe: timestamp('acte_le', { withTimezone: true, mode: 'string' }),

  modeReglement: text('mode_reglement', {
    enum: ['virement', 'cheque', 'prelevement', 'cb', 'numeraire', 'via_notaire', 'via_banque', 'autre'],
  }),
  montantRegle: integer('montant_regle').notNull().default(0),
  numeroPiece: text('numero_piece'),

  statut: text('statut', {
    enum: ['prevue', 'emise', 'reglee_partiel', 'reglee', 'avoir_emis', 'annulee'],
  }).notNull().default('prevue'),

  commissionId: uuid('commission_id').references(() => commissions.id, { onDelete: 'set null' }),
  factureAvoirId: uuid('facture_avoir_id'), // référence circulaire — pas d'FK contrainte ici

  templateId: uuid('template_id'),
  pdfFilePath: text('pdf_file_path'),
  pdfSha256: text('pdf_sha256'),

  prestation: text('prestation'),
  infoReglement: text('info_reglement'),
  commentaire: text('commentaire'),

  createdBy: text('created_by').references(() => collaborateurs.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (t) => ({
  dossierIdx: index('factures_dossier_id_idx').on(t.dossierId),
  clientIdx: index('factures_client_id_idx').on(t.clientId),
  typeIdx: index('factures_type_idx').on(t.type),
  statutIdx: index('factures_statut_idx').on(t.statut),
  emiseLeIdx: index('factures_emise_le_idx').on(t.emiseLe),
  refIdx: index('factures_ref_idx').on(t.ref),
}))

/** Compteurs séquentiels par préfixe + année — UPSERT atomique pour numérotation. */
export const facturesCounters = pgTable('factures_counters', {
  prefix: text('prefix').notNull(),
  year: integer('year').notNull(),
  next: integer('next').notNull().default(1),
}, (t) => ({
  pk: primaryKey({ columns: [t.prefix, t.year] }),
}))

// ─────────────────────────────────────────────────────────────────────────────
// CONFORMITÉ IOBSP (carte ORIAS, RC pro, garantie financière, formations 15h/an)
// Pour chaque collaborateur, on suit les certifs avec dates d'expiration et
// les heures de formation continue (15h/an obligatoires depuis l'arrêté du
// 9 juin 2016, codifié aux articles R.519-4 à R.519-15 CMF).
// ─────────────────────────────────────────────────────────────────────────────
export const conformiteCertifs = pgTable('conformite_certifs', {
  id: uuid('id').defaultRandom().primaryKey(),
  collaborateurId: text('collaborateur_id').notNull().references(() => collaborateurs.id, { onDelete: 'cascade' }),
  type: text('type', {
    enum: ['orias', 'carte_pro', 'rc_pro', 'garantie_financiere', 'capacite_pro', 'autre'],
  }).notNull(),
  libelle: text('libelle').notNull(),
  organismeEmetteur: text('organisme_emetteur'),
  numero: text('numero'),
  emiseLe: timestamp('emise_le', { withTimezone: true, mode: 'string' }),
  valideDu: timestamp('valide_du', { withTimezone: true, mode: 'string' }),
  expireLe: timestamp('expire_le', { withTimezone: true, mode: 'string' }),
  /** Montant en centimes (garantie financière, RC pro). */
  montantGarantie: integer('montant_garantie'),
  filename: text('filename'),
  filePath: text('file_path'),
  sha256: text('sha256'),
  alerteJoursAvant: integer('alerte_jours_avant').notNull().default(60),
  notes: text('notes'),
  createdBy: text('created_by').references(() => collaborateurs.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (t) => ({
  collabIdx: index('conformite_certifs_collab_idx').on(t.collaborateurId),
  expireIdx: index('conformite_certifs_expire_idx').on(t.expireLe),
  typeIdx: index('conformite_certifs_type_idx').on(t.type),
}))

export const conformiteFormations = pgTable('conformite_formations', {
  id: uuid('id').defaultRandom().primaryKey(),
  collaborateurId: text('collaborateur_id').notNull().references(() => collaborateurs.id, { onDelete: 'cascade' }),
  titre: text('titre').notNull(),
  organismeFormateur: text('organisme_formateur'),
  type: text('type', { enum: ['initiale', 'continue', 'thematique'] }).notNull().default('continue'),
  theme: text('theme'),
  dateDebut: timestamp('date_debut', { withTimezone: true, mode: 'string' }).notNull(),
  dateFin: timestamp('date_fin', { withTimezone: true, mode: 'string' }),
  dureeHeures: real('duree_heures').notNull().default(0),
  filename: text('filename'),
  filePath: text('file_path'),
  sha256: text('sha256'),
  notes: text('notes'),
  createdBy: text('created_by').references(() => collaborateurs.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (t) => ({
  collabIdx: index('conformite_formations_collab_idx').on(t.collaborateurId),
  dateIdx: index('conformite_formations_date_idx').on(t.dateDebut),
}))

// ─────────────────────────────────────────────────────────────────────────────
// COWORKER (assistant Claude conversationnel — chat persistant par utilisateur)
// Une conversation contient N messages. Chaque message peut être :
//   - role 'user' (saisie collab)
//   - role 'assistant' (réponse Claude, peut contenir des tool_use)
//   - role 'tool' (résultat d'un tool — stocké pour reprise de contexte)
// La colonne `content` est en jsonb pour héberger soit du texte brut soit
// des blocs {type:'text'|'tool_use'|'tool_result', …} façon Anthropic.
// ─────────────────────────────────────────────────────────────────────────────
export const coworkerConversations = pgTable('coworker_conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => collaborateurs.id, { onDelete: 'cascade' }),
  /** Titre généré (3-5 mots) — Claude le crée à la 1re réponse, modifiable manuellement. */
  title: text('title').notNull().default('Nouvelle conversation'),
  /** Contexte ouvert au moment de l'envoi (dossierId, page, etc.) — pour aider Claude */
  contextSnapshot: jsonb('context_snapshot').$type<Record<string, unknown>>().default({}),
  /** Coût cumulé de la conversation en EUR — incrémenté à chaque appel Claude */
  cumulativeCostEur: real('cumulative_cost_eur').notNull().default(0),
  /** Coût cumulé en tokens — pour KPI rapides sans recalcul */
  cumulativeTokensIn: integer('cumulative_tokens_in').notNull().default(0),
  cumulativeTokensOut: integer('cumulative_tokens_out').notNull().default(0),
  /** Modèle dominant utilisé (sonnet par défaut). Permet le filtrage UI. */
  model: text('model').notNull().default('sonnet'),
  archived: boolean('archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (t) => ({
  userIdx: index('coworker_conv_user_id_idx').on(t.userId),
  updatedIdx: index('coworker_conv_updated_idx').on(t.updatedAt),
}))

export const coworkerMessages = pgTable('coworker_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id').notNull().references(() => coworkerConversations.id, { onDelete: 'cascade' }),
  /** Position dans la conversation (0-indexed). Permet l'ordre stable. */
  seq: integer('seq').notNull(),
  /** 'user' | 'assistant' | 'tool' (notre convention interne — Anthropic n'a pas 'tool' mais on l'embarque dans messages.user.content[type='tool_result']) */
  role: text('role', { enum: ['user', 'assistant', 'tool'] }).notNull(),
  /** Contenu brut : soit string (cas simple) soit array de blocks Anthropic-style */
  content: jsonb('content').$type<unknown>().notNull(),
  /** Pour les messages 'assistant' : modèle utilisé, stop_reason, usage */
  meta: jsonb('meta').$type<{
    model?: string
    stopReason?: string | null
    inputTokens?: number
    outputTokens?: number
    cacheCreationTokens?: number
    cacheReadTokens?: number
    costEur?: number
  }>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (t) => ({
  convIdx: index('coworker_msg_conv_idx').on(t.conversationId, t.seq),
}))

// ─────────────────────────────────────────────────────────────────────────────
// Types inférés (utilisables côté backend ET frontend si partagés)
// ─────────────────────────────────────────────────────────────────────────────
export type Collaborateur = typeof collaborateurs.$inferSelect
export type NewCollaborateur = typeof collaborateurs.$inferInsert
export type Apporteur = typeof apporteurs.$inferSelect
export type NewApporteur = typeof apporteurs.$inferInsert
export type Banque = typeof banques.$inferSelect
export type NewBanque = typeof banques.$inferInsert
export type Client = typeof clients.$inferSelect
export type NewClient = typeof clients.$inferInsert
export type Dossier = typeof dossiers.$inferSelect
export type NewDossier = typeof dossiers.$inferInsert
export type Rdv = typeof rdvs.$inferSelect
export type NewRdv = typeof rdvs.$inferInsert
export type Note = typeof notes.$inferSelect
export type NewNote = typeof notes.$inferInsert
export type Commission = typeof commissions.$inferSelect
export type NewCommission = typeof commissions.$inferInsert
export type Simulation = typeof simulations.$inferSelect
export type NewSimulation = typeof simulations.$inferInsert
export type Template = typeof templates.$inferSelect
export type NewTemplate = typeof templates.$inferInsert
export type Notification = typeof notifications.$inferSelect
export type NewNotification = typeof notifications.$inferInsert
export type Piece = typeof pieces.$inferSelect
export type NewPiece = typeof pieces.$inferInsert
export type ConformiteCertif = typeof conformiteCertifs.$inferSelect
export type NewConformiteCertif = typeof conformiteCertifs.$inferInsert
export type ConformiteFormation = typeof conformiteFormations.$inferSelect
export type NewConformiteFormation = typeof conformiteFormations.$inferInsert
export type Facture = typeof factures.$inferSelect
export type NewFacture = typeof factures.$inferInsert
export type FactureCounter = typeof facturesCounters.$inferSelect
export type CoworkerConversation = typeof coworkerConversations.$inferSelect
export type NewCoworkerConversation = typeof coworkerConversations.$inferInsert
export type CoworkerMessage = typeof coworkerMessages.$inferSelect
export type NewCoworkerMessage = typeof coworkerMessages.$inferInsert
