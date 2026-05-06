-- 20260506010000_family_members_fm_upd_policy.sql
--
-- Phase D Fix #2: family_members.device_health 갱신 실패 회복.
--
-- 증상: DeviceStatusReporter.publish() 가 PATCH /rest/v1/family_members?id=eq.<id>
--       로 device_health 컬럼을 갱신하지만 RLS 가 거부 (row count = 0, 에러는 안 남)
--       → 부모 화면의 안전지표가 영영 stale.
--
-- 근본 원인: family_members 테이블에 SELECT(fm_sel) / INSERT(fm_ins) /
--           DELETE(fm_del) 정책만 존재. UPDATE 정책 부재.
--
-- 마이그레이션 20260430020000_set_family_member_photo_url_by_id.sql 코멘트는
-- "fm_upd is (user_id = auth.uid())" 라고 가정하고 있었으나 실제 CREATE POLICY
-- 없음. 본 마이그레이션이 정합 회복.
--
-- 정책: 자기 자신의 row 만 update 가능 (user_id = auth.uid()).
-- 부모가 자녀 row 의 photo_url/profile 등을 갱신하는 경로는 별도 SECURITY
-- DEFINER RPC (set_family_member_photo_url_by_id, set_family_member_profile_by_id)
-- 로 우회되어 본 정책과 충돌하지 않는다.

BEGIN;

DROP POLICY IF EXISTS fm_upd ON public.family_members;

CREATE POLICY fm_upd ON public.family_members
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY fm_upd ON public.family_members IS
  'Members may update their own row only (e.g., DeviceStatusReporter pushing device_health snapshot). Cross-row updates by parents go through SECURITY DEFINER RPCs.';

COMMIT;
