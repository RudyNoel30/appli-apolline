-- Migration 0013 — Lien direct dossier → fiche apporteur du référentiel.
--
-- Avant : dossier.apporteurNom (texte libre) sans lien avec la table apporteurs.
-- Conséquence : pas moyen de retrouver le RCS / adresse pro de l'apporteur du
-- dossier pour faire un chèque de rétrocession sans re-saisir manuellement.
--
-- Après : dossier.apporteur_id (uuid FK) lie vers apporteurs(id). On garde
-- apporteurNom comme snapshot du libellé au moment de la création (utile pour
-- les exports même si l'apporteur est renommé après).
--
-- Side-effect : ON DELETE SET NULL — si on supprime un apporteur du
-- référentiel, le dossier conserve apporteurNom (snapshot) mais perd le lien.

ALTER TABLE dossiers
  ADD COLUMN IF NOT EXISTS apporteur_id uuid REFERENCES apporteurs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS dossiers_apporteur_id_idx ON dossiers(apporteur_id);
