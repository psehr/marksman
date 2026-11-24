-- Preserve existing bounty rules; UI defaults apply only to newly created bounties.
-- Refuse unexpected legacy data rather than silently weaken a requirement.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM bounties
    WHERE goal->'modRequirement' ? 'rule'
      AND (
        goal->'modRequirement'->>'rule' NOT IN ('any', 'exact', 'includes', 'excludes')
        OR goal->'modRequirement'->'mods' @> '["SO"]'::jsonb
      )
  ) THEN
    RAISE EXCEPTION 'Unsupported legacy mod requirements; review before migrating';
  END IF;
END $$;
--> statement-breakpoint
UPDATE bounties
SET goal = jsonb_set(
  goal,
  '{modRequirement}',
  jsonb_build_object(
    'required', CASE
      WHEN goal->'modRequirement'->>'rule' IN ('exact', 'includes')
        THEN goal->'modRequirement'->'mods'
      ELSE '[]'::jsonb
    END,
    'forbidden', CASE
      WHEN goal->'modRequirement'->>'rule' = 'excludes'
        THEN goal->'modRequirement'->'mods'
      ELSE '[]'::jsonb
    END,
    'allowOtherMods', COALESCE(goal->'modRequirement'->>'rule', 'any') <> 'exact'
  )
)
WHERE NOT (goal ? 'modRequirement') OR goal->'modRequirement' ? 'rule';
