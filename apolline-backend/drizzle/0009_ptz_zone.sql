-- Migration : ajoute la colonne ptz_zone aux dossiers pour la validation PTZ
-- (A bis / A / B1 / B2 / C selon le zonage géographique 2024-2027).
--
-- Les emprunteurs (jsonb) gagnent un champ optionnel `primoAccedant: boolean`
-- déjà supporté car la colonne emprunteur1 est jsonb.

ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS ptz_zone text;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'apolline') THEN
    GRANT ALL ON dossiers TO apolline;
  END IF;
END $$;
