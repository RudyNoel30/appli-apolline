-- Migration : table audit_log pour traçabilité IOBSP / RGPD.
-- Append-only : aucune route DELETE/UPDATE exposée. Purge via cron rétention 5 ans.

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ts timestamptz NOT NULL DEFAULT now(),
  user_id text,
  user_email text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  details text,
  ip text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS audit_log_ts_idx ON audit_log (ts DESC);
CREATE INDEX IF NOT EXISTS audit_log_user_id_idx ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log (action);

-- GRANT pour le user backend (apolline) — sinon le sanitizer drizzle pourrait planter
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'apolline') THEN
    GRANT ALL ON audit_log TO apolline;
  END IF;
END $$;
