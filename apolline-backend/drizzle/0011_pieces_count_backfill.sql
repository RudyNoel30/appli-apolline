-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill des compteurs dossiers.pieces_fournies / pieces_total.
--
-- Avant cette migration, dossiers.pieces_fournies n'était jamais incrémenté
-- lors d'un upload de pièce, donc TOUS les dossiers existants affichaient
-- 0/X sur le dashboard alors que des pièces étaient bien uploadées.
--
-- Ce SQL :
--  1. Met à jour pieces_fournies = COUNT réel des pieces du dossier
--  2. Met pieces_total à 24 (convention Apolline = nb pièces non optionnelles)
--     si jamais initialisé (vaut 0).
--
-- Idempotent : peut être ré-appliqué sans risque (les valeurs convergent
-- toujours vers la réalité COUNT(*)).
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE dossiers d
SET pieces_fournies = (
  SELECT COUNT(*)::int FROM pieces p WHERE p.dossier_id = d.id
),
pieces_total = CASE WHEN d.pieces_total = 0 THEN 24 ELSE d.pieces_total END;
