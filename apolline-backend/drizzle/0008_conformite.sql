-- Migration : tracker conformité IOBSP
--
-- Table conformite_certifs : carte ORIAS, RC pro, garantie financière,
--   capacité professionnelle, etc. Chaque ligne = un document à jour
--   avec date d'expiration. Les alertes se calculent à la volée.
--
-- Table conformite_formations : formations continues 15h/an obligatoires
--   pour les IOBSP (CMF R.519-15). Chaque ligne = une session suivie
--   avec son attestation, sa durée et sa thématique.

CREATE TABLE IF NOT EXISTS conformite_certifs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborateur_id text NOT NULL REFERENCES collaborateurs(id) ON DELETE CASCADE,

  type text NOT NULL CHECK (type IN (
    'orias',                  -- Immatriculation ORIAS (renouvellement annuel 15 fév.)
    'carte_pro',              -- Carte professionnelle IOBSP
    'rc_pro',                 -- Responsabilité civile professionnelle
    'garantie_financiere',    -- Garantie financière (catégorie 1)
    'capacite_pro',           -- Justificatif de capacité (diplôme, expérience, stage 150h)
    'autre'
  )),

  libelle text NOT NULL,
  organisme_emetteur text,
  numero text,                -- N° ORIAS, n° police RC pro, etc.

  /** Dates : émission, début de validité, expiration prévue. */
  emise_le timestamptz,
  valide_du timestamptz,
  expire_le timestamptz,

  /** Pour la garantie financière et la RC pro : montant garanti en EUR (centimes). */
  montant_garantie integer,

  /** Document associé (PDF) — stocké sur le filesystem du backend. */
  filename text,
  file_path text,
  sha256 text,

  /** Délai d'alerte avant expiration (en jours). Défaut 60. */
  alerte_jours_avant integer NOT NULL DEFAULT 60,

  notes text,
  created_by text REFERENCES collaborateurs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conformite_certifs_collab_idx ON conformite_certifs (collaborateur_id);
CREATE INDEX IF NOT EXISTS conformite_certifs_expire_idx ON conformite_certifs (expire_le);
CREATE INDEX IF NOT EXISTS conformite_certifs_type_idx ON conformite_certifs (type);

-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conformite_formations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborateur_id text NOT NULL REFERENCES collaborateurs(id) ON DELETE CASCADE,

  titre text NOT NULL,
  organisme_formateur text,

  /** Type : initiale (avant immatriculation) ou continue (15h/an obligatoires). */
  type text NOT NULL CHECK (type IN ('initiale', 'continue', 'thematique')) DEFAULT 'continue',

  /** Thématique (ex: 'credit_immobilier', 'lcb_ft', 'iobsp_reglementation') — libre */
  theme text,

  date_debut timestamptz NOT NULL,
  date_fin timestamptz,
  duree_heures real NOT NULL DEFAULT 0,

  /** Attestation de formation (PDF). */
  filename text,
  file_path text,
  sha256 text,

  notes text,
  created_by text REFERENCES collaborateurs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conformite_formations_collab_idx ON conformite_formations (collaborateur_id);
CREATE INDEX IF NOT EXISTS conformite_formations_date_idx ON conformite_formations (date_debut);

-- Permissions backend
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'apolline') THEN
    GRANT ALL ON conformite_certifs TO apolline;
    GRANT ALL ON conformite_formations TO apolline;
  END IF;
END $$;
