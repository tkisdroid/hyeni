-- Reverse of 20260513000020_fix_get_pending_notifications_auth.sql
--
-- WARNING: applying this restores anon-callable + no-authz state. Do NOT apply in production.

BEGIN;

DROP FUNCTION IF EXISTS public.get_pending_notifications(uuid);

CREATE FUNCTION public.get_pending_notifications(p_family_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  body text,
  data jsonb,
  created_at timestamptz
) AS $$
  SELECT pn.id, pn.title, pn.body, pn.data, pn.created_at
  FROM pending_notifications pn
  WHERE pn.family_id = p_family_id
    AND pn.delivered = false
    AND COALESCE(pn.expires_at, now() + interval '1 day') > now()
  ORDER BY pn.created_at ASC
  LIMIT 20;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_pending_notifications(uuid) TO anon, authenticated, service_role;

COMMIT;
