-- DOWN: Phase 2 Stream C Wave 1 rollback
-- Restores pre-Phase-2 join_family definition; drops regenerate_pair_code;
-- drops pair_code_expires_at column.
--
-- The pre-Phase-2 join_family body below was captured via
--   SELECT pg_get_functiondef('public.join_family(text,uuid,text)'::regprocedure);
-- on 2026-04-21 09:57 UTC and is also preserved at
--   .planning/phases/02-unblock-core-push-gateway-realtime-pair-security/join_family-baseline.sql

BEGIN;

-- 1. Drop regenerate_pair_code
DROP FUNCTION IF EXISTS public.regenerate_pair_code(uuid);

-- 2. Restore previous join_family (byte-accurate capture via pg_get_functiondef pre-migration)
CREATE OR REPLACE FUNCTION public.join_family(p_pair_code text, p_user_id uuid, p_name text DEFAULT '아이'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_family_id uuid;
  v_attempt_count integer;
BEGIN
  SELECT COUNT(*) INTO v_attempt_count
    FROM public.pair_attempts
   WHERE user_id = p_user_id
     AND attempted_at > now() - interval '1 hour';

  IF v_attempt_count >= 10 THEN
    RAISE EXCEPTION 'Too many attempts. Try again later.';
  END IF;

  INSERT INTO public.pair_attempts (user_id) VALUES (p_user_id);

  SELECT id INTO v_family_id
    FROM public.families
   WHERE pair_code = upper(trim(p_pair_code));

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'Invalid pair code';
  END IF;

  INSERT INTO public.family_members (family_id, user_id, role, name)
  VALUES (v_family_id, p_user_id, 'child', p_name)
  ON CONFLICT (family_id, user_id)
  DO UPDATE SET name = EXCLUDED.name;

  RETURN v_family_id;
END;
$function$;

-- Re-grant (pg_get_functiondef does not include GRANTs — re-apply to match pre-state)
GRANT EXECUTE ON FUNCTION public.join_family(text, uuid, text) TO authenticated, anon;

-- 3. Drop pair_code_expires_at column (data loss acceptable — grandfathered rows
--    were NULL; new rows with non-NULL expire_at lose TTL, but pair_code still valid
--    until parent rotates — same behavior as pre-Phase-2).
ALTER TABLE public.families DROP COLUMN IF EXISTS pair_code_expires_at;

COMMIT;
