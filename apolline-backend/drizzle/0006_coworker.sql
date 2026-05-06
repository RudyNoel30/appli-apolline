-- Migration : tables Coworker (assistant Claude conversationnel)
-- Une conversation par utilisateur, persistée. Les messages sont stockés
-- séquentiellement avec leur `seq` pour un ordre stable.

CREATE TABLE IF NOT EXISTS coworker_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES collaborateurs(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Nouvelle conversation',
  context_snapshot jsonb DEFAULT '{}'::jsonb,
  cumulative_cost_eur real NOT NULL DEFAULT 0,
  cumulative_tokens_in integer NOT NULL DEFAULT 0,
  cumulative_tokens_out integer NOT NULL DEFAULT 0,
  model text NOT NULL DEFAULT 'sonnet',
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coworker_conv_user_id_idx ON coworker_conversations (user_id);
CREATE INDEX IF NOT EXISTS coworker_conv_updated_idx ON coworker_conversations (updated_at);

CREATE TABLE IF NOT EXISTS coworker_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES coworker_conversations(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content jsonb NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coworker_msg_conv_idx ON coworker_messages (conversation_id, seq);

-- Permissions backend
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'apolline') THEN
    GRANT ALL ON coworker_conversations TO apolline;
    GRANT ALL ON coworker_messages TO apolline;
  END IF;
END $$;
