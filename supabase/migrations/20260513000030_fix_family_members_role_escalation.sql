-- 20260513000030_fix_family_members_role_escalation.sql
--
-- QA P1 (Agent 03 F1): family_members.role self-escalation.
--
-- Symptom: fm_upd policy (20260506010000) only checks user_id = auth.uid().
-- A child PATCHing /rest/v1/family_members?id=eq.<self> {"role":"parent"}
-- succeeds. Self-escalation grants subscription write, force_ring,
-- child-photo storage, daily_supplies write, and add_sticker parent branch.
--
-- Root cause:
--   1) family_members.role text column has no CHECK constraint (free value).
--   2) fm_upd policy has no column-level restriction -> role mutation allowed.
--
-- Fix (defense in depth):
--   1) Add CHECK constraint on role: parent / child / co_parent (real values
--      today are 'parent' and 'child'; 'co_parent' allowed for forward
--      compatibility per 20260429120000 design notes).
--   2) BEFORE UPDATE trigger blocking self role change:
--      auth.uid() = OLD.user_id AND OLD.role != NEW.role -> reject.
--      service_role / system (auth.uid() NULL) passes through.
--   3) Normal paths unaffected:
--      - DeviceStatusReporter (device_health PATCH) -> role unchanged -> pass.
--      - set_family_member_photo_url_by_id (SECURITY DEFINER) -> role unchanged.
--      - join_family / join_family_as_parent (SECURITY DEFINER) -> INSERT or
--        modifies a different user row -> trigger passes.
--
-- Pairing: supabase/migrations/down/20260513000030_fix_family_members_role_escalation.sql

BEGIN;

ALTER TABLE public.family_members
  DROP CONSTRAINT IF EXISTS family_members_role_check;

ALTER TABLE public.family_members
  ADD CONSTRAINT family_members_role_check
  CHECK (role IS NULL OR role IN ('parent', 'child', 'co_parent'));

CREATE OR REPLACE FUNCTION public.family_members_prevent_role_self_escalation()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := (SELECT auth.uid());
BEGIN
  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  IF v_caller IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_caller = OLD.user_id THEN
    RAISE EXCEPTION 'role_self_modification_forbidden'
      USING ERRCODE = 'P0001',
            HINT = 'role can only be changed by parent via dedicated RPC';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_family_members_prevent_role_self_escalation
  ON public.family_members;

CREATE TRIGGER trg_family_members_prevent_role_self_escalation
  BEFORE UPDATE OF role ON public.family_members
  FOR EACH ROW
  EXECUTE FUNCTION public.family_members_prevent_role_self_escalation();

COMMENT ON FUNCTION public.family_members_prevent_role_self_escalation() IS
  'QA P1: blocks self role escalation. Authenticated user PATCHing their own family_members row cannot change role. SECURITY DEFINER RPCs that do not modify role are unaffected.';

COMMIT;
