-- Down migration for 20260506010000_family_members_fm_upd_policy.sql
-- fm_upd 정책 제거. 정책 부재 시 family_members UPDATE 차단되어 device_health 갱신
-- 실패하지만 데이터 손실은 없으므로 안전한 rollback.

DROP POLICY IF EXISTS fm_upd ON public.family_members;
