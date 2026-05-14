-- Reverse of 20260513000030_fix_family_members_role_escalation.sql
--
-- WARNING: applying this restores the role free-text + self-escalation state.
-- Do NOT apply in production.

BEGIN;

DROP TRIGGER IF EXISTS trg_family_members_prevent_role_self_escalation
  ON public.family_members;

DROP FUNCTION IF EXISTS public.family_members_prevent_role_self_escalation();

ALTER TABLE public.family_members
  DROP CONSTRAINT IF EXISTS family_members_role_check;

COMMIT;
