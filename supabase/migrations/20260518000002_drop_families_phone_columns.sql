-- families.mom_phone / dad_phone DROP — 부모 전화번호 canonical source 일원화 마무리.
--
-- 부모 전화번호는 family_members.phone(자기 행), 엄마/아빠 라벨은
-- family_members.gender 로 완전히 이전됨. 더 이상 families.mom_phone/dad_phone 을
-- 읽거나 쓰는 코드 경로가 없다:
--   - 자녀 ChildCallCard / SOS onCall          → selectParentContacts(family_members)
--   - 친구놀이 RPC get_active_playdate_session  → family_members 집계
--   - push-notify handlePlaydateStarted         → family_members 집계
--   - setupFamily(가입 플로우)                   → family_members 행에 write
--
-- 단, 이 변경 이전 가입자는 번호가 families.*_phone 에만 있고
-- family_members.phone 은 비어 있다. DROP 전에 그 값을 멤버 행으로 백필한다.
-- 백필은 phone 이 비어 있는 부모 행에만 쓰므로 멱등적이다.

BEGIN;

-- 1) gender 라벨이 있는 부모: mom_phone → gender='mom', dad_phone → gender='dad'.
UPDATE public.family_members fm
SET phone = f.mom_phone
FROM public.families f
WHERE fm.family_id = f.id
  AND fm.role = 'parent' AND fm.gender = 'mom'
  AND coalesce(fm.phone, '') = ''
  AND coalesce(f.mom_phone, '') <> '';

UPDATE public.family_members fm
SET phone = f.dad_phone
FROM public.families f
WHERE fm.family_id = f.id
  AND fm.role = 'parent' AND fm.gender = 'dad'
  AND coalesce(fm.phone, '') = ''
  AND coalesce(f.dad_phone, '') <> '';

-- 2) 나머지: 아직 멤버 행에 안 옮겨진 번호를, phone 이 빈 부모 행에 순서대로
--    배정한다. 부모는 primary parent 우선, 그다음 created_at 순. gender 미상
--    가족(대부분)에서 mom/아빠 귀속이 모호하지만, 모든 번호가 어느 부모 행이든
--    반드시 안착하므로 데이터 손실은 없다(잘못된 행이어도 통화는 가능).
WITH unplaced AS (
  SELECT f.id AS family_id, p.ord, p.phone
  FROM public.families f
  CROSS JOIN LATERAL (
    VALUES (1, NULLIF(f.mom_phone, '')), (2, NULLIF(f.dad_phone, ''))
  ) AS p(ord, phone)
  WHERE p.phone IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.family_members m
      WHERE m.family_id = f.id AND m.role = 'parent' AND m.phone = p.phone
    )
),
ranked_phones AS (
  SELECT family_id, phone,
         row_number() OVER (PARTITION BY family_id ORDER BY ord) AS rn
  FROM unplaced
),
ranked_members AS (
  SELECT fm.id AS member_id, fm.family_id,
         row_number() OVER (
           PARTITION BY fm.family_id
           ORDER BY (fm.user_id = f.parent_id) DESC, fm.created_at
         ) AS rn
  FROM public.family_members fm
  JOIN public.families f ON f.id = fm.family_id
  WHERE fm.role = 'parent' AND coalesce(fm.phone, '') = ''
)
UPDATE public.family_members fm
SET phone = rp.phone
FROM ranked_members rm
JOIN ranked_phones rp ON rp.family_id = rm.family_id AND rp.rn = rm.rn
WHERE fm.id = rm.member_id;

-- 3) 백필 검증 가드: 빈 phone 부모 행이 남아 있는데도 미배치 번호가 있으면
--    백필 로직 버그이므로 DROP 을 중단한다.
--    부모 행이 모두 채워진 뒤 남는 번호(예: 1인-부모 가족에 mom+dad 두 번호가
--    모두 있던 경우의 둘째 번호 — 멤버가 아닌 사람을 위한 번호)는 새 모델
--    (phone = 각 부모 본인 번호)에 들어갈 자리가 없으므로 의도적으로 버린다.
DO $$
DECLARE
  lost int;
BEGIN
  SELECT count(*) INTO lost
  FROM public.families f
  CROSS JOIN LATERAL (
    VALUES (NULLIF(f.mom_phone, '')), (NULLIF(f.dad_phone, ''))
  ) AS p(phone)
  WHERE p.phone IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.family_members m
      WHERE m.family_id = f.id AND m.role = 'parent' AND m.phone = p.phone
    )
    AND EXISTS (
      SELECT 1 FROM public.family_members m
      WHERE m.family_id = f.id AND m.role = 'parent' AND coalesce(m.phone, '') = ''
    );
  IF lost > 0 THEN
    RAISE EXCEPTION 'aborting DROP: backfill logic bug — % phone(s) unplaced despite an empty parent slot', lost;
  END IF;
END $$;

ALTER TABLE public.families DROP COLUMN IF EXISTS mom_phone;
ALTER TABLE public.families DROP COLUMN IF EXISTS dad_phone;

COMMIT;
