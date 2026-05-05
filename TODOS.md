# TODOS

## 2026-05-05 — PlaceManager 내부 form/sheet 인라인 스타일 → Wanted DS 마이그레이션

**Priority:** P2

**What:** PlaceManager 내부 3개 form/sheet의 인라인 `style={{}}` 속성을 Wanted DS 토큰 클래스(`.input`, `.btn-primary`, `.sheet`)로 교체.

**Why:** CLAUDE.md hard rule #6 (single source per component — 인라인 + className 중복 금지) 완전 준수. 다크 모드 + 6개 테마 픽커가 form 안쪽에서도 자동으로 일관되게 작동. 현재 인라인 스타일은 `var(--bg-muted)`, `var(--theme-accent)` 같은 토큰을 쓰지만 hardcoded `padding: "12px 14px"`, `borderRadius: 14` 같은 magic value도 섞여 있음.

**Pros:**
- 토큰 시스템 100% 일관성 (테마 변경 시 form 안쪽까지 자동 반영)
- 향후 form 위젯 변경 시 단일 클래스 수정만으로 전파
- 다크 모드·접근성 자동 확보

**Cons:**
- 별도 PR 자체 분량 30분 (CC) / ~2시간 (사람) 추가
- 회귀 테스트 부담 (form 동작 보존 확인 필요)

**Context:** 2026-05-05 `/plan-eng-review` 세션에서 발견. 메인 plan은 새 sub-component(AcademyCard/DangerCard/SavedPlacesSection)만 `.card` 패턴 적용으로 결정. form/sheet은 Wanted DS 컴포넌트 클래스가 아직 단단히 정착 안 됐고, 이번 UX 재구조화 PR과 분리하는 게 코드 리뷰 부담을 낮춤. 영향 라인:
- 학원 form: src/App.jsx:3514-3598
- 조심할 곳 form: src/App.jsx:3634-3698
- 자주가는 장소 sheet: src/App.jsx:3601-3631

**Depends on:** 이번 sub-component 분리 PR (AcademyCard/DangerCard/SavedPlacesSection) 완료 후 진행. form/sheet도 sub-component로 분리할지 같이 결정.
