-- supabase/migrations/20260430030000_add_family_members_device_label.sql
-- Add device_label to family_members so parents can see "갤럭시 S25" instead
-- of "기기 1" on the child management card. Filled by the child app on mount
-- via UA-derived label (see src/lib/deviceInfo.js). RLS fm_upd policy
-- (user_id = auth.uid()) already allows the child to update its own row, so
-- no policy change is needed. Read-side: parents see it through the existing
-- fm_sel policy (same family_id).

BEGIN;

ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS device_label text;

COMMENT ON COLUMN public.family_members.device_label IS
  'Friendly device name (e.g., 갤럭시 S25) derived from User-Agent on the child device. NULL until child app reports.';

COMMIT;
