-- Migration 0012 — Conjoint structuré dans `clients` + champs business `apporteurs`.
--
-- Contexte : retour beta Sébastien (2026-05) — le champ texte libre
-- `clients.conjoint` causait des erreurs de mapping ("AUJARD" se retrouvait
-- dans `prenom` du co-emprunteur lors de la création de dossier). On passe à
-- des champs structurés conjointPrenom/Nom/Naissance/etc.
--
-- En parallèle, ajout sur `apporteurs` des champs nécessaires pour faire des
-- chèques de rétrocession : RCS, adresse pro, carte T, IBAN.
--
-- Le champ legacy `conjoint` (texte libre) est CONSERVÉ pour rétrocompat —
-- il sera rempli à l'écriture par le frontend ("Prenom Nom") quand un
-- conjoint est saisi via le nouveau formulaire. Les vues qui n'ont pas
-- encore migré (recherche, export, etc.) continuent de fonctionner.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS lieu_naissance         text,
  ADD COLUMN IF NOT EXISTS adresse                text,
  ADD COLUMN IF NOT EXISTS code_postal            text,
  ADD COLUMN IF NOT EXISTS conjoint_prenom        text,
  ADD COLUMN IF NOT EXISTS conjoint_nom           text,
  ADD COLUMN IF NOT EXISTS conjoint_naissance     text,
  ADD COLUMN IF NOT EXISTS conjoint_lieu_naissance text,
  ADD COLUMN IF NOT EXISTS conjoint_tel           text,
  ADD COLUMN IF NOT EXISTS conjoint_email         text,
  ADD COLUMN IF NOT EXISTS conjoint_profession    text;

ALTER TABLE apporteurs
  ADD COLUMN IF NOT EXISTS rcs               text,
  ADD COLUMN IF NOT EXISTS adresse_pro       text,
  ADD COLUMN IF NOT EXISTS code_postal_pro   text,
  ADD COLUMN IF NOT EXISTS ville_pro         text,
  ADD COLUMN IF NOT EXISTS carte_t           text,
  ADD COLUMN IF NOT EXISTS iban              text;
