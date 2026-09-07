-- Additive migration for databases created from the earlier starter schema.
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'BLOCKED', 'INACTIVE'));
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS session_id UUID NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_session_unique ON refresh_tokens (session_id);
