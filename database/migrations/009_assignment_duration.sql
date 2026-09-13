ALTER TABLE quiz_assignments
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER
  CHECK (duration_minutes BETWEEN 1 AND 1440);
