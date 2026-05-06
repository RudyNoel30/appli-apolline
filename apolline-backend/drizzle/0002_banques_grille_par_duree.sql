-- Migration : enrichit la table `banques` avec une grille par durée + métadonnées.
-- Permet au courtier de saisir des taux différenciés 15/20/25 ans depuis
-- l'éditeur Paramètres → Banques & barèmes (option 2 du chantier barèmes).

ALTER TABLE banques ADD COLUMN IF NOT EXISTS taux_15 real NOT NULL DEFAULT 0;
ALTER TABLE banques ADD COLUMN IF NOT EXISTS taux_20 real NOT NULL DEFAULT 0;
ALTER TABLE banques ADD COLUMN IF NOT EXISTS taux_25 real NOT NULL DEFAULT 0;
ALTER TABLE banques ADD COLUMN IF NOT EXISTS date_maj text;
ALTER TABLE banques ADD COLUMN IF NOT EXISTS notes text;

-- Initialise les nouvelles colonnes par défaut à partir de tauxMoyen pour ne
-- pas casser la simulation tant que le courtier n'a pas saisi sa grille.
UPDATE banques SET
  taux_15 = COALESCE(NULLIF(taux_15, 0), taux_moyen),
  taux_20 = COALESCE(NULLIF(taux_20, 0), taux_moyen),
  taux_25 = COALESCE(NULLIF(taux_25, 0), taux_moyen),
  date_maj = COALESCE(date_maj, to_char(now(), 'YYYY-MM-DD'))
WHERE taux_15 = 0 OR taux_20 = 0 OR taux_25 = 0 OR date_maj IS NULL;
