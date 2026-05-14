-- Atomic write of an event row + its events_children M:N links.
-- Replaces the 3-call client dance (events upsert → events_children delete →
-- events_children insert) that produced data-loss windows when a rollback
-- needed to upsert a stale priorEventRow snapshot (see santa-loop e9afa89 #3).
--
-- LANGUAGE plpgsql + SECURITY INVOKER (default) — the caller's RLS continues
-- to authorize each statement, so ev_ins / ev_upd / events_children_modify_parent
-- remain the single source of truth for who can write what.
--
-- Optimistic concurrency: when p_expected_updated_at is non-null on an edit
-- path, we SELECT FOR UPDATE the row and compare. Mismatch raises SQLSTATE
-- 40001 (serialization_failure) so callers can surface a "the row moved on"
-- conflict instead of silently overwriting.

BEGIN;

CREATE OR REPLACE FUNCTION public.save_event_with_children(
  p_event jsonb,
  p_child_ids uuid[],
  p_family_all boolean,
  p_expected_updated_at timestamptz DEFAULT NULL
)
RETURNS public.events
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_saved public.events;
  v_event_id uuid := (p_event->>'id')::uuid;
  v_current_updated_at timestamptz;
BEGIN
  -- 0. Optimistic concurrency: only when caller passes an expected timestamp,
  -- and only meaningful for the edit path. We lock the row to serialize the
  -- check against concurrent UPDATEs.
  IF p_expected_updated_at IS NOT NULL AND v_event_id IS NOT NULL THEN
    SELECT updated_at INTO v_current_updated_at
      FROM public.events
     WHERE id = v_event_id
     FOR UPDATE;
    -- If the row vanished (FOUND=false) we let the upsert path INSERT it
    -- afresh — no concurrent edit to conflict with.
    IF FOUND AND v_current_updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'concurrent_modification: events.updated_at moved from % to %',
        p_expected_updated_at, v_current_updated_at
      USING ERRCODE = '40001';
    END IF;
  END IF;

  -- 1. Atomic upsert of the events row.
  -- jsonb_populate_record fills every public.events column from p_event.
  -- ON CONFLICT covers the edit path; INSERT covers the add path.
  -- Note: id is the conflict key. created_at is auto-default (first-insert
  -- only). created_by is intentionally NOT in the UPDATE SET — creator
  -- attribution must survive edits by other family members.
  INSERT INTO public.events
  SELECT * FROM jsonb_populate_record(NULL::public.events, p_event)
  ON CONFLICT (id) DO UPDATE SET
    family_id        = EXCLUDED.family_id,
    date_key         = EXCLUDED.date_key,
    title            = EXCLUDED.title,
    time             = EXCLUDED.time,
    category         = EXCLUDED.category,
    emoji            = EXCLUDED.emoji,
    color            = EXCLUDED.color,
    bg               = EXCLUDED.bg,
    memo             = EXCLUDED.memo,
    location         = EXCLUDED.location,
    notif_override   = EXCLUDED.notif_override,
    end_time         = EXCLUDED.end_time,
    is_family_event  = EXCLUDED.is_family_event,
    updated_at       = now()
  RETURNING * INTO v_saved;

  -- 2. Rewrite child links: delete-then-insert in the same tx.
  DELETE FROM public.events_children WHERE event_id = v_saved.id;

  -- 3. Insert the new links only when not family-all and we have children.
  IF NOT COALESCE(p_family_all, false)
     AND p_child_ids IS NOT NULL
     AND array_length(p_child_ids, 1) IS NOT NULL THEN
    INSERT INTO public.events_children (event_id, child_id)
    SELECT v_saved.id, unnest(p_child_ids);
  END IF;

  RETURN v_saved;
END;
$$;

REVOKE ALL ON FUNCTION public.save_event_with_children(jsonb, uuid[], boolean, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_event_with_children(jsonb, uuid[], boolean, timestamptz) TO authenticated;

COMMIT;
