-- Migration : enrichit la table `pieces` pour le stockage local backend.
-- Permet d'uploader, prévisualiser et supprimer les pièces depuis l'app
-- (sans passer par OneDrive).

ALTER TABLE pieces ALTER COLUMN libelle DROP NOT NULL;
ALTER TABLE pieces ALTER COLUMN libelle SET DEFAULT '';

ALTER TABLE pieces ADD COLUMN IF NOT EXISTS filename text;
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS mime_type text NOT NULL DEFAULT 'application/octet-stream';
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS size_bytes integer NOT NULL DEFAULT 0;
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS sha256 text;
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS file_path text;
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS uploaded_by text;
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS uploaded_at timestamptz NOT NULL DEFAULT now();

-- Pour les pièces déjà créées via OneDrive (legacy), filename reprend `fichier`
UPDATE pieces SET filename = COALESCE(fichier, '(sans nom)') WHERE filename IS NULL;
ALTER TABLE pieces ALTER COLUMN filename SET NOT NULL;

CREATE INDEX IF NOT EXISTS pieces_sha256_idx ON pieces (sha256);

-- Permissions backend
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'apolline') THEN
    GRANT ALL ON pieces TO apolline;
  END IF;
END $$;
