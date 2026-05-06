-- 20260506000000_push_notify_cron_schedule.sql
--
-- Phase B: 매분 push-notify Edge Function을 호출해
--   - 15분 전 / 5분 전 / 시작 시각 일정 알림
--   - 일정 알림 dedup (push_sent)
-- 처리. push-notify는 body 없이 호출되면 handleCronNotification 분기로 들어가
-- events 테이블에서 오늘(필요 시 자정 직전엔 내일까지) 일정을 조회해 FCM/web push 발사.
--
-- push-notify는 D-A01 인증 게이트(--no-verify-jwt 배포여도 in-function getClaims)를
-- 갖고 있어 service_role JWT 없이는 401. 그래서 force_ring 패턴과 동일하게
-- Authorization header 에 service_role_key 를 주입해야 한다.
--
-- 전제:
--   - pg_cron 확장 (Supabase 모든 프로젝트에서 allow-list)
--   - pg_net 확장 (net.http_post)
--   - app.settings.supabase_url, app.settings.service_role_key vault.secrets
--     (force_ring_cron_enable 마이그레이션에서 사용한 동일 secret)
--
-- 이 cron이 없을 때 증상: 자녀 폰에 15분 전·5분 전·시작 알림이 오지 않음.
-- LocationService.fireLocalEventReminders 가 자녀 디바이스 자체에서 fallback
-- 알림을 발사해 1차 보호하지만, 부모 디바이스/웹 푸시 경로는 cron 의존이라
-- 본 마이그레이션이 정합 회복을 담당한다.

DO $cron$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not installed; skipping push-notify cron schedule';
    RETURN;
  END IF;

  -- 멱등 — 기존 schedule 있으면 제거 후 재등록
  PERFORM cron.unschedule('push_notify_cron')
   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'push_notify_cron');

  PERFORM cron.schedule(
    'push_notify_cron',
    '* * * * *',
    $job$
      SELECT net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/push-notify',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := '{}'::jsonb
      );
    $job$
  );
END$cron$;
