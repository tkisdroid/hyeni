-- supabase/migrations/down/20260429000005_multichild_m5_rls_policies.sql
BEGIN;

DROP POLICY IF EXISTS subscriptions_select_family ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_insert_parent ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_update_parent ON public.subscriptions;
DROP POLICY IF EXISTS events_children_select_family ON public.events_children;
DROP POLICY IF EXISTS events_children_modify_parent ON public.events_children;

DO $cds_revert$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='child_device_stats'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS child_device_stats_select_subscriber ON public.child_device_stats';
    -- NOTE: prior policy must be restored from .planning/snapshots/2026-04-29-pg_policies-pre-m5.txt
  END IF;
END$cds_revert$;

COMMIT;
