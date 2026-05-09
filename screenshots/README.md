# 혜니캘린더 스크린샷

## 폴더 구조

```
screenshots/
├── captured/   ← 2026-05-07 dev server (localhost:5174) 에서 새로 캡처 (390×844, fullPage)
└── legacy/     ← 작업 기록용 작업별 스냅샷 (루트에 흩어져 있던 21개 PNG)
```

---

## captured/ — 2026-05-07 새로 캡처 (7장)

인증 / 부모 페어링 코드가 필요 없는 진입 단계 화면만 자동 캡처했습니다.
viewport 390×844 (iPhone 14 size), Vite dev server, Playwright fullPage.

| # | 파일 | 화면 | 비고 |
|---|---|---|---|
| 01 | `01-role-select.png` | RoleSelectScreen (학부모/아이) | 첫 진입 화면 |
| 02 | `02-parent-auth.png` | ParentAuthScreen (소셜 로그인 + ID/PW 토글) | 학부모 로그인 |
| 03 | `03-parent-auth-idpw-expanded.png` | ParentAuthScreen — ID/PW 폼 펼친 상태 | |
| 04 | `04-parent-signup.png` | ParentSignupScreen | 학부모 가입 (이름/ID/PW/역할/생년월일/전화) |
| 05 | `05-parent-signup-birth-picker.png` | ParentSignupScreen — 생년월일 picker 모달 | react-mobile-picker 기반 |
| 06 | `06-role-select-with-resume.png` | RoleSelectScreen — 지난 사용 이력 배너 표시 | localStorage hint 동작 |
| 07 | `07-child-pair-input.png` | ChildPairInputScreen | KID-XXXXXXXX 코드 입력 |

## 미캡처 화면 (인증/실데이터 필요)

다음 화면은 Supabase 인증 또는 실제 부모-자녀 페어링이 필요해 자동 캡처에서 제외됐습니다.
필요하면 실제 계정으로 진입한 뒤 수동 캡처하거나, Supabase test seed + Playwright login 픽스처를 만들어 자동화할 수 있습니다.

- ParentSetupScreen (가입 직후 자녀 등록 위저드)
- 부모 홈 / 캘린더 / 가족 / 메모 / 장소 / 설정
- ChildDetailScreen (자녀별 상세)
- ChildSettingsScreen, ParentSettingsScreen, PlaceManagerScreen
- 자녀 모드 홈 / 일정 / 스티커북 / 안전 SOS

`legacy/` 의 review-04 ~ review-14 는 과거 세션에서 인증된 상태로 캡처한 위 화면들의 시점 기록입니다.

---

## legacy/ — 작업별 스냅샷 (21장)

루트에 흩어져 있던 PNG들을 보존용으로 모아둔 폴더. 각 시리즈는 특정 작업/리뷰 시점의 before/after 기록입니다.

### final-* (4장) — 디자인 마이그레이션 최종 결과
- `final-01-role-select.png`, `final-03-role-select.png`
- `final-02-logout-confirm.png`
- `final-04-login.png`

### review-* (14장) — 단계별 리뷰 캡처
- `review-01-initial.png` ~ `review-03-after-login.png` — 초기/로그인 흐름
- `review-04-home.png` ~ `review-06-child-detail.png` — 홈 / 캘린더 / 자녀 상세
- `review-07~09-after-batch1.png` — Batch 1 마이그레이션 후
- `review-10~11-after-batch2.png` — Batch 2 마이그레이션 후
- `review-12-places.png`, `review-13-family.png`, `review-14-memo.png` — 부가 화면

### hyeni-* (3장) — 테마/색상 작업 시점
- `hyeni-current-role-screen.png`
- `hyeni-current-blue-theme-role-screen.png`
- `hyeni-blue-theme-after-status-width-fix.png`
