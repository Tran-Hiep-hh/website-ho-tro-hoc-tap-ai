ALTER TABLE quiz_assignments
    ADD COLUMN IF NOT EXISTS shuffle_questions BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE quiz_attempts
    ADD COLUMN IF NOT EXISTS question_order JSONB;
