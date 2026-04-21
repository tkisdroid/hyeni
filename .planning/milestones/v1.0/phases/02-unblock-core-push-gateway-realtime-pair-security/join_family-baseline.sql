-- Production baseline of public.join_family(text,uuid,text), extracted via
-- pg_get_functiondef on 2026-04-21 before Phase 2 Plan 02-03 applied.
-- Used as byte-accurate rollback anchor for the paired down migration.
--
-- Drift vs archived supabase/archive/_deprecated_fix-sync-final.sql:248-276:
--   1. Adds `upper(trim(p_pair_code))` normalization in WHERE clause
--   2. Adds `SET search_path = public` configuration on the function
--   3. Uses `EXCLUDED.name` in ON CONFLICT instead of `p_name`
-- All three are pure refinements of the archived pattern (no behavioral
-- regression). The prod-extracted body below is authoritative.

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
