-- Phase 3 P1-4 (Stream A, D-A04) — pending_notifications schema extension
-- Adds observability columns for push delivery tracking:
--   · delivery_status jsonb   — per-row record of {webSent, fcmSent, recipients, ...}
--   · idempotency_key uuid    — FK to push_idempotency so dedup trails back to
--                               the original queued notification
-- Both columns are NULLABLE (backward compatible; existing rows unaffected).
-- Paired down migration removes them symmetrically.

BEGIN;

ALTER TABLE public.pending_notifications
  ADD COLUMN IF NOT EXISTS delivery_status jsonb,
  ADD COLUMN IF NOT EXISTS idempotency_key uuid
    REFERENCES public.push_idempotency(key) ON DELETE SET NULL;

COMMIT;
