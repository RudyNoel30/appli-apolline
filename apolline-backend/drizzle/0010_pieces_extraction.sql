-- ─────────────────────────────────────────────────────────────────────────────
-- OCR / Extraction automatique des pièces — Phase 1
-- Étend la table pieces avec les champs d'extraction Claude Vision.
-- Idempotent (IF NOT EXISTS partout).
-- ─────────────────────────────────────────────────────────────────────────────

-- Type de document détecté par Claude (ou explicitement choisi par le user)
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS extraction_type TEXT;
-- Valeurs possibles : 'bulletin_salaire' | 'avis_imposition' | 'rib' | 'cni' |
-- 'justif_domicile' | 'compromis' | 'dpe' | 'autre' | NULL (non analysé)

-- Statut de l'extraction
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS extraction_status TEXT
  CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed', 'applied', 'rejected'));

-- Données extraites (JSON brut renvoyé par Claude, structure dépend du type)
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS extracted_data JSONB;

-- Score de confiance global (0.0-1.0)
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS extraction_confidence REAL;

-- Message d'erreur si extraction_status = 'failed'
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS extraction_error TEXT;

-- Horodatages
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMPTZ;
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;

-- Qui a appliqué (collaborateur ID)
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS applied_by TEXT;

-- Index pour query "toutes les pièces avec extraction pending d'un dossier"
CREATE INDEX IF NOT EXISTS pieces_extraction_status_idx ON pieces (extraction_status)
  WHERE extraction_status IS NOT NULL;
