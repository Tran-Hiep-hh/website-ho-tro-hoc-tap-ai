-- Remove results retained by the previous deletion behavior.
-- attempt_answers are deleted through the existing ON DELETE CASCADE.
DELETE FROM quiz_attempts t
USING quiz_versions v, generated_contents g
WHERE t.quiz_version_id=v.quiz_version_id AND v.quiz_id=g.content_id
  AND g.status='DELETED' AND t.assignment_id IS NULL;

DELETE FROM quiz_attempts t
USING quiz_assignments a, classrooms c
WHERE t.assignment_id=a.assignment_id AND a.class_id=c.class_id
  AND (a.deleted_at IS NOT NULL OR c.status='DELETED');
