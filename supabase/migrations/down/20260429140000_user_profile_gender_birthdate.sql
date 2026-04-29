-- Reverse of 20260429140000_user_profile_gender_birthdate.sql.
-- Drops the gender CHECK constraint and the two added columns. Idempotent.
--
-- Verbatim user instruction:
-- "task 7 에서는 회원가입시 다음의 정보를 필수로 받습니다.
--  이름 성별(엄마/아빠) 생년월일 전화번호(인증)"

BEGIN;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_gender_check;

ALTER TABLE public.user_profiles
  DROP COLUMN IF EXISTS gender,
  DROP COLUMN IF EXISTS birthdate;

COMMIT;
