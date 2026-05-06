-- Migration : index Postgres sur les colonnes filtrées fréquemment côté backend.
-- Anti-table-scan dès qu'on dépasse les 1000 lignes par table.

-- Dossiers
CREATE INDEX IF NOT EXISTS dossiers_archive_idx ON dossiers (archive);
CREATE INDEX IF NOT EXISTS dossiers_created_at_idx ON dossiers (created_at DESC);
CREATE INDEX IF NOT EXISTS dossiers_signature_date_idx ON dossiers (signature_date);

-- Prêts (FK dossier_id existe déjà via foreign key, mais index explicite pour les jointures)
CREATE INDEX IF NOT EXISTS prets_dossier_id_idx ON prets (dossier_id);
CREATE INDEX IF NOT EXISTS prets_statut_idx ON prets (statut);

-- Clients
CREATE INDEX IF NOT EXISTS clients_nom_idx ON clients (nom);
CREATE INDEX IF NOT EXISTS clients_apporteur_idx ON clients (apporteur);

-- Commissions : filtre par "encaissé/non" (cas usuel pour les rapports)
CREATE INDEX IF NOT EXISTS commissions_encaisse_idx ON commissions (encaisse);

-- Notifications (uniquement les non-lues, partial index = très efficace)
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications (created_at DESC) WHERE read = false;

-- Note : les index FK de base (idx sur les *_id qui sont REFERENCES) sont déjà
-- créés par le schema.ts via Drizzle index('...').on(t.col). Ce fichier ajoute
-- les index complémentaires non-FK qui n'apparaissent pas dans schema.ts.
