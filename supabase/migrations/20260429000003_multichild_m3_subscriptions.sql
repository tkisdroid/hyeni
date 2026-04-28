-- supabase/migrations/20260429000003_multichild_m3_subscriptions.sql
-- M3: per-child subscriptions — Spec §5.1, §8, §13.1
-- Pairing: supabase/migrations/down/20260429000003_multichild_m3_subscriptions.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  qonversion_user_id text,
  qonversion_entitlement_id text,
  status text NOT NULL CHECK (status IN ('active','grace','expired','canceled')),
  expires_at timestamptz,
  product_id text NOT NULL,
  price_krw integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_child_unique UNIQUE (child_id)
);

CREATE INDEX IF NOT EXISTS subscriptions_family_idx ON public.subscriptions(family_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_active_idx
  ON public.subscriptions(status) WHERE status='active';

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DO $publication$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='subscriptions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions';
  END IF;
END$publication$;

INSERT INTO public.subscriptions (family_id, child_id, status, product_id, price_krw, expires_at)
SELECT
  fs.family_id,
  fm.id AS child_id,
  CASE WHEN fs.status='expired' THEN 'expired' ELSE 'active' END,
  'hyeni_child_slot_1',
  1500,
  fs.current_period_end
FROM public.family_subscription fs
JOIN public.family_members fm
  ON fm.family_id=fs.family_id AND fm.role='child' AND fm.child_order=1
WHERE fs.status IN ('active','trial','grace')
ON CONFLICT (child_id) DO NOTHING;

COMMIT;
