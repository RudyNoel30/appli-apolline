-- Migration : module Facturation
-- Tables :
--   - factures            : registre des factures émises (honoraires, commissions, ristournes, avoirs)
--   - factures_counters   : compteurs séquentiels par préfixe + année (F<yy>-NNNN, R<yy>-NNNN)
--
-- Convention numérotation Cifacil-style : F26-0001, R26-0001 (compteur unique par année)

CREATE TABLE IF NOT EXISTS factures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref text NOT NULL UNIQUE,

  -- Type & lien dossier
  type text NOT NULL CHECK (type IN (
    'honoraires', 'comm_banque', 'comm_autre', 'ristourne',
    'avoir_honoraires', 'avoir_comm_banque', 'avoir_comm_autre', 'avoir_ristourne'
  )),
  dossier_id uuid NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  client_id  uuid REFERENCES clients(id) ON DELETE SET NULL,

  -- Émetteur / bénéficiaire
  partenaire_type  text CHECK (partenaire_type IN ('client', 'banque', 'apporteur', 'autre')),
  partenaire_id    text,             -- text pour supporter banques.id ('CEBFC') et apporteurs.id (uuid)
  partenaire_nom   text,
  partenaire_email text,

  -- Montants (en centimes pour précision exacte)
  montant_ht  integer NOT NULL DEFAULT 0,
  tva_taux    real    NOT NULL DEFAULT 0.20,
  montant_tva integer NOT NULL DEFAULT 0,
  montant_ttc integer NOT NULL DEFAULT 0,

  -- Dates
  emise_le      timestamptz,
  echeance_le   timestamptz,
  reglee_le     timestamptz,
  prevue_le     timestamptz,
  acte_le       timestamptz,

  -- Règlement
  mode_reglement text CHECK (mode_reglement IS NULL OR mode_reglement IN (
    'virement', 'cheque', 'prelevement', 'cb', 'numeraire',
    'via_notaire', 'via_banque', 'autre'
  )),
  montant_regle integer NOT NULL DEFAULT 0,
  numero_piece  text,

  -- Statut
  statut text NOT NULL DEFAULT 'prevue' CHECK (statut IN (
    'prevue', 'emise', 'reglee_partiel', 'reglee', 'avoir_emis', 'annulee'
  )),

  -- Liens
  commission_id    uuid REFERENCES commissions(id) ON DELETE SET NULL,
  facture_avoir_id uuid REFERENCES factures(id) ON DELETE SET NULL,

  -- Génération PDF
  template_id     uuid,
  pdf_file_path   text,
  pdf_sha256      text,

  -- Texte
  prestation     text,
  info_reglement text,
  commentaire    text,

  -- Audit
  created_by text REFERENCES collaborateurs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS factures_dossier_id_idx ON factures (dossier_id);
CREATE INDEX IF NOT EXISTS factures_client_id_idx  ON factures (client_id);
CREATE INDEX IF NOT EXISTS factures_type_idx       ON factures (type);
CREATE INDEX IF NOT EXISTS factures_statut_idx     ON factures (statut);
CREATE INDEX IF NOT EXISTS factures_emise_le_idx   ON factures (emise_le);
CREATE INDEX IF NOT EXISTS factures_ref_idx        ON factures (ref);

-- Compteurs séquentiels (1 par préfixe + année)
CREATE TABLE IF NOT EXISTS factures_counters (
  prefix text NOT NULL,
  year   integer NOT NULL,
  next   integer NOT NULL DEFAULT 1,
  PRIMARY KEY (prefix, year)
);

-- Permissions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'apolline') THEN
    GRANT ALL ON factures TO apolline;
    GRANT ALL ON factures_counters TO apolline;
  END IF;
END $$;
