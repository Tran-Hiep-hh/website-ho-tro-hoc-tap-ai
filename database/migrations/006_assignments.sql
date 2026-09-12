ALTER TABLE quiz_assignments DROP CONSTRAINT IF EXISTS quiz_assignments_status_check;
ALTER TABLE quiz_assignments ADD CONSTRAINT quiz_assignments_status_check CHECK (status IN ('DRAFT','PUBLISHED','CANCELLED'));
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS answer_revision INTEGER NOT NULL DEFAULT 0;
