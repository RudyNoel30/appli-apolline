/**
 * Prompts d'extraction structurée pour Claude Vision.
 *
 * Chaque type de document a un prompt dédié qui demande à Claude de retourner
 * un JSON conforme à un schéma fixe. Les champs incertains sont retournés en
 * null avec une `confidence` basse (0.0-1.0), ce qui permet au frontend de
 * mettre en évidence les champs à vérifier humainement.
 *
 * Convention :
 *   - Tous les montants en € entiers (pas de virgule, pas de symbole)
 *   - Toutes les dates au format ISO YYYY-MM-DD
 *   - SIREN sur 9 chiffres, SIRET sur 14 chiffres (string pour conserver le 0 initial)
 *   - confidence.global = note synthétique de la fiabilité de l'extraction
 */

export type ExtractionType =
  | 'bulletin_salaire'
  | 'avis_imposition'
  | 'rib'
  | 'cni'
  | 'justif_domicile'
  | 'compromis'
  | 'dpe'
  | 'autre'

// ─── Bulletin de salaire ────────────────────────────────────────────────────
export const PROMPT_BULLETIN_SALAIRE = `Tu es un expert en lecture de bulletins de salaire français.

Analyse l'image qui t'est fournie. Si elle ne contient pas un bulletin de salaire, retourne strictement {"error": "not_a_payslip"}.

Sinon, extrais les informations au format JSON STRICT suivant (utilise null pour toute valeur incertaine ou absente, jamais "N/A" ou "?") :

{
  "periode_debut": "YYYY-MM-DD",
  "periode_fin": "YYYY-MM-DD",
  "employeur": {
    "raison_sociale": "string",
    "siret": "string ou null (14 chiffres si présent)",
    "adresse": "string ou null"
  },
  "salarie": {
    "nom": "string",
    "prenom": "string",
    "date_entree": "YYYY-MM-DD ou null",
    "poste": "string ou null",
    "contrat": "CDI|CDD|interim|stage|alternance|autre"
  },
  "remuneration": {
    "salaire_brut": number,
    "net_imposable": number,
    "net_a_payer": number,
    "heures_normales": number,
    "heures_supp": number,
    "primes": [{"libelle": "string", "montant": number}]
  },
  "cumul_annuel": {
    "brut_cumul": number,
    "net_imposable_cumul": number
  },
  "confidence": {
    "periode": 0.0,
    "employeur": 0.0,
    "salarie": 0.0,
    "remuneration": 0.0,
    "global": 0.0
  }
}

Règles strictes :
- Tous les montants en euros entiers (arrondis), sans symbole, sans espace
- Les heures avec 2 décimales max (ex: 151.67)
- Si la rubrique "Salaire net imposable" n'est pas visible, mets net_imposable = null et baisse confidence.remuneration
- Si tu hésites entre 2 valeurs proches, prends celle qui est dans la colonne "À payer" / "Cumul"
- confidence.global ∈ [0,1] reflète ta confiance moyenne pondérée
- N'ajoute AUCUN texte hors du JSON, pas de markdown, pas de commentaire`

// ─── Avis d'imposition ──────────────────────────────────────────────────────
export const PROMPT_AVIS_IMPOSITION = `Tu es un expert en lecture d'avis d'imposition français (DGFiP).

Analyse l'image. Si ce n'est pas un avis d'imposition (impôt sur le revenu), retourne {"error": "not_an_avis_imposition"}.

Sinon, extrais au format JSON STRICT suivant :

{
  "annee_revenus": number,
  "annee_avis": number,
  "numero_fiscal": "string ou null (13 chiffres)",
  "reference_avis": "string ou null",
  "foyer": {
    "nom_declarant1": "string ou null",
    "prenom_declarant1": "string ou null",
    "nom_declarant2": "string ou null",
    "prenom_declarant2": "string ou null",
    "situation": "marie|pacs|celibataire|divorce|veuf|union_libre|null",
    "parts": number,
    "nb_personnes_charge": number,
    "adresse": "string ou null"
  },
  "revenus": {
    "rfr": number,
    "revenu_brut_global": number,
    "revenu_imposable": number,
    "revenus_categoriels": {
      "salaires_pensions": number,
      "bic": number,
      "bnc": number,
      "ba": number,
      "fonciers": number,
      "rcm": number
    }
  },
  "impot": {
    "impot_net_avant_corrections": number,
    "impot_du_apres_decote": number,
    "taux_imposition_pct": number,
    "taux_marginal_pct": number
  },
  "confidence": {
    "foyer": 0.0,
    "revenus": 0.0,
    "rfr": 0.0,
    "global": 0.0
  }
}

Règles :
- Le RFR (Revenu Fiscal de Référence) est le champ LE PLUS IMPORTANT, ta confidence.rfr doit refléter ta certitude sur cette valeur précise
- Les revenus_categoriels à 0 si non présents (et non null)
- annee_revenus = année des revenus déclarés (typiquement avis_annee - 1)
- parts en décimal (ex: 2.5)
- Aucun texte hors du JSON`

// ─── RIB ────────────────────────────────────────────────────────────────────
export const PROMPT_RIB = `Tu es un expert en lecture de RIB français.

Analyse l'image. Si ce n'est pas un RIB, retourne {"error": "not_a_rib"}.

Sinon JSON STRICT :

{
  "iban": "string sans espaces (FR76...)",
  "bic": "string ou null",
  "banque": "string (nom complet de la banque)",
  "agence": "string ou null (code ou libellé)",
  "titulaire": {
    "nom": "string",
    "prenom": "string ou null",
    "adresse": "string ou null"
  },
  "confidence": {
    "iban": 0.0,
    "titulaire": 0.0,
    "global": 0.0
  }
}

Règles :
- L'IBAN doit être validé visuellement (commence par FR76 + 23 caractères pour la France)
- Si tu vois "FR76 1234 5678 …" enlève les espaces dans la sortie
- Aucun texte hors du JSON`

// ─── CNI ────────────────────────────────────────────────────────────────────
export const PROMPT_CNI = `Tu es un expert en lecture de cartes nationales d'identité françaises (ancienne et nouvelle version).

Analyse l'image. Si ce n'est pas une CNI ou un passeport français, retourne {"error": "not_a_french_id"}.

Sinon JSON STRICT :

{
  "type_piece": "cni|passeport",
  "nom": "string",
  "nom_usage": "string ou null",
  "prenom": "string",
  "prenoms_secondaires": ["string"],
  "date_naissance": "YYYY-MM-DD",
  "lieu_naissance": "string",
  "sexe": "M|F",
  "nationalite": "string",
  "date_delivrance": "YYYY-MM-DD ou null",
  "date_expiration": "YYYY-MM-DD",
  "numero_piece": "string ou null",
  "autorite_delivrance": "string ou null",
  "confidence": {
    "identite": 0.0,
    "validite": 0.0,
    "global": 0.0
  }
}

Aucun texte hors du JSON.`

// ─── Justificatif de domicile ──────────────────────────────────────────────
export const PROMPT_JUSTIF_DOMICILE = `Tu es un expert en lecture de justificatifs de domicile français (facture EDF/Engie/Veolia/eau/téléphone/internet/quittance loyer/avis taxe foncière ou habitation, etc.).

Analyse l'image. Si ce n'est pas un justificatif de domicile, retourne {"error": "not_a_proof_of_residence"}.

Sinon JSON STRICT :

{
  "type_justif": "edf|engie|eau|telecom|loyer|tax_fonciere|tax_habitation|autre",
  "titulaire": {
    "nom": "string",
    "prenom": "string ou null"
  },
  "adresse": {
    "ligne1": "string",
    "ligne2": "string ou null",
    "code_postal": "string",
    "ville": "string"
  },
  "date_emission": "YYYY-MM-DD",
  "fournisseur": "string ou null",
  "confidence": {
    "adresse": 0.0,
    "titulaire": 0.0,
    "global": 0.0
  }
}

Aucun texte hors du JSON.`

// ─── Routing ───────────────────────────────────────────────────────────────
export const EXTRACTION_PROMPTS: Record<ExtractionType, string> = {
  bulletin_salaire: PROMPT_BULLETIN_SALAIRE,
  avis_imposition: PROMPT_AVIS_IMPOSITION,
  rib: PROMPT_RIB,
  cni: PROMPT_CNI,
  justif_domicile: PROMPT_JUSTIF_DOMICILE,
  compromis: '',  // Phase 3 — non implémenté
  dpe: '',        // Phase 3 — non implémenté
  autre: '',
}

/**
 * Prompt de classification automatique du document.
 * Utilisé quand le type n'est pas fourni explicitement.
 */
export const PROMPT_CLASSIFY = `Tu es un expert en classification de documents administratifs français.

Analyse l'image qui t'est fournie et identifie SON TYPE PRINCIPAL.

Réponds STRICTEMENT par un seul JSON :
{
  "type": "bulletin_salaire" | "avis_imposition" | "rib" | "cni" | "justif_domicile" | "compromis" | "dpe" | "autre",
  "confidence": 0.0-1.0,
  "raison": "string courte (max 50 chars)"
}

Règles :
- "compromis" = compromis ou promesse de vente immobilière
- "dpe" = diagnostic de performance énergétique
- "justif_domicile" = facture EDF/Engie/eau/télécom/quittance loyer/avis fiscal habitation
- "autre" si tu ne reconnais aucune de ces catégories (livret de famille, RIB sociale, etc.)
- Aucun texte hors du JSON`
