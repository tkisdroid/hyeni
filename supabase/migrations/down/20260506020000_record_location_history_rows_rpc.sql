-- Down migration for 20260506020000_record_location_history_rows_rpc.sql
-- RPC 제거. 호출자(LocationService)는 RPC 부재 시 직접 INSERT 경로로 폴백
-- (이후 commit 의 클라이언트 변경에서 try-catch 처리). 데이터 손실 없음.

DROP FUNCTION IF EXISTS public.record_location_history_rows(jsonb);
