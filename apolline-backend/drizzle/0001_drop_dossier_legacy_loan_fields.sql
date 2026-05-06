-- Migration : suppression des champs prêt deprecated sur la table `dossiers`.
-- Ces champs portaient un seul prêt par dossier ; ils sont remplacés par la
-- table `prets` (un dossier peut héberger plusieurs prêts, potentiellement
-- chez des banques différentes — Cifacil-style).
--
-- À appliquer en production AVEC un backup préalable :
--    pg_dump apolline > apolline-pre-drop-loanfields.sql
--    psql apolline < drizzle/0001_drop_dossier_legacy_loan_fields.sql
--
-- Si des dossiers existants ont encore une valeur dans ces colonnes, il faut
-- les recréer côté `prets` AVANT de lancer ce script (cf. requête de migration
-- en commentaire ci-dessous).
--
-- ─── Requête de migration de données (optionnel, à dérouler avant le DROP) ───
--
-- INSERT INTO prets (
--   id, dossier_id, rang, libelle, banque, banque_id, type, montant, duree_mois,
--   taux_nominal, mensualite, statut, created_at, updated_at
-- )
-- SELECT
--   gen_random_uuid()::text,
--   d.id,
--   1,
--   'Prêt principal (migré)',
--   d.banque,
--   d.banque_id,
--   'amortissable',
--   d.montant_pret,
--   d.duree_mois,
--   d.taux_nominal,
--   d.mensualite,
--   'sollicite',
--   now(),
--   now()
-- FROM dossiers d
-- WHERE (d.banque IS NOT NULL OR d.taux_nominal IS NOT NULL OR d.mensualite IS NOT NULL)
--   AND NOT EXISTS (SELECT 1 FROM prets p WHERE p.dossier_id = d.id);
--
-- ─── Drop ───

ALTER TABLE dossiers DROP COLUMN IF EXISTS banque;
ALTER TABLE dossiers DROP COLUMN IF EXISTS banque_id;
ALTER TABLE dossiers DROP COLUMN IF EXISTS taux_nominal;
ALTER TABLE dossiers DROP COLUMN IF EXISTS mensualite;
ALTER TABLE dossiers DROP COLUMN IF EXISTS commission;
