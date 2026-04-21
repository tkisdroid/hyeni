-- Phase 3 P1-4 (Stream A, D-A04) — DOWN migration
-- Reverses 20260421105507_pending_notifications_delivery_status.sql by
-- dropping the two observability columns added for push delivery tracking.
-- Uses IF EXISTS for idempotency; safe to re-run.

BEGIN;

ALTER TABLE public.pending_notifications
  DROP COLUMN IF EXISTS idempotency_key,
  DROP COLUMN IF EXISTS delivery_status;

COMMIT;
