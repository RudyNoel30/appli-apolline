export type Statut =
  | 'R0'
  | 'R1_prevu'
  | 'R1_fait'
  | 'Montage'
  | 'Envoi_banque'
  | 'Accord'
  | 'Offre_editee'
  | 'Signe'
  | 'Encaisse'
  | 'Abandonne'

export const STATUTS: { key: Statut; label: string; color: string }[] = [
  { key: 'R0', label: 'R0 contact', color: 'bg-navy-100 text-navy-800' },
  { key: 'R1_prevu', label: 'R1 prévu', color: 'bg-sky-100 text-sky-800' },
  { key: 'R1_fait', label: 'R1 fait', color: 'bg-indigo-100 text-indigo-800' },
  { key: 'Montage', label: 'Montage', color: 'bg-violet-100 text-violet-800' },
  { key: 'Envoi_banque', label: 'Envoi banque', color: 'bg-amber-100 text-amber-800' },
  { key: 'Accord', label: 'Accord banque', color: 'bg-emerald-100 text-emerald-800' },
  { key: 'Offre_editee', label: 'Offre éditée', color: 'bg-teal-100 text-teal-800' },
  { key: 'Signe', label: 'Signé', color: 'bg-lime-100 text-lime-800' },
  { key: 'Encaisse', label: 'Encaissé', color: 'bg-gold-200 text-gold-800' },
  { key: 'Abandonne', label: 'Abandonné', color: 'bg-rose-100 text-rose-800' },
]

export type StatutCommercial = 'prospect' | 'client'

export type Apporteur = {
  id: string
  nom: string
  type: 'Agent immobilier' | 'Notaire' | 'Promoteur' | 'CGP / Conseiller' | 'Réseau / Partenaire' | 'Site web' | 'Recommandation' | 'Interne' | 'Autre'
  email?: string
  telephone?: string
  societe?: string
  ville?: string
  reference?: string
  /** Commission rétrocédée par défaut (% du brut) */
  retrocession?: number
  notes?: string
  importeDeCifacil?: boolean
  createdAt: string
  // ─── Champs business pour faire des chèques (retour Sébastien 2026-05) ───
  /** N° RCS / SIREN (obligatoire pour agents immobiliers, notaires, promoteurs) */
  rcs?: string
  /** Adresse postale complète (rue + n°) pour l'envoi de chèques de rétrocession */
  adressePro?: string
  /** Code postal de l'adresse pro */
  codePostalPro?: string
  /** Ville pro */
  villePro?: string
  /** N° carte T (agents immobiliers) — utile pour vérification réglementaire */
  carteT?: string
  /** IBAN pour virement de rétrocession (si l'apporteur préfère le virement au chèque) */
  iban?: string
}

export type Client = {
  id: string
  prenom: string
  nom: string
  email: string
  tel: string
  naissance: string
  /** Lieu de naissance (ville) — séparé de la ville d'adresse pour éviter la
   *  confusion remontée par Sébastien (Besançon en lieu naissance ne doit pas
   *  écraser la ville d'adresse). */
  lieuNaissance?: string
  /** Code postal de l'adresse */
  codePostal?: string
  /** Ville d'adresse (≠ lieuNaissance) */
  ville: string
  /** Adresse postale complète (rue + numéro) */
  adresse?: string
  profession: string
  /**
   * @deprecated Champ texte legacy — utiliser conjointPrenom + conjointNom à
   * la place. Conservé pour compat avec les anciens prospects.
   */
  conjoint?: string
  conjointPrenom?: string
  conjointNom?: string
  conjointNaissance?: string
  conjointLieuNaissance?: string
  conjointTel?: string
  conjointEmail?: string
  conjointProfession?: string
  revenuMensuelNet: number
  dossierIds: string[]
  createdAt: string
  lastActivity: string
  /** Apporteur d'affaires (saisie libre, autocomplete depuis la base) */
  apporteur: string
  /** Lien optionnel vers une fiche apporteur dans la base */
  apporteurId?: string
  /** Prospect par défaut, passe en client au moment de l'envoi du mandat */
  statutCommercial: StatutCommercial
  /** Date de bascule prospect → client (= date d'envoi mandat) */
  mandatEnvoyeLe?: string
  notes?: string
}

export const clients: Client[] = [
]

/**
 * Base d'apporteurs d'affaires Apolline — alimentée par import Cifacil
 * (à remplacer par les vraies données quand le fichier d'export sera fourni).
 */
export const apporteurs: Apporteur[] = [
  {
    id: 'A001', nom: 'Site Apolline.fr', type: 'Site web',
    notes: 'Leads via le formulaire web du site cabinet.', createdAt: '2024-01-01',
  },
  {
    id: 'A002', nom: 'M. Berthier', type: 'Recommandation',
    societe: 'Particulier', ville: 'Dijon',
    notes: 'Ancien client 2024, a apporté Dumas A.', retrocession: 0,
    createdAt: '2024-09-15',
  },
  {
    id: 'A003', nom: 'Agence Foncia Chalon', type: 'Agent immobilier',
    email: 'chalon@foncia.fr', telephone: '03 85 90 12 34',
    societe: 'Foncia', ville: 'Chalon-sur-Saône', retrocession: 0.15,
    importeDeCifacil: true, createdAt: '2025-02-10',
  },
  {
    id: 'A004', nom: 'Notaire Me Lefebvre', type: 'Notaire',
    email: 'office@lefebvre-notaire.fr', telephone: '03 80 67 12 34',
    societe: 'Étude Lefebvre & Associés', ville: 'Dijon',
    retrocession: 0.10, importeDeCifacil: true, createdAt: '2025-03-22',
  },
  {
    id: 'A005', nom: 'Mme Dubois', type: 'Recommandation',
    ville: 'Besançon', notes: 'Cliente 2024, recommandation Léa Fournier.',
    createdAt: '2025-06-08',
  },
  {
    id: 'A006', nom: "CCI Côte-d'Or", type: 'Réseau / Partenaire',
    societe: 'CCI Bourgogne-Franche-Comté', ville: 'Dijon',
    email: 'partenaires@cci21.fr',
    notes: 'Partenariat dossiers pro / création reprise.',
    importeDeCifacil: true, createdAt: '2024-04-15',
  },
  {
    id: 'A007', nom: 'Réseau Initiative BFC', type: 'Réseau / Partenaire',
    societe: 'Initiative France', ville: 'Dijon',
    notes: 'Prêts d\'honneur création/reprise.',
    importeDeCifacil: true, createdAt: '2025-01-20',
  },
  {
    id: 'A008', nom: 'Patrimoine & Conseil BFC', type: 'CGP / Conseiller',
    email: 'contact@patrimoine-bfc.fr', telephone: '03 80 45 67 89',
    societe: 'Patrimoine & Conseil', ville: 'Dijon',
    retrocession: 0.20, importeDeCifacil: true, createdAt: '2024-11-12',
  },
  {
    id: 'A009', nom: 'Promoteur Bouygues Immobilier', type: 'Promoteur',
    societe: 'Bouygues Immobilier', ville: 'Lyon',
    retrocession: 0.12, importeDeCifacil: true, createdAt: '2025-04-01',
  },
  {
    id: 'A010', nom: 'Recommandation collaborateur', type: 'Interne',
    notes: "Recommandations entre courtiers Extr'Apol.", createdAt: '2024-01-15',
  },
  // Apporteurs propres à Sébastien (retour beta 2026-05) — données à
  // compléter manuellement par Rudy depuis Cifacil. RCS, adresse pro et IBAN
  // sont nécessaires pour les chèques de rétrocession.
  {
    id: 'A011', nom: 'Jean-Luc Moissonnier', type: 'Agent immobilier',
    societe: 'À renseigner depuis Cifacil', ville: 'Lons-le-Saunier',
    notes: 'Apporteur de Sébastien — compléter RCS + adresse pro depuis l\'export Cifacil avant le premier chèque.',
    createdAt: '2026-05-01',
  },
]

export type Civilite = 'M.' | 'Mme' | 'Mlle'
export type SituationFamiliale = 'Célibataire' | 'Marié(e)' | 'Pacsé(e)' | 'Divorcé(e)' | 'Veuf(ve)' | 'Concubinage'
export type RegimeMatrimonial = 'Communauté légale' | 'Séparation de biens' | 'Communauté universelle' | 'Participation aux acquêts' | 'N/A'
export type StatutOccupation = 'Locataire' | 'Propriétaire' | 'Hébergé' | 'Logement de fonction' | 'HLM' | 'Logé à titre gratuit'
export type TypeContrat = 'CDI' | 'CDD' | 'Période d\'essai' | 'Fonctionnaire' | 'Indépendant' | 'Gérant majoritaire' | 'Profession libérale' | 'Auto-entrepreneur' | 'Retraité' | 'Sans emploi' | 'Étudiant'
export type TypeAchat = 'Ancien' | 'Neuf' | 'VEFA' | 'Construction' | 'Terrain' | 'Rachat' | 'Travaux'
export type Destination = 'Résidence principale' | 'Résidence secondaire' | 'Locatif' | 'Mixte' | 'Pro'
export type TypeLogement = 'Maison' | 'Appartement' | 'Terrain' | 'Local commercial' | 'Immeuble' | 'Studio'
export type DevenirCredit = 'À solder' | 'À conserver' | 'À reprendre' | 'En cours'

export type CreditExistant = {
  id: string
  libelle: string
  type: 'Immobilier' | 'Conso' | 'Auto' | 'Travaux' | 'Étudiant' | 'Autre'
  organisme?: string
  crd: number
  mensualite: number
  terme: string
  devenir: DevenirCredit
}

export type BienPatrimoine = {
  id: string
  libelle: string
  type: 'Résidence principale' | 'Résidence secondaire' | 'Locatif' | 'Terrain' | 'Local pro' | 'Autre'
  valeur: number
  crd: number
  revenu: number
  hypotheque: boolean
  venteEnvisagee: boolean
}

export type DroitEpargneLogement = {
  id: string
  type: 'PEL' | 'CEL' | 'Plan d\'épargne' | 'Livret A' | 'LDD' | 'LEP' | 'Assurance-vie' | 'PEA' | 'PER' | 'Compte courant' | 'Autre'
  /** Solde / capital ÉL épargné (€). Pour PEL/CEL anciens c'est aussi le
   *  montant des droits acquis (utilisable comme apport). */
  droits: number
  cedes: boolean
  titulaire: string
}

export type Emprunteur = {
  // Identité
  civilite: Civilite
  prenom: string
  nom: string
  naissance: string
  lieuNaissance: string
  nationalite: string
  // Coordonnées
  email: string
  telDom: string
  telMobile: string
  adresse: string
  adresseSuite: string
  codePostal: string
  ville: string
  // Situation
  situationFamiliale: SituationFamiliale
  regimeMatrimonial: RegimeMatrimonial
  enfantsACharge: number
  rgpdAccord: boolean
  /** Primo-accédant : pas propriétaire de sa RP les 2 dernières années (PTZ). */
  primoAccedant?: boolean
  // Profession
  profession: string
  typeContrat: TypeContrat
  employeur: string
  dateEmbauche: string
  anciennete: number
  secteur: string
  // Revenus mensuels personnels
  salaireNet: number
  baBicBnc: number
  baBicBncMois: number
  rfBrutsExistants: number
  autresRevenusNonSociaux: number
  revenusSociaux: number
  pensionAlimentaireRecue: number
  // Revenus fiscaux personnels
  rfPersonnelN1: number
  rfPersonnelN2: number
  // Charges mensuelles personnelles
  epargneProgrammee: number
  loyerPersistant: number
  pensionAlimentaireVersee: number
  empruntsLocatifs: number
  empruntsNonLocatifs: number
  // Logement actuel
  statutOccupation: StatutOccupation
  logementDepuis: string
  loyerActuel: number
  hlm: boolean
}

export type Dossier = {
  // ─── Existant (compat seeds + simulations) ───
  id: string
  ref: string
  clientId: string
  clientNom: string
  statut: Statut
  typeProjet: 'Achat RP' | 'Achat RS' | 'Locatif' | 'Construction' | 'Rachat' | 'Pro'
  villeBien: string
  montantBien: number
  montantPret: number
  apport: number
  dureeMois: number
  hcsfOk: boolean
  ltv: number
  createdAt: string
  r1Date?: string
  signatureDate?: string
  scoreConfiance: number
  piecesFournies: number
  piecesTotal: number
  alertes: string[]

  // ─── OneDrive ───
  /** ID Microsoft Graph du dossier OneDrive associé au dossier de prêt. */
  oneDriveFolderId?: string
  /**
   * ID du drive contenant le dossier — non vide quand le dossier vient
   * d'un partage (autre OneDrive ou bibliothèque SharePoint). Pour le drive
   * personnel de l'utilisateur, ce champ peut rester vide → on retombe sur
   * /me/drive par défaut.
   */
  oneDriveDriveId?: string
  /** Nom du dossier OneDrive (cache pour affichage sans appel Graph). */
  oneDriveFolderName?: string
  /** Chemin lisible "/Apolline/Dossiers/Bernard Sébastien" — cache pour UI. */
  oneDriveFolderPath?: string
  /** URL web du dossier OneDrive (pour l'ouvrir dans le navigateur). */
  oneDriveFolderWebUrl?: string

  // ─── Cifacil-style enrichi (tout optionnel) ───
  // Emprunteurs
  emprunteur1?: Emprunteur
  emprunteur2?: Emprunteur

  // Revenus communs ménage
  rfMenage?: number
  allocFamiliales?: number
  aplAlActuelle?: number

  // Charges communes ménage
  epargneMenage?: number
  loyerMenage?: number
  autresDepensesMenage?: number
  empruntsLocatifsMenage?: number
  empruntsNonLocatifsMenage?: number
  ponderationRF?: number

  // Revenus fiscaux du ménage
  rfReferenceN1?: number
  rfReferenceN2?: number
  dateReleveEndettement?: string

  // Tableaux
  creditsExistants?: CreditExistant[]
  patrimoine?: BienPatrimoine[]
  droitsEL?: DroitEpargneLogement[]

  // Projet enrichi
  typeAchat?: TypeAchat
  destination?: Destination
  typeLogement?: TypeLogement
  compromisSigne?: boolean
  actePrevuLe?: string

  /** Zone PTZ du bien (A bis / A / B1 / B2 / C) — détermine plafonds & quotités. */
  ptzZone?: 'A_bis' | 'A' | 'B1' | 'B2' | 'C'

  // Coûts d'acquisition détaillés
  coutTerrain?: number
  coutLogement?: number
  coutTravaux?: number
  coutViabilisation?: number
  coutMobilier?: number
  fraisEtablissement?: number
  fraisExpertise?: number
  fraisAgence?: number
  fraisNotaire?: number
  rachatCreditCout?: number

  /** Caractéristiques détaillées du bien (extraites par dossier-extract §5) — jsonb */
  bienDetails?: {
    adresseBien?: string
    vendeur?: string
    agenceVente?: string
    notaire?: string
    surfaceHabitable?: number
    surfaceTerrain?: number
    nbPieces?: number
    anneeConstruction?: number
    typeBien?: string
    dpeClasse?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | ''
    dpeConsoKwhM2An?: number
    gesClasse?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | ''
    gesCo2kgM2An?: number
    coutEnergieAnnuelMin?: number
    coutEnergieAnnuelMax?: number
    auditEnergetiqueDispo?: boolean
    scenarioRenovation?: string
    diagsManquants?: string[]
    originePropriete?: string
  }

  // Métadonnées Cifacil
  commercialId?: string
  backOfficeId?: string
  apporteurNom?: string
  apporteurReference?: string
  notaireNom?: string
  venteADistance?: boolean
  archive?: boolean
  archiveRaison?: string
  identifiantEmprunteur?: string
  identifiantCoEmprunteur?: string
}

/** Crée un Emprunteur vide pour initialiser le formulaire */
export function emptyEmprunteur(): Emprunteur {
  return {
    civilite: 'M.',
    prenom: '', nom: '', naissance: '', lieuNaissance: '', nationalite: 'Française',
    email: '', telDom: '', telMobile: '',
    adresse: '', adresseSuite: '', codePostal: '', ville: '',
    situationFamiliale: 'Célibataire', regimeMatrimonial: 'N/A', enfantsACharge: 0, rgpdAccord: false,
    profession: '', typeContrat: 'CDI', employeur: '', dateEmbauche: '', anciennete: 0, secteur: '',
    salaireNet: 0, baBicBnc: 0, baBicBncMois: 12, rfBrutsExistants: 0,
    autresRevenusNonSociaux: 0, revenusSociaux: 0, pensionAlimentaireRecue: 0,
    rfPersonnelN1: 0, rfPersonnelN2: 0,
    epargneProgrammee: 0, loyerPersistant: 0, pensionAlimentaireVersee: 0,
    empruntsLocatifs: 0, empruntsNonLocatifs: 0,
    statutOccupation: 'Locataire', logementDepuis: '', loyerActuel: 0, hlm: false,
  }
}

export const dossiers: Dossier[] = [
]

export type Banque = {
  id: string
  nom: string
  couleur: string
  /** Taux moyen toutes durées confondues (fallback / affichage simplifié). */
  tauxMoyen: number
  /** Grille par durée — décimal (0.0325 = 3,25 %). */
  taux15: number
  taux20: number
  taux25: number
  taegMoyen: number
  /** Cotisation assurance Groupe en décimal (0.0034 = 0,34 %/an du capital initial). */
  assuranceGroupePct: number
  fraisDossier: number
  /** Durée max acceptée par la banque (mois). */
  dureesMax: number
  /** Date à laquelle le courtier a saisi/validé ces barèmes (YYYY-MM-DD). */
  dateMaj?: string
  /** Notes libres du courtier (ex: "Retire le 25 ans cette semaine"). */
  notes?: string
}

/**
 * Helper : retourne le taux nominal de la banque pour une durée donnée (mois).
 * Interpolation linéaire entre 15/20/25 ans pour les durées intermédiaires.
 * Fallback sur tauxMoyen si la grille n'est pas renseignée.
 */
export function tauxPourDuree(b: Banque, dureeMois: number): number {
  const t15 = b.taux15 || b.tauxMoyen
  const t20 = b.taux20 || b.tauxMoyen
  const t25 = b.taux25 || b.tauxMoyen
  if (dureeMois <= 180) return t15
  if (dureeMois >= 300) return t25
  if (dureeMois <= 240) {
    const ratio = (dureeMois - 180) / 60
    return t15 + (t20 - t15) * ratio
  }
  const ratio = (dureeMois - 240) / 60
  return t20 + (t25 - t20) * ratio
}

export const banques: Banque[] = []

// ─────────────────────────────────────────────────────────────────────────────
// Prêts (composantes du plan de financement)
// ─────────────────────────────────────────────────────────────────────────────
/** Type réglementaire du prêt (style Cifacil). */
export type PretType =
  | 'amortissable'      // Prêt bancaire classique
  | 'ptz'               // Prêt à taux zéro (État)
  | 'action_logement'   // 1 % logement
  | 'epargne_logement'  // PEL/CEL
  | 'relais'            // Achat-revente
  | 'in_fine'           // Capital remboursé en 1 fois en fin de prêt
  | 'lissage'           // Prêt à paliers (lissage avec un autre prêt)

/** Profil d'amortissement (cf. Cifacil). */
export type PretProfilAmortissement =
  | 'standard'          // Mensualités constantes
  | 'paliers_lissage'   // Paliers (jusqu'à 5)
  | 'in_fine'
  | 'differe'           // Différé partiel ou total

export type PretStatut =
  | 'propose'
  | 'accorde'
  | 'offre_editee'
  | 'signe'
  | 'refuse'
  | 'abandonne'

export type GarantieType = 'credit_logement' | 'saccef' | 'casden' | 'hypotheque' | 'ppd' | 'caution_autre' | 'nantissement' | 'autre'

/** Ligne d'assurance (1 prêt peut avoir plusieurs lignes — emprunteur + co-emprunteur). */
export type PretAssurance = {
  libelle?: string
  taux?: number               // % par an
  quotite?: number            // % couvert (souvent 100 pour emp1, 50/50 pour couple…)
  baseCalcul?: 'KI' | 'KRD'   // Capital Initial (Cifacil par défaut) ou Capital Restant Dû
  titulaire?: 'emprunteur' | 'coemprunteur'
}

/** Palier (cf. Cifacil — jusqu'à 5 paliers pour lissage). */
export type PretPalier = {
  rang: 1 | 2 | 3 | 4 | 5
  nombreMois: number
  echeanceHorsAssurance?: number
  echeanceAvecAssurance?: number
}

export type Pret = {
  id: string
  dossierId: string
  rang: number

  // Identification
  libelle?: string                     // Ex: "Prêt lissage TF - 25 ans"
  type: PretType
  profilAmortissement?: PretProfilAmortissement
  banque?: string
  banqueId?: string

  // Statut métier
  sollicite?: boolean                  // Sollicité auprès de la banque (Cifacil)
  commissionnable?: boolean            // Donne lieu à commission courtier

  // Conditions financières
  montant: number                      // Montant prévu / financé
  montantDebloque?: number             // Montant réellement débloqué si différent
  dureeMois: number
  tauxNominal?: number                 // %
  fraisBanque?: number                 // Frais de dossier banque
  fraisDossier?: number                // Alias historique (gardé pour compat)

  // Différé
  differeAmortissement?: number        // Différé partiel (mois)
  differeTotal?: number                // Différé total (mois)

  // Flags
  revisable?: boolean
  modulable?: boolean

  // Assurance(s)
  assurances?: PretAssurance[]
  /** @deprecated utiliser assurances[].taux — gardé pour compat ascendante */
  tauxAssurance?: number

  // Mensualités (calculées ou saisies)
  mensualiteHorsAssurance?: number
  mensualiteAssurance?: number
  mensualiteTotale?: number

  // Paliers (lissage)
  paliers?: PretPalier[]

  // Garantie
  garantieType?: GarantieType
  garantieMontant?: number

  // TAEG / commission
  taeg?: number
  commission?: number

  // Suivi banque
  statut: PretStatut
  numeroPretBanque?: string
  dateOffre?: string
  dateSignature?: string
  notes?: string

  // Affichage graphique
  /** Couleur hexadécimale assignée au prêt (sinon générée par index). */
  couleur?: string

  createdAt?: string
  updatedAt?: string
}

export const PRET_TYPE_LABEL: Record<PretType, string> = {
  amortissable: 'Prêt bancaire',
  ptz: 'PTZ — Prêt à taux zéro',
  action_logement: 'Action Logement',
  epargne_logement: 'Épargne Logement (PEL/CEL)',
  relais: 'Prêt relais',
  in_fine: 'Prêt in fine',
  lissage: 'Lissage',
}

export const PRET_PROFIL_LABEL: Record<PretProfilAmortissement, string> = {
  standard: 'Standard (mensualités constantes)',
  paliers_lissage: 'Paliers / Lissage',
  in_fine: 'In fine',
  differe: 'Différé',
}

export const PRET_STATUT_LABEL: Record<PretStatut, string> = {
  propose: 'Proposé',
  accorde: 'Accordé',
  offre_editee: 'Offre éditée',
  signe: 'Signé',
  refuse: 'Refusé',
  abandonne: 'Abandonné',
}

export const GARANTIE_LABEL: Record<GarantieType, string> = {
  credit_logement: 'Crédit Logement',
  saccef: 'SACCEF (Caisse d\'Épargne)',
  casden: 'CASDEN (Banque Populaire)',
  hypotheque: 'Hypothèque',
  ppd: 'PPD (Privilège du prêteur)',
  caution_autre: 'Caution autre organisme',
  nantissement: 'Nantissement',
  autre: 'Autre',
}

/** Palette de couleurs utilisée pour distinguer les prêts dans le graphique. */
export const PRET_PALETTE = [
  '#1F4573', // navy primaire Apolline
  '#E3A51A', // gold
  '#10B981', // emerald
  '#7C3AED', // violet
  '#EF4444', // rose
  '#06B6D4', // cyan
  '#F97316', // orange
  '#84CC16', // lime
] as const

export function pretCouleur(p: Pick<Pret, 'couleur' | 'rang'>): string {
  if (p.couleur) return p.couleur
  return PRET_PALETTE[p.rang % PRET_PALETTE.length]
}

export type RdvResponseStatus = 'organizer' | 'accepted' | 'tentative' | 'declined' | 'notResponded' | 'none'

export type Rdv = {
  id: string
  title: string
  clientId?: string
  clientNom?: string
  type: 'R0' | 'R1' | 'R2' | 'Signature' | 'Autre'
  date: string
  duree: number
  lieu: 'Visio' | 'Bureau' | 'Chez le client'
  rappel?: string
  /** ID de l'événement côté Microsoft Graph (Outlook). Présent si synchronisé. */
  graphId?: string
  /** Email de l'organisateur côté Outlook (présent uniquement pour les events sync O365) */
  organizerEmail?: string
  /** Nom de l'organisateur côté Outlook */
  organizerName?: string
  /** True si l'utilisateur connecté est l'organisateur */
  isOrganizer?: boolean
  /** Statut de réponse côté Outlook (pour les invitations) */
  responseStatus?: RdvResponseStatus
  /** Liste des participants (email + nom + statut de réponse) — pour l'affichage détaillé */
  attendees?: Array<{ email?: string; name?: string; status?: RdvResponseStatus; isRequired?: boolean }>
  /** Aperçu du body (premiers caractères) — utile pour les invitations avec instructions */
  bodyPreview?: string
}

export const rdvs: Rdv[] = [
]

export type Commission = {
  mois: string
  dossierId: string
  clientNom: string
  banque: string
  montantPret: number
  tauxCom: number
  brut: number
  gsupport: number
  net: number
  encaisse: boolean
}

export const commissions: Commission[] = [
]

/**
 * Vide après refacto avril 2026 — les encaissements sont calculés à partir
 * de la table `commissions` (cf. helper `computeEncaissementsMensuels` dans
 * `src/lib/dashboard.ts`).
 * @deprecated utiliser le helper qui agrège depuis le store
 */
export const encaissementsMensuels: Array<{ mois: string; brut: number; net: number }> = []

export const pipelineCounts = () => {
  const counts: Record<Statut, number> = {
    R0: 0, R1_prevu: 0, R1_fait: 0, Montage: 0, Envoi_banque: 0,
    Accord: 0, Offre_editee: 0, Signe: 0, Encaisse: 0, Abandonne: 0,
  }
  dossiers.forEach((d) => { counts[d.statut]++ })
  return counts
}

export type Piece = {
  categorie: 'P1' | 'P2' | 'P3' | 'P4' | 'P5'
  libelle: string
  fichier?: string
  statut: 'valide' | 'a_fournir' | 'manquant' | 'expire'
  dateAjout?: string
}

export const piecesByCategorie: Record<'P1' | 'P2' | 'P3' | 'P4' | 'P5', string> = {
  P1: 'Identité & situation familiale',
  P2: 'Revenus & contrats de travail',
  P3: 'Patrimoine & épargne',
  P4: 'Charges & crédits en cours',
  P5: 'Projet & bien immobilier',
}

// Pièces de démo retirées : la liste réelle vient désormais de OneDrive
// (cf. dossier.oneDriveFolderId + drive.listChildren). La liste mockée polluait
// tous les dossiers avec des pièces "DUMAS" fictives.
export const piecesMock: Piece[] = []

/**
 * Référentiel des pièces attendues pour un dossier de courtage standard.
 * C'est un template statique (pas une vraie pièce avec fichier) qui sert à :
 *  - afficher la liste "Pièces attendues" sur la page Pièces
 *  - calculer un % de complétude en croisant avec les fichiers OneDrive réels
 *  - rappeler à l'emprunteur ce qu'il doit fournir
 *
 * Convention de nommage côté OneDrive : `P{N}_<libellé>_<NOM>.pdf` — c'est ce
 * préfixe qu'on parse dans `categoryFromFilename` pour rapprocher fichier ↔ pièce.
 */
export type PieceAttendue = {
  categorie: 'P1' | 'P2' | 'P3' | 'P4' | 'P5'
  libelle: string
  /** Si true, la pièce n'est requise que dans certains cas (mariage, indépendant…). */
  optionnelle?: boolean
  /**
   * Nombre minimum de fichiers attendus pour que la pièce soit considérée
   * "validée". Default 1. Pour les pièces multi (bulletins, relevés, devis…),
   * mettre 2 ou 3. Si undefined → 1 seul fichier suffit mais TOUS les fichiers
   * matchant seront listés.
   */
  quantiteMin?: number
  /**
   * Si true, on s'attend à plusieurs fichiers de natures variées (ex: diagnostics
   * techniques regroupent DPE + amiante + plomb…). Pas de seuil de quantité,
   * mais affiche tous les matches.
   */
  multi?: boolean
}

export const piecesAttendues: PieceAttendue[] = [
  // P1 — Identité & situation familiale
  { categorie: 'P1', libelle: 'CNI ou passeport (recto-verso)' },
  { categorie: 'P1', libelle: 'Livret de famille' },
  { categorie: 'P1', libelle: 'Justificatif de domicile (< 3 mois)' },
  { categorie: 'P1', libelle: 'Contrat de mariage / PACS', optionnelle: true },
  { categorie: 'P1', libelle: 'Jugement de divorce', optionnelle: true },

  // P2 — Profession & revenus
  { categorie: 'P2', libelle: 'Contrat de travail' },
  { categorie: 'P2', libelle: '3 derniers bulletins de salaire', quantiteMin: 3 },
  { categorie: 'P2', libelle: 'Bulletin de décembre N-1 (cumul annuel)' },
  { categorie: 'P2', libelle: '2 derniers avis d\'imposition', quantiteMin: 2 },
  { categorie: 'P2', libelle: '2 derniers bilans (TNS / indépendant)', optionnelle: true, quantiteMin: 2 },
  { categorie: 'P2', libelle: 'Attestation CAF / allocations', optionnelle: true },

  // P3 — Patrimoine & épargne
  { categorie: 'P3', libelle: '3 derniers relevés de comptes courants', quantiteMin: 3 },
  { categorie: 'P3', libelle: 'Relevés épargne (Livret A, LDD, PEL, AV…)', multi: true },
  { categorie: 'P3', libelle: 'Titres de propriété des biens détenus', optionnelle: true, multi: true },
  { categorie: 'P3', libelle: 'Tableaux d\'amortissement crédits en cours', optionnelle: true, multi: true },

  // P4 — Charges & crédits
  { categorie: 'P4', libelle: 'Quittance de loyer (3 dernières)', quantiteMin: 3 },
  { categorie: 'P4', libelle: 'Bail de location', optionnelle: true },
  { categorie: 'P4', libelle: 'Taxe foncière / taxe d\'habitation', optionnelle: true },
  { categorie: 'P4', libelle: 'Attestation assurance habitation (MRH)' },
  { categorie: 'P4', libelle: 'Attestation crédit en cours / soldé', optionnelle: true, multi: true },

  // P5 — Projet & bien
  { categorie: 'P5', libelle: 'Compromis ou promesse de vente' },
  { categorie: 'P5', libelle: 'Diagnostics techniques (DPE, amiante, plomb…)', multi: true },
  { categorie: 'P5', libelle: 'Devis travaux + plan', optionnelle: true, multi: true },
  { categorie: 'P5', libelle: 'Permis de construire', optionnelle: true },
  { categorie: 'P5', libelle: 'Justificatif d\'apport (relevé compte / donation)', multi: true },
]

export type Role = 'admin' | 'courtier' | 'gestionnaire' | 'assistante'

export type Collaborateur = {
  id: string
  prenom: string
  nom: string
  email: string
  role: Role
  roleLabel: string
  telephone: string
  motDePasse: string
  avatarGradient: string // classes Tailwind pour dégradé avatar
  avatarAccent: string // couleur du texte (initiales)
  creeLe: string
  dernierAcces: string
  actif: boolean
  dossiersAssignes: number
  bio?: string
  /** Signature HTML auto-insérée lors de l'envoi d'un mail depuis Apolline. */
  signatureHtml?: string
  /** Si true, la signature est ajoutée automatiquement dans tout nouveau message. */
  signatureAutoInsert?: boolean
}

export const collaborateurs: Collaborateur[] = [
  {
    id: 'U001',
    prenom: 'Sébastien',
    nom: 'Aujard',
    email: 'sebastien@groupe-apolline.fr',
    role: 'admin',
    roleLabel: 'Courtier · Fondateur',
    telephone: '06 78 90 12 34',
    motDePasse: 'apolline2026',
    avatarGradient: 'from-navy-800 to-navy-900',
    avatarAccent: 'text-gold-400',
    creeLe: '2024-09-01',
    dernierAcces: '2026-04-23T08:12:00',
    actif: true,
    dossiersAssignes: 6,
    bio: 'Fondateur du Groupe Apolline. Spécialiste crédit immobilier & pro BFC.',
  },
  {
    id: 'U002',
    prenom: 'Marine',
    nom: 'Lefèvre',
    email: 'marine.lefevre@groupe-apolline.fr',
    role: 'gestionnaire',
    roleLabel: 'Gestionnaire de dossiers',
    telephone: '06 12 34 56 78',
    motDePasse: 'apolline2026',
    avatarGradient: 'from-emerald-700 to-emerald-900',
    avatarAccent: 'text-emerald-100',
    creeLe: '2025-02-10',
    dernierAcces: '2026-04-22T18:45:00',
    actif: true,
    dossiersAssignes: 12,
    bio: 'Suivi et montage administratif des dossiers bancaires.',
  },
  {
    id: 'U003',
    prenom: 'Thomas',
    nom: 'Bertrand',
    email: 'thomas.bertrand@groupe-apolline.fr',
    role: 'courtier',
    roleLabel: 'Courtier associé',
    telephone: '06 55 44 33 22',
    motDePasse: 'apolline2026',
    avatarGradient: 'from-indigo-700 to-indigo-900',
    avatarAccent: 'text-indigo-100',
    creeLe: '2025-06-15',
    dernierAcces: '2026-04-23T09:30:00',
    actif: true,
    dossiersAssignes: 4,
    bio: 'Développement réseau & R1 clients — secteur Chalon/Mâcon.',
  },
  {
    id: 'U004',
    prenom: 'Julie',
    nom: 'Moreau',
    email: 'julie.moreau@groupe-apolline.fr',
    role: 'assistante',
    roleLabel: 'Assistante — coordination',
    telephone: '06 98 76 54 32',
    motDePasse: 'apolline2026',
    avatarGradient: 'from-rose-700 to-rose-900',
    avatarAccent: 'text-rose-100',
    creeLe: '2025-11-05',
    dernierAcces: '2026-04-23T07:55:00',
    actif: true,
    dossiersAssignes: 0,
    bio: 'Agenda, rappels R1, relances pièces & accueil.',
  },
  // Back office Sébastien (retour beta 2026-05) — comptes à compléter avec
  // emails + mots de passe réels avant le passage en prod.
  {
    id: 'U005',
    prenom: 'Marion',
    nom: 'Hernou',
    email: 'marion.hernou@groupe-apolline.fr',
    role: 'gestionnaire',
    roleLabel: 'Back office',
    telephone: '',
    motDePasse: 'apolline2026',
    avatarGradient: 'from-teal-700 to-teal-900',
    avatarAccent: 'text-teal-100',
    creeLe: '2026-05-01',
    dernierAcces: '2026-05-01T00:00:00',
    actif: true,
    dossiersAssignes: 0,
    bio: 'Back office — montage dossier & relances pièces.',
  },
  {
    id: 'U006',
    prenom: 'Apolline',
    nom: 'Aujard',
    email: 'apolline.aujard@groupe-apolline.fr',
    role: 'gestionnaire',
    roleLabel: 'Back office',
    telephone: '',
    motDePasse: 'apolline2026',
    avatarGradient: 'from-violet-700 to-violet-900',
    avatarAccent: 'text-violet-100',
    creeLe: '2026-05-01',
    dernierAcces: '2026-05-01T00:00:00',
    actif: true,
    dossiersAssignes: 0,
    bio: 'Back office — coordination dossiers Apolline.',
  },
]

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrateur',
  courtier: 'Courtier',
  gestionnaire: 'Gestionnaire',
  assistante: 'Assistante',
}

export const ROLE_BADGE: Record<Role, string> = {
  admin: 'badge-gold',
  courtier: 'badge-navy',
  gestionnaire: 'badge-success',
  assistante: 'badge-warning',
}

/**
 * Vide après refacto avril 2026 — les alertes sont dérivées des dossiers
 * via `dossier.alertes[]` et de l'état des prêts/pièces (cf. helper
 * `computeAlertes` dans `src/lib/dashboard.ts`).
 * @deprecated utiliser le helper qui agrège depuis le store
 */
export type AlerteGlobale = {
  type: 'piece' | 'hcsf' | 'rdv' | 'relance'
  titre: string
  detail: string
  priorite: 'haute' | 'moyenne' | 'basse'
  dossierId: string
}
export const alertesGlobales: AlerteGlobale[] = []
