-- ─────────────────────────────────────────────────────────────────────────────
-- Ajoute le champ bien_details à dossier pour stocker les caractéristiques
-- physiques du bien immobilier (extraites par /dossier-extract §5.1, §5.2, §5.3) :
--   - surface habitable / terrain
--   - année de construction
--   - DPE (classe + consommation + GES)
--   - audit énergétique (n°, scénarios travaux)
--   - autres données qualitatives
--
-- Stocké en jsonb pour rester flexible (structure peut évoluer sans migration).
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS bien_details JSONB DEFAULT '{}'::jsonb;
