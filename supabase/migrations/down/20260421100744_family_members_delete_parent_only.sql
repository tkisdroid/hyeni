-- DOWN: Phase 2 Stream C Wave 2 rollback for family_members fm_del tightening
--
-- Restores the pre-Phase-2 permissive fm_del policy captured via pg_policies on
-- 2026-04-21 10:07 UTC (authoritative; cross-checked against Phase 1 baseline
-- `.planning/research/baselines/pg-policies-20260421.csv` row 34-36 — IDENTICAL body).
--
-- This rollback re-enables the child self-DELETE branch (`user_id = auth.uid()`).
-- Intended ONLY for emergency rollback if the tightened policy breaks a legitimate
-- flow. If triggered, immediately re-evaluate PAIR-03 mitigation strategy.
--
-- Also drops the `is_family_parent(uuid)` SECURITY DEFINER helper created by the
-- up migration (added to fix self-reference recursion; no longer needed under
-- the permissive policy).

BEGIN;
SET LOCAL lock_timeout = '5s';

DROP POLICY IF EXISTS "fm_del" ON public.family_members;

-- Restored policy body (byte-exact from pre-Phase-2 capture; roles={public},
-- which is Postgres default when CREATE POLICY omits the `TO <role>` clause).
CREATE POLICY "fm_del" ON public.family_members
  FOR DELETE
  USING (
    (user_id = auth.uid())
    OR (family_id IN (
      SELECT families.id
        FROM families
       WHERE (families.parent_id = auth.uid())
    ))
  );

-- Drop the helper added by the up migration.
DROP FUNCTION IF EXISTS public.is_family_parent(uuid);

COMMIT;
