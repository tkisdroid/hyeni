-- friend_playdate_cron — geo-fence exit 5분 자동 종료
-- Pre-req: pg_cron extension (force_ring_cron_enable에서 이미 활성화됨)

BEGIN;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'playdate_auto_end') THEN
    PERFORM cron.unschedule('playdate_auto_end');
  END IF;
END$cron$;

SELECT cron.schedule(
  'playdate_auto_end',
  '*/2 * * * *',
  $cron_body$
  UPDATE public.friend_playdate_sessions s
  SET stopped_at = now(), stop_reason = 'auto_geofence_exit'
  WHERE s.stopped_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.child_locations cl
      JOIN public.family_members fm ON fm.user_id = cl.user_id
      JOIN public.saved_places sp ON sp.family_id = fm.family_id
                                  AND sp.public_place_id = s.public_place_id
                                  AND sp.is_playdate_safe = true
      WHERE fm.family_id IN (s.family_a_id, s.family_b_id)
        AND fm.role = 'child'
        AND cl.updated_at > now() - interval '5 minutes'
        AND ST_DWithin(
              ST_MakePoint(cl.lng, cl.lat)::geography,
              ST_MakePoint((sp.location->>'lng')::float8, (sp.location->>'lat')::float8)::geography,
              150
            )
    );
  $cron_body$
);

COMMIT;
