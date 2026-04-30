-- supabase/migrations/20260430040000_add_family_members_device_health.sql
-- Add device_health JSONB to family_members so the parent app can pre-flight a
-- "주변 소리 듣기" request before sending FCM. Each child publishes its native
-- permission/setup snapshot to its own row (RLS fm_upd allows user_id = auth.uid()).
-- Parents read it through the existing fm_sel policy.
--
-- Snapshot shape (JSONB; NULL until child app reports):
--   { recordAudio: bool, postNotif: bool, fullScreen: bool, battery: bool,
--     channelOk: bool, locationOk: bool, lastReportedAt: ISO8601 }

BEGIN;

ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS device_health jsonb;

COMMENT ON COLUMN public.family_members.device_health IS
  'Child-reported native permission snapshot (recordAudio/postNotif/fullScreen/battery/channelOk/locationOk + lastReportedAt). NULL until child app publishes; parents read to pre-flight remote-listen requests.';

COMMIT;
