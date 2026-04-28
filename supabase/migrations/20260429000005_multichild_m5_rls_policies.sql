-- supabase/migrations/20260429000005_multichild_m5_rls_policies.sql
-- M5: RLS policies — Spec §7
-- Pairing: supabase/migrations/down/20260429000005_multichild_m5_rls_policies.sql

BEGIN;

-- subscriptions
DROP POLICY IF EXISTS subscriptions_select_family ON public.subscriptions;
CREATE POLICY subscriptions_select_family
  ON public.subscriptions FOR SELECT
  USING (family_id IN (
    SELECT family_id FROM public.family_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS subscriptions_insert_parent ON public.subscriptions;
CREATE POLICY subscriptions_insert_parent
  ON public.subscriptions FOR INSERT
  WITH CHECK (family_id IN (
    SELECT family_id FROM public.family_members
    WHERE user_id = auth.uid() AND role = 'parent'
  ));

DROP POLICY IF EXISTS subscriptions_update_parent ON public.subscriptions;
CREATE POLICY subscriptions_update_parent
  ON public.subscriptions FOR UPDATE
  USING (family_id IN (
    SELECT family_id FROM public.family_members
    WHERE user_id = auth.uid() AND role = 'parent'
  ));

-- events_children
DROP POLICY IF EXISTS events_children_select_family ON public.events_children;
CREATE POLICY events_children_select_family
  ON public.events_children FOR SELECT
  USING (event_id IN (
    SELECT id FROM public.events
    WHERE family_id IN (
      SELECT family_id FROM public.family_members WHERE user_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS events_children_modify_parent ON public.events_children;
CREATE POLICY events_children_modify_parent
  ON public.events_children FOR ALL
  USING (event_id IN (
    SELECT id FROM public.events
    WHERE family_id IN (
      SELECT family_id FROM public.family_members
      WHERE user_id = auth.uid() AND role = 'parent'
    )
  ));

-- child_device_stats: per-child subscription gate
DO $cds_gate$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='child_device_stats'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS child_device_stats_select_subscriber ON public.child_device_stats';
    EXECUTE $policy$
      CREATE POLICY child_device_stats_select_subscriber
        ON public.child_device_stats FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.subscriptions s
            WHERE s.child_id = child_device_stats.child_id AND s.status = 'active'
          )
          AND child_id IN (
            SELECT id FROM public.family_members
            WHERE family_id IN (
              SELECT family_id FROM public.family_members WHERE user_id = auth.uid()
            )
          )
        )
    $policy$;
  END IF;
END$cds_gate$;

COMMIT;
