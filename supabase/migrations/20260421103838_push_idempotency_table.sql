-- Phase 2 Stream A (PUSH-01 prep for Phase 3 P1-4) — push_idempotency dedup table
-- Schema only; Phase 2 does NOT wire push-notify into this table.
-- Phase 3 P1-4 will add the INSERT + unique-violation dedup path.
-- Schema per CONTEXT.md D-A05 + PLAN 02-01 Task 1.

BEGIN;

CREATE TABLE IF NOT EXISTS public.push_idempotency (
  key uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  first_sent_at timestamptz,
  family_id uuid,
  action text
);

CREATE INDEX IF NOT EXISTS idx_push_idempotency_created_at
  ON public.push_idempotency (created_at);

COMMIT;
