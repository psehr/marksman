-- Convert legacy grade goals to Pass with an optional grade requirement.
-- Pass rejects played NF and cannot require it.
WITH converted AS (
  UPDATE bounties
  SET goal = jsonb_set(
    (goal - 'minimumGradeRequirement')
      || jsonb_build_object(
        'type', 'pass',
        'minimumGrade', goal->'minimumGradeRequirement'
      ),
    '{modRequirement,required}',
    (goal->'modRequirement'->'required') - 'NF'
  )
  WHERE goal->>'type' = 'minimum_grade'
  RETURNING id, status
)
-- Settlement trusts persisted verdicts, so recheck attempts under the new rules.
-- Include invalid attempts: removing required NF can make exact NM eligible.
UPDATE hunt_attempts AS attempt
SET verification_status = 'pending',
    verification_result = NULL,
    verified_at = NULL,
    verification_attempts = 0,
    next_verification_at = now(),
    last_verification_error = NULL
FROM bounty_hunts AS hunt, converted
WHERE attempt.hunt_id = hunt.id
  AND hunt.bounty_id = converted.id
  AND converted.status = 'open';
