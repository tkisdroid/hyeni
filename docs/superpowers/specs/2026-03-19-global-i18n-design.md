# 혜니캘린더 글로벌 다국어 버전 설계

> 한국 전용 앱을 영어/일본어/중국어 지원 글로벌 버전으로 전환하는 설계 문서

## 1. 개요

### 목표
- 현재 한국어 하드코딩(234개 문자열) 앱을 4개 언어(한/영/일/중) 지원으로 확장
- 한국 특화 요소(카카오맵, 카카오 로그인, "학원" 용어)를 글로벌 대응으로 전환
- 5,609줄 모놀리식 App.jsx를 기능별 컴포넌트로 분리

### 전제 조건
- 현재 `main` 브랜치(한국 버전)는 건드리지 않음
- `global` 브랜치에서 파일 복사 후 모든 작업 진행
- Android만 대상 (iOS는 이후 별도 프로젝트)
- 브랜드명 "혜니캘린더"는 전 언어 동일 유지
- RTL 언어(아랍어, 히브리어 등)는 이번 버전 범위 외. `AndroidManifest.xml`의 `supportsRtl="true"` 속성은 유지하되 RTL 레이아웃 테스트는 수행하지 않음

### 결정 사항 요약

| 항목 | 결정 |
|------|------|
| 타겟 시장 | 영어 + 일본어 + 중국어 (동아시아 중심) |
| 브랜드명 | "혜니캘린더" 전 언어 유지 |
| 번역 방식 | AI 번역 (Claude) 후 직접 검수 |
| 메시지 톤 | 귀여운 톤 유지 (이모지 포함) |
| 카테고리 | 프리셋 제거, 사용자 직접 생성 구조 |
| 용어 전환 | "학원" → "스케줄" |
| 인증 | Google + Apple 추가 (카카오는 한국어만) |
| 지도 | 카카오맵 → Google Maps 단일화 |
| 컴포넌트 | App.jsx 분리 후 i18n 적용 (2단계) |
| 브랜치 전략 | `global` 브랜치, 완성 후 `main` 머지 |

---

## 2. i18n 인프라

### 라이브러리

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `i18next` | `~23.11` | i18n 코어 |
| `react-i18next` | `~15.4` | React 바인딩 |
| `i18next-browser-languagedetector` | `~8.0` | 자동 언어 감지 |
| `@capacitor/device` | `~6.0` | Android 시스템 로캘 감지 |

```
npm install i18next@~23.11 react-i18next@~15.4 i18next-browser-languagedetector@~8.0 @capacitor/device@~6.0
```

> **버전 관리**: tilde(`~`) 범위를 사용하여 patch 업데이트만 허용. 설치 후 `package-lock.json`을 반드시 커밋하여 빌드 재현성 보장.

### 번역 파일 구조

```
src/i18n/
├── index.js              # i18next 초기화
├── ko/
│   ├── common.json       # 공통 UI (버튼, 상태)
│   ├── auth.json         # 로그인, 가족 설정
│   ├── calendar.json     # 일정, 스케줄 관리
│   ├── location.json     # 위치추적, 길안내, 위험지역
│   ├── notification.json # 알림 메시지, 설정
│   └── memo.json         # 메모, 칭찬스티커, 꾹
├── en/                   # 영어 (동일 구조)
├── ja/                   # 일본어 (동일 구조)
└── zh/                   # 중국어 간체 (동일 구조)
```

### 네임스페이스별 예상 키 수

| 네임스페이스 | 대상 | 예상 키 수 |
|-------------|------|-----------|
| `common` | 버튼, 역할, 상태 | ~40 |
| `auth` | 로그인, 가족 생성/합류 | ~25 |
| `calendar` | 일정 CRUD, 카테고리 | ~50 |
| `location` | 위치추적, 네비, 위험지역 | ~35 |
| `notification` | 알림 메시지, 권한 안내 | ~40 |
| `memo` | 메모, 스티커, 꾹 | ~25 |
| **합계** | | **~215** |

### 언어 감지 우선순위

1. `localStorage` 저장값 (사용자가 직접 선택한 언어)
2. `Capacitor Device.getLanguageCode()` (Android 시스템 로캘 — WebView의 `navigator.language`보다 신뢰성 높음)
3. `navigator.language` (웹 브라우저 폴백)
4. 폴백: `'ko'`

> **참고**: Android WebView에서 `navigator.language`가 시스템 로캘과 불일치하는 알려진 이슈 존재. `@capacitor/device`를 2순위로 두어 첫 실행 시 정확한 언어 감지 보장.

### 복수형 (Pluralization)

i18next 내장 복수형 규칙을 사용합니다.

```json
// en/memo.json
{
  "stickerCount_one": "{{count}} sticker",
  "stickerCount_other": "{{count}} stickers"
}

// ja/memo.json (일본어/중국어는 복수형 구분 없음)
{
  "stickerCount": "スティッカー{{count}}個"
}
```

키 명명 규칙: 카운트가 포함된 문자열은 `_one`, `_other` 접미사 사용 (영어). 일본어/중국어는 단일 키.

### 날짜/시간/숫자 포맷

`Intl.DateTimeFormat`과 `Intl.NumberFormat`을 사용합니다. 번역 JSON에 요일/월 이름을 하드코딩하지 않습니다.

| 항목 | 한국어 | 영어 | 일본어 | 중국어 |
|------|--------|------|--------|--------|
| 날짜 | 2026년 3월 19일 | March 19, 2026 | 2026年3月19日 | 2026年3月19日 |
| 요일 | (수) | (Wed) | (水) | (周三) |
| 시간 | 오후 3:00 | 3:00 PM | 15:00 | 下午3:00 |
| 시간 체계 | 12시간 (오전/오후) | 12시간 (AM/PM) | 24시간 | 12시간 (上午/下午) |

구현: `new Intl.DateTimeFormat(currentLocale, options)` — 로캘별 자동 포맷.

`common.json`에는 "방금 전", "5분 전" 같은 상대 시간 표현만 포함합니다.

### 폰트

로캘별 최적 폰트를 적용합니다.

| 언어 | 폰트 | 비고 |
|------|------|------|
| 한국어 | Noto Sans KR | 현재 사용 중 |
| 영어 | Noto Sans | 라틴 문자 최적 |
| 일본어 | Noto Sans JP | 일본 고유 글리프 |
| 중국어 | Noto Sans SC | 간체 글리프 |

`index.css`에서 현재 하드코딩된 `'Noto Sans KR'` → 로캘에 따라 CSS 변수 `--font-family`를 동적 전환.

### 이모지 처리

이모지를 번역 값에 포함합니다. 이모지는 만국 공통이므로 그대로 유지하되, 문화권별 부자연스러운 경우만 조정합니다.

```json
// ko/notification.json
{ "almostThere": "🐰 거의 다 왔어! 조금만 더! 💪" }

// en/notification.json
{ "almostThere": "🐰 Almost there! Just a little more! 💪" }

// ja/notification.json
{ "almostThere": "🐰 もうすぐだよ！あとちょっと！💪" }

// zh/notification.json
{ "almostThere": "🐰 快到了！再加油一下！💪" }
```

---

## 3. 컴포넌트 분리

### 현재 상태

- `App.jsx`: 5,609줄 모놀리식 (모든 UI + 비즈니스 로직)
- `auth.js`: 10,849 bytes
- `sync.js`: 17,157 bytes
- `pushNotifications.js`: 16,871 bytes

### 새 폴더 구조

```
src/
├── i18n/                          # 번역 인프라
├── components/
│   ├── common/
│   │   ├── Layout.jsx             # 공통 레이아웃 (헤더, 네비게이션)
│   │   ├── Modal.jsx              # 공통 모달
│   │   ├── LanguageSwitcher.jsx   # 언어 선택 UI
│   │   └── LoadingSpinner.jsx     # 로딩 상태
│   ├── auth/
│   │   ├── LoginScreen.jsx        # 카카오/Google/Apple 로그인
│   │   ├── FamilySetup.jsx        # 가족 만들기/합류
│   │   └── RoleSelect.jsx         # 부모/아이 역할 선택
│   ├── calendar/
│   │   ├── CalendarView.jsx       # 월간/일간 캘린더
│   │   ├── DaySchedule.jsx        # 하루 일정 목록
│   │   ├── ScheduleForm.jsx       # 스케줄 추가/수정 폼
│   │   └── CategoryPicker.jsx     # 카테고리 선택 (사용자 커스텀)
│   ├── location/
│   │   ├── MapView.jsx            # Google Maps 렌더링
│   │   ├── Navigation.jsx         # 길 안내 모드
│   │   ├── DangerZone.jsx         # 위험지역 관리
│   │   └── ArrivalDetector.jsx    # 도착 판정 로직
│   ├── notification/
│   │   ├── NotificationSettings.jsx # 알림 권한/설정 UI
│   │   └── PermissionGuide.jsx    # 권한 안내 단계별 가이드
│   ├── memo/
│   │   ├── MemoList.jsx           # 메모/댓글 목록
│   │   ├── StickerPanel.jsx       # 칭찬스티커
│   │   └── KkukButton.jsx         # 꾹 기능
│   └── ai/
│       └── VoiceParse.jsx         # AI 음성/이미지 일정 파싱
├── hooks/
│   ├── useAuth.js                 # 인증 상태 관리
│   ├── useFamily.js               # 가족 데이터
│   ├── useSchedules.js            # 일정 CRUD
│   ├── useLocation.js             # 위치 추적
│   └── useNotification.js         # 알림 관리
├── lib/
│   ├── supabase.js                # (기존 유지)
│   ├── auth.js                    # (리팩토링: Google/Apple 추가)
│   ├── sync.js                    # (기존 유지)
│   ├── pushNotifications.js       # (기존 유지)
│   └── maps.js                    # (신규: Google Maps 래퍼)
└── App.jsx                        # 라우팅 + 상태 조합만 (~200줄)
```

### 분리 원칙

| 원칙 | 적용 |
|------|------|
| 파일당 200~400줄, 최대 800줄 | 5,609줄 → 약 20개 파일 |
| 컴포넌트는 UI만 | 비즈니스 로직은 `hooks/`로 분리 |
| 번역 키는 네임스페이스 1:1 | `calendar/` 컴포넌트 → `calendar.json` |
| 지도 SDK 추상화 | `maps.js`에서 래핑, 컴포넌트는 래퍼만 호출 |

### LanguageSwitcher 배치

| 화면 | 위치 | 비고 |
|------|------|------|
| 로그인 화면 | 하단 중앙 (`🌐 한국어 ▾`) | 로그인 전에도 변경 가능 |
| 설정 화면 | 설정 항목으로 노출 | 로그인 후 변경 가능 |

언어 선택 UI는 국기 아이콘 + 언어명(해당 언어로 표기)으로 구성하여, 현재 언어를 모르는 사용자도 시각적으로 식별 가능하도록 합니다.

---

## 4. 인증 확장

### 로그인 제공자

| 제공자 | 구현 방식 | 표시 조건 |
|--------|----------|----------|
| Google | `supabase.auth.signInWithOAuth({ provider: 'google' })` | 전 언어 |
| Apple | `supabase.auth.signInWithOAuth({ provider: 'apple' })` | 전 언어 |
| 카카오 | 기존 `kakaoLogin()` 유지 | 한국어만 |

### 로그인 화면 UI

```
┌─────────────────────────┐
│     혜니캘린더 로고       │
│                         │
│  [ G  Google로 계속    ] │  ← 최상단 (전 세계 공통)
│  [    Apple로 계속     ] │  ← iOS 대비
│  [  카카오로 계속       ] │  ← 한국어일 때만 표시
│                         │
│      🌐 한국어 ▾        │  ← 로그인 전 언어 변경 가능
└─────────────────────────┘
```

### Android OAuth 리다이렉트 플로우

현재 카카오 로그인에서 사용하는 `skipBrowserRedirect: true` + `window.location.assign(data.url)` 패턴을 Google/Apple에도 동일하게 적용합니다.

```javascript
// 모든 OAuth 공통 패턴 (auth.js 내 kakaoLogin 참조)
async function oauthLogin(provider) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      skipBrowserRedirect: true,
      redirectTo: 'hyenicalendar://auth-callback',
    },
  });
  if (data?.url) window.location.assign(data.url);
}
```

Android Capacitor에서 OAuth 리다이렉트 → Chrome Custom Tab → `hyenicalendar://auth-callback` 딥링크로 복귀하는 기존 플로우를 재활용합니다.

### Apple Sign-In 주의사항

- **Android에서 Apple 로그인**: Supabase OAuth 웹 플로우로 동작 (Apple JS SDK 불필요). Chrome Custom Tab에서 Apple 로그인 페이지 표시 → 인증 → 리다이렉트 콜백.
- **nonce 처리**: Supabase가 내부적으로 PKCE flow + nonce를 관리하므로 클라이언트에서 별도 nonce 생성 불필요.
- **UX 제한**: Android에서 Apple 로그인 시 Face ID/Touch ID 불가, 이메일+비밀번호 입력 필요. 이는 Apple의 제약이며 수용.

### Supabase 대시보드 설정 필요

- Google: Client ID + Secret (Google Cloud Console 발급)
- Apple: Service ID + Secret Key (Apple Developer 발급)
- Redirect URL: `hyenicalendar://auth-callback` (기존 딥링크 재활용)

### 가족 플로우

인증 후 가족 생성/합류 로직은 변경 없음. 인증 제공자와 무관하게 동일한 `setupFamily()` / `joinFamily()` 호출.

---

## 5. Google Maps 전환

### API 매핑

| 카카오맵 | Google Maps | 사용처 |
|---------|-------------|--------|
| `kakao.maps.Map` | `google.maps.Map` | 지도 렌더링 |
| `kakao.maps.LatLng` | `google.maps.LatLng` | 좌표 객체 |
| `kakao.maps.Marker` | `google.maps.marker.AdvancedMarkerElement` | 마커 |
| `kakao.maps.CustomOverlay` | `AdvancedMarkerElement` + HTML content | 커스텀 오버레이 |
| `kakao.maps.Polyline` | `google.maps.Polyline` | 경로/이동궤적 |
| `kakao.maps.Circle` | `google.maps.Circle` | 위험지역 반경 |
| `kakao.maps.LatLngBounds` | `google.maps.LatLngBounds` | 범위 조정 |
| `kakao.maps.services.Geocoder` | `google.maps.Geocoder` | 좌표↔주소 |
| `kakao.maps.services.Places` | `google.maps.places.PlacesService` | 장소 검색 |
| `kakao.maps.StaticMap` | Google Static Maps API | 썸네일 지도 |
| 카카오 길찾기 REST API | Google Directions API | 도보 경로 |

### maps.js 래퍼 인터페이스

```javascript
// src/lib/maps.js
export async function loadMaps()              // SDK 로드 (&libraries=places,marker 필수)
export function createMap(el, options)         // 지도 생성 (mapId 필수 — AdvancedMarkerElement 사용 위해)
export function createMarker(map, options)     // 마커
export function createOverlay(map, options)    // 커스텀 오버레이
export function createPolyline(map, options)   // 폴리라인
export function createCircle(map, options)     // 원형 (위험지역)
export function geocode(latlng)               // 좌표→주소
export function searchPlaces(query)           // 장소 검색
export function getDirections(origin, dest)   // 도보 경로
export function createStaticMapUrl(options)   // 정적 지도 URL
export function fitBounds(map, points)        // 범위 맞춤
```

> **주의**: `loadMaps()`에서 `&libraries=places,marker`를 반드시 포함해야 `AdvancedMarkerElement`와 `PlacesService`가 동작합니다. `createMap()`에서 `mapId`를 설정해야 `AdvancedMarkerElement`가 렌더링됩니다 (Google Cloud Console에서 Map ID 생성 필요).

### 환경 변수 변경

```
# 삭제
VITE_KAKAO_APP_KEY=xxx

# 추가
VITE_GOOGLE_MAPS_API_KEY=xxx
```

### API 키 보안

`VITE_GOOGLE_MAPS_API_KEY`는 Vite 빌드 시 JS 번들에 포함되어 APK에서 추출 가능합니다. 출시 전 반드시 Google Cloud Console에서:
- **Android 앱 제한**: 패키지명 (`com.hyeni.calendar`) + SHA-1 서명 인증서 지문으로 제한
- **API 제한**: Maps JavaScript API, Directions API, Places API, Geocoding API, Static Maps API만 허용

### Google Maps 비용

월 $200 무료 크레딧 내에서 소규모~중규모 사용자 운영 가능.

| API | 무료 한도 | 비고 |
|-----|----------|------|
| Maps JavaScript | ~28,000 로드 | 메인 지도 |
| Directions | ~40,000 요청 | 길 안내 |
| Places | ~10,000 요청 | 장소 검색 |
| Geocoding | ~40,000 요청 | 주소 변환 |
| Static Maps | ~100,000 로드 | 썸네일 |

---

## 6. 용어 전환

### "학원" → "스케줄" 변환

| 현재 (한국 특화) | 변경 (글로벌) | 영어 | 일본어 | 중국어 |
|-----------------|-------------|------|--------|--------|
| 학원 추가 | 스케줄 추가 | Add Schedule | スケジュール追加 | 添加日程 |
| 학원 수정 | 스케줄 수정 | Edit Schedule | スケジュール編集 | 编辑日程 |
| 학원 삭제 | 스케줄 삭제 | Delete Schedule | スケジュール削除 | 删除日程 |
| 학원에 도착 | 목적지 도착 | Arrived | 到着しました | 已到达 |
| 학원 가기 15분 전 | 15분 전이야! | 15 min left! | あと15分！ | 还有15分钟！ |

### 카테고리 범용화

하드코딩 프리셋 제거, 사용자 커스텀 구조로 전환.

초기 제안 프리셋 (언어별 동일):

| 한국어 | 영어 | 일본어 | 중국어 |
|--------|------|--------|--------|
| 수업 | Class | レッスン | 课程 |
| 운동 | Sports | スポーツ | 运动 |
| 취미 | Hobby | 趣味 | 兴趣 |
| 병원 | Medical | 病院 | 医院 |
| 기타 | Other | その他 | 其他 |

### 기존 데이터 마이그레이션

`global` 브랜치가 `main`에 머지될 때, 기존 한국 사용자의 Supabase 데이터에 "학원" 등 하드코딩된 카테고리값이 남아있습니다. 마이그레이션 전략:

- 기존 하드코딩 카테고리값 → 해당 사용자의 커스텀 카테고리로 자동 변환하는 Supabase migration SQL 작성
- 매핑: `"학원"→"수업"`, `"운동"→"운동"`, `"취미"→"취미"` (한국어 사용자는 값 유지, 키만 사용자 커스텀으로 전환)
- 머지 시점에 migration을 함께 적용

---

## 7. 타임존 처리

### 현재 문제

`LocationService.java`에서 `TimeZone.getTimeZone("Asia/Seoul")`이 하드코딩되어 있어, 한국 외 사용자에게 위치 기반 알림이 잘못된 시간에 동작합니다.

### 해결 방안

- **기기 로컬 타임존 사용**: `Calendar.getInstance()` (인자 없음) 또는 `TimeZone.getDefault()` 사용
- **이벤트 시간 저장**: Supabase에 `HH:mm` 형식 (로컬 타임 기준)으로 저장 — 현재 방식 유지
- **date_key 형식**: `YYYY-M-D` (로컬 날짜) — 현재 방식 유지
- **변경 범위**: `LocationService.java`의 `Asia/Seoul` 하드코딩을 `TimeZone.getDefault()`로 교체

> **참고**: 이벤트 시간이 "로컬 타임"으로 저장되므로 사용자가 시간대를 이동하면 이벤트 시간이 어긋날 수 있으나, 아이 일정 앱 특성상 시간대 이동은 극히 드물어 수용 가능합니다. 향후 UTC 기반 저장으로 전환 시 별도 마이그레이션 필요.

### date_key 일관성 주의

`date_key`는 `YYYY-M-D` 형식(0-based month)으로 JS와 Java 양쪽에서 생성됩니다. 타임존 변경(`Asia/Seoul` → `TimeZone.getDefault()`) 시:

- **기존 한국 사용자**: KST와 기기 로캘이 동일하므로 영향 없음
- **해외 사용자**: 새로 생성하는 이벤트는 기기 로캘 기준으로 `date_key` 생성 → 정상 동작
- **자정 경계 엣지 케이스**: 서로 다른 타임존의 가족 구성원이 같은 이벤트를 조회할 때, `date_key`가 날짜 경계에서 1일 차이날 수 있음. 이는 아이+부모가 같은 지역에 거주하는 전제(앱 특성)에서 실질적 문제 없음. 향후 다국적 가족 지원 시 UTC 기반 전환 필요.

---

## 8. Android 네이티브 문자열

### 아키텍처 결정: JS에서 번역된 문자열을 Java로 전달

Android Java 파일(특히 `LocationService.java`)에는 이벤트 제목/이모지/시간을 동적으로 조합하는 알림 문자열이 있습니다. 이를 `strings.xml`로 이중 관리하는 대신, **JS 레이어에서 i18next로 번역 완료된 문자열을 Java로 전달**합니다.

| 알림 발생 경로 | 번역 방식 |
|---------------|----------|
| JS → `NativeNotification.show()` → Java | JS에서 번역된 title/body를 전달 (현재와 동일) |
| FCM `onMessageReceived()` → Java | 서버에서 번역된 title/body를 data payload로 전달 |
| `LocationService.java` 자체 생성 알림 | Java에서 직접 생성하는 문자열만 `strings.xml`로 전환 |
| `AlarmManager` 스케줄 알림 | JS에서 예약 시 번역된 title/body를 Intent extra로 전달 (현재와 동일) |

### LocationService.java 자체 생성 문자열

`LocationService`에서 직접 생성하는 알림은 제한적입니다:
- 포그라운드 서비스 알림: "위치 추적 중" → `strings.xml`로 전환
- 도착/미도착 판정 알림: 이벤트 제목+시간을 동적 조합 → `String.format(context.getString(R.string.arrival_notif), emoji, title)` 패턴

### Android strings.xml (최소 범위)

```
android/app/src/main/res/
├── values/strings.xml          # 한국어 (기본)
├── values-en/strings.xml       # 영어
├── values-ja/strings.xml       # 일본어
└── values-zh/strings.xml       # 중국어
```

### strings.xml 필수 키 목록

| 키 | 한국어 (기본) | 용도 |
|----|-------------|------|
| `app_name` | 혜니캘린더 | 앱 이름 (전 언어 동일) |
| `channel_schedule` | 일정 알림 | 알림 채널명 |
| `channel_emergency` | 긴급 알림 | 알림 채널명 |
| `channel_kkuk` | 꾹 알림 | 알림 채널명 |
| `channel_schedule_desc` | 일정 시작 전 알림 | 채널 설명 |
| `channel_emergency_desc` | 긴급 알림 (미도착, 안전 등) | 채널 설명 |
| `channel_kkuk_desc` | 꾹 긴급 핑 | 채널 설명 |
| `foreground_status_parent` | 아이와 함께하고 있어요 💕 | 포그라운드 서비스 알림 (부모) |
| `foreground_status_child` | 부모님이 함께하고 있어요 💕 | 포그라운드 서비스 알림 (아이) |
| `silent_mode_title` | 혜니캘린더 🔇 | 무음모드 포그라운드 알림 제목 |
| `silent_mode_text` | 도착 — 자동 무음 중 | 무음모드 포그라운드 알림 내용 |
| `alert_not_departed` | 🏃 아직 출발 전이에요 | 미출발 알림 |
| `alert_not_departed_body` | %1$s %2$s 시작인데 아직 출발하지 않은 것 같아요 | 미출발 알림 본문 (이모지+제목, 시간) |
| `alert_not_arrived` | 📍 아직 도착 전이에요 | 미도착 알림 |
| `alert_not_arrived_body` | %1$s %2$s 시간이 지났는데 아직 도착하지 않았어요 | 미도착 알림 본문 |
| `alert_arrived` | ✅ 정시 도착! | 도착 알림 |
| `alert_arrived_early` | ✅ 일찍 도착! | 조기 도착 알림 |
| `location_tracking` | 위치 추적 중 | 포그라운드 서비스 제목 |

나머지 알림 문자열은 JS에서 번역 후 전달.

---

## 9. 번역 워크플로

### AI 번역 프로세스

```
1. 한국어 JSON 완성 (ko/*.json)
   - 복수형 키 구조 확정 (_one/_other)
   - Intl 포맷 사용 부분과 번역 키 부분 명확히 분리
2. Claude에게 번역 지시
   - 입력: ko/calendar.json
   - 지시: "아이 대상 친근한 톤 유지, 이모지 유지, 문화적으로 자연스럽게"
   - 출력: en/calendar.json, ja/calendar.json, zh/calendar.json
3. 수동 검수
   - 아이 메시지 톤 확인
   - 문화적 부적절함 체크
   - 복수형 정확성 확인 (영어)
   - UI 문자열 길이 확인 (깨짐 방지)
4. 앱에서 언어 전환하며 실제 화면 확인
```

---

## 10. 구현 순서

### 브랜치 전략

```
main (한국 버전 — 건드리지 않음)
  └── global (글로벌 버전 — 모든 작업)
```

### 6단계 구현

| 단계 | 작업 | 완료 조건 |
|------|------|----------|
| **1a** | `global` 브랜치 생성 → App.jsx 컴포넌트 분리 (한국어 하드코딩 유지) | 한국어로 기존과 동일 동작, App.jsx < 300줄, APK 설치 테스트 통과 |
| **1b** | i18n 인프라 구축 → 한국어 문자열을 번역 키로 치환 → `Intl` 날짜/시간 포맷 적용 | 한국어 번역 키로 기존과 동일 동작, 날짜/시간 포맷 정상 |
| **2** | 카카오맵 → Google Maps 전환 (maps.js 래퍼 + 컴포넌트 교체) + 타임존 수정 | Google Maps로 모든 지도 기능 정상 동작, LocationService 타임존 기기 로컬 |
| **3** | Google/Apple 로그인 추가 + 로그인 화면 리디자인 | Google 로그인으로 가족 생성/합류 성공 |
| **4** | AI 번역 (영어 → 일본어 → 중국어) + Android strings.xml + 검수 | 4개 언어 전환 시 모든 화면 번역 표시, UI 깨짐 없음 |
| **5** | 언어 선택 UI + 용어 범용화("스케줄") + 카테고리 커스텀 + 폰트 전환 + 최종 테스트 | 영어 + Google 로그인 + Google Maps로 전체 플로우 통과 |

### 검증 기준

- 각 단계 완료 시 빌드 성공 + APK 설치 테스트
- **1a 완료 후**: 컴포넌트 분리만 수행, 기존 한국어 기능 100% 동작 (리그레션 없음)
- **1b 완료 후**: i18n 키 치환 완료, 한국어로 동일 동작 (번역 키 누락 없음)
- **5 완료 후**: 영어 환경에서 전체 사용자 플로우 통과 (회원가입→가족생성→일정추가→위치추적→알림)
