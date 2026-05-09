# Role: Lead SDET, Modern UI/UX Architect & Mobile Systems Expert
# Task: hyeni calendar 실물 기기 통합 E2E 테스트, Modern UI 리팩토링 및 최종 빌드 완성

현재 워크스테이션에 ADB로 연결된 두 대의 안드로이드 기기(기기 A: Galaxy-부모용, 기기 B: Motorola-아이용)를 제어하여 앱의 모든 기능을 테스트하고 코드를 수정하라.

**[CRITICAL EXECUTION PROTOCOL: NEVER STOP & AUTO-VERIFY]**
1. **절대 종료 금지:** 아래 명시된 모든 체크리스트와 품질 기준이 100% "완벽(Perfect)" 상태에 도달하기 전까지는 어떠한 이유로든 절대로 작업을 종료하거나 멈추지 마라.
2. **자율 수정 및 자동 승인 (Self-Approval):** 테스트 및 수정 과정 중 발생하는 모든 승인 요청은 당신(Claude)이 스스로 최적의 '추천 사항'을 채택하고 즉각적으로 **자동 승인(Auto-approve)**하여 무한 루프를 유지하라.
3. **디자인-기능 회귀 테스트 (Mandatory Regression Check):** UI 스타일이나 레이아웃 코드를 수정한 후에는, 반드시 해당 컴포넌트와 연결된 기능을 재실행(Re-run)하여 기능적 결함이 발생하지 않았는지 즉시 검증하라.

---

### Phase 0: Resilience & Policy (안전성 및 정책 준수)
- [ ] **Power-Off Resilience:** 배터리 임계값(3% 이하) 또는 시스템 종료 감지 시, 마지막 위치 push 및 부모 알림 전송이 완벽한가?
- [ ] **Auto-Resume on Boot:** 재부팅 시 사용자 개입 없이 백그라운드 서비스가 즉시 재시작되는가?
- [ ] **Play Store Compliance:** 백그라운드 위치 권한 고지 UI 및 배터리 최적화 제외 안내가 정책에 부합하는가?

### Phase 1: Modern UI/UX & Visual Integrity (디자인 고도화 및 정밀 검증)
- [ ] **Visual Balance & Alignment:**
    - 모든 버튼 내 텍스트가 꽉 차거나 잘리지 않도록 적절한 **Internal Padding**을 확보하라.
    - 버튼, 카드, 리스트 아이템 내의 텍스트와 아이콘 정렬이 **수직/수평 중앙**에 정확히 위치하는지 검증하고 수정하라.
    - 텍스트 길이에 따라 레이아웃이 무너지지 않도록 **Ellipsis 처리** 또는 **유연한 높이 조절** 로직을 적용하라.
- [ ] **Design System:** 일관된 컬러 팔레트, 8dp 단위 스페이싱, 타이포그래피 계층을 정의하고 앱 전체에 강제 적용하라.
- [ ] **Modern Look & Feel:** 불필요한 테두리 제거, 과감한 여백(Whitespace) 활용, 현대적인 곡률(Rounded Corner)을 적용하여 세련된 느낌을 구현하라.
- [ ] **Safe Area:** 갤럭시와 모토로라 각각의 노치/상태표시줄 디자인에서 UI 가림 현상을 완벽히 해결하라.

### Phase 2: User Journey & Onboarding (흐름 및 권한 가이드)
- [ ] **E2E Flow:** 가입 -> 연동 -> 사용까지의 흐름에서 단 한 번의 에러나 논리적 끊김이 없는가?
- [ ] **권한 가이드:** 필수 권한 설정 유도가 친절한가? 미설정 시 설정 화면 이동 링크가 정상 작동하는가?

### Phase 3: Core Logic & Real-time Sync (핵심 기능 및 데이터 격리)
- [ ] **즉각적 데이터 렌더링:** 앱 실행 시(Cold Start) 최신 위치와 일정이 딜레이 없이 표시되는가?
- [ ] **전방위 실시간 동기화:** 일정, 프로필, 위치 정보가 모든 기기에서 실시간으로 연동되는가?
- [ ] **Case 2 (부모2/아이2) 엄격 격리:** 다자녀 환경에서 아이별 데이터가 절대 섞이지 않는가? SOS 및 위치 정보가 정확한 프로필에만 매칭되는가?

### Phase 4: Monetization & Micro-interactions (사용자 경험 완성)
- [ ] **티어 구분:** 무료/구독 티어 간 권한 분리 및 세련된 구독 유도 문구가 적절한 시점에 노출되는가?
- [ ] **Micro-interactions:** 페이지 전환 및 버튼 클릭 시 부동운 애니메이션과 로딩 피드백(스켈레톤 UI 등)이 적용되었는가?

---

### End Condition (Definition of Perfect)
1. ADB Logcat 상에서 에러나 경고가 전무할 것.
2. 실물 기기 간 데이터 레이턴시 최적화 및 수정 사항에 대한 회귀 테스트 완료.
3. **버튼 내 텍스트 정렬, 여백, 폰트 밸런스 등 시각적 결함이 0%일 것.**
4. 당신(Claude)이 판단하기에 글로벌 Top-tier 수준의 완결성을 갖추었을 때만 "Production Ready"를 선언하고 종료하라.