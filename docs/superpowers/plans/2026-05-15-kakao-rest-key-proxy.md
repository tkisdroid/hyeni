# Plan — Kakao REST Key Proxy 마이그레이션

**작성일:** 2026-05-15
**Branch:** main (직접) 또는 `feat/kakao-proxy`
**우선순위:** P1 (santa-loop e9afa89 dual-reviewer critical, 두 번째 open follow-up)
**관련 메모리:** [[project_santa_e9afa89_followups]] #1, [[workflow_auto_ship]]

---

## 문제

`VITE_KAKAO_REST_KEY` (Kakao Mobility/Affiliate REST 키, 서버용)가 두 경로로 노출:

1. **JS 번들** — `import.meta.env.VITE_KAKAO_REST_KEY` 가 Vite `VITE_` prefix 규칙에 따라 `dist/assets/index-*.js` 에 literal로 inline. `agent05.json` / `secret-scan.md` 모두 32-hex literal 확인.
2. **Native Android** — JS 측이 키를 `BackgroundLocation` Capacitor 플러그인으로 전달 → `LocationPlugin.java` 가 `SharedPreferences("hyeni_location_prefs", MODE_PRIVATE)` 에 저장. `AndroidManifest.xml`의 `allowBackup=true` 때문에 `adb backup` 으로 추출 가능 (production-qa L-001 P1).

공격자가 APK 디컴파일 또는 bundle inspect로 키 획득 시, project owner의 Kakao quota를 무한정 소진 가능.

## 목표

- 클라이언트(웹/native) 어디에도 Kakao REST 키가 존재하지 않게 한다.
- Kakao 호출은 모두 Supabase Edge Function `kakao-proxy` 를 통과한다 (JWT 검증).
- 기존 도보 경로 기능 (foreground + background)은 기능적으로 동일하게 동작.

## 비목표

- Kakao **Map App key** (`VITE_KAKAO_APP_KEY`, JS SDK 도메인 제한) 은 이번 plan에 포함하지 않음. App key는 본래 client-bundle 용도이며 Kakao 콘솔에서 web/android 도메인·패키지 제한으로 보호됨.
- Forward identity linking, offlineQueue wiring 등 다른 follow-up은 별개 plan.
- Naver REST 키 등 다른 secret은 별도 검토.

---

## 영향 범위 (현재 grep 기준)

### Web/JS
| 파일 | 현재 사용 | 조치 |
|---|---|---|
| `src/lib/walkingRoute.js:17` | `KAKAO_REST_KEY` 로 직접 `apis-navi.kakaomobility.com` fetch | Edge Function 호출로 교체 |
| `src/lib/nativeLocationService.js:17-23, 34, 55` | env var read + 플러그인 args에 `kakaoRestKey` 전달 + 경고 로그 | 모두 제거 |
| `src/lib/auth.js:7-12` | dead comment | 정리 |
| `.env.example:4` | `VITE_KAKAO_REST_KEY=` line | 삭제 |
| `tests/nativeDeliveryHealth.test.js:92-93` | `kakaoRestKey` 문자열 존재를 expect | 반대로 부재를 expect 하도록 변경 |

### Native Android
| 파일 | 현재 사용 | 조치 |
|---|---|---|
| `LocationPlugin.java:45,58,78,88,106,109,121,130,137,146,157,167` | `kakaoRestKey` arg/SharedPreferences/intent extra | 모든 `kakaoRestKey` 인자·저장·전달 코드 제거 |
| `LocationService.java:157,199,209,231-233,865,881` | `kakaoRestKey` field, intent read, SharedPreferences 저장/조회, Kakao 직접 호출 | `fetchWalkingRoutePoints` 를 Edge Function 호출로 교체, field/persistence 모두 제거 |

### Supabase
| 항목 | 조치 |
|---|---|
| `supabase/functions/kakao-proxy/index.ts` | 신규 추가 — JWT 검증 + `KAKAO_REST_KEY` server secret로 walking/v1/directions 프록시 |
| Supabase secrets | `npx supabase secrets set KAKAO_REST_KEY=<key>` (Dashboard도 가능) |
| Supabase Dashboard | 함수 배포 |

### Kakao Developers 콘솔 (사용자)
- 배포·검증 완료 후 기존 REST 키 폐기 + 신규 발급 → Supabase secrets 갱신

---

## 설계

### Edge Function: `kakao-proxy` (단일 endpoint, 라우팅 path-based)

`POST /kakao-proxy/walking-directions`
- Auth: `Authorization: Bearer <user_jwt>` 필수, `supabase.auth.getUser(jwt)` 로 검증. 익명 호출 거부 (401).
- Input (JSON): `{ origin: {lat, lng}, destination: {lat, lng} }`
- 좌표 validation: 위도 [-90, 90], 경도 [-180, 180], finite. 둘 다 필요.
- Upstream: `GET https://apis-navi.kakaomobility.com/affiliate/walking/v1/directions?...` with `Authorization: KakaoAK ${KAKAO_REST_KEY}`. `service: hyeni-calendar` header 유지.
- 응답:
  - 2xx: Kakao raw JSON 그대로 전달 (기존 parser 재사용 위해)
  - 401/403 from Kakao → `{ ok: false, error: "kakao_auth" }` 503 (client의 cooldown latch 트리거 유지)
  - 그 외: `{ ok: false, error: "kakao_http_<code>" }` with original status (또는 502)
- CORS: web build (Capacitor에서도 file:// origin) 호환 위해 `Access-Control-Allow-Origin: *` + POST/OPTIONS 허용.
- Rate limit: 1st pass에서는 미구현 (이미 Kakao 측 quota 있음). 필요 시 follow-up.

**왜 path-based 단일 함수?** future-fit. Geocoding 등 다른 Kakao 호출 추가 시 같은 함수 안에 분기 추가하면 됨. 함수 수 늘리지 않아 cold-start cost 감소.

### Web 클라이언트 (`walkingRoute.js`)

```js
// 변경 전: fetch(KAKAO_WALKING_DIRECTIONS_URL, { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` }})
// 변경 후: supabase.functions.invoke('kakao-proxy/walking-directions', { body: { origin, destination } })
```

- `supabase.functions.invoke` 는 자동으로 caller JWT 첨부.
- `kakaoWalkingDirectionsDisabledUntil` cooldown latch 보존 (401/403 → 5분 비활성).
- `parseKakaoWalkingRoute` 는 변경 없음 — Kakao 원본 JSON 그대로 받음.
- 키 없음 분기 (`!KAKAO_REST_KEY`) → 세션 없음 (`!user`) 분기로 대체.

### Native (`LocationService.java::fetchWalkingRoutePoints`)

- Endpoint: `${SUPABASE_URL}/functions/v1/kakao-proxy/walking-directions`
- Headers: `Authorization: Bearer ${accessToken}`, `apikey: ${supabaseKey}`, `Content-Type: application/json`
- Body: `{"origin":{"lat":..,"lng":..},"destination":{"lat":..,"lng":..}}`
- 응답: Kakao 원본 JSON → 기존 `routes[0].sections[].roads[].vertexes` 파싱 로직 그대로 유지
- 401 from Edge Function (accessToken expired) → 기존 동작과 동일하게 빈 list 반환. Supabase JWT 갱신은 별도 follow-up (현재 코드는 만료 토큰에 대한 처리가 없음 — `updateToken` 플러그인 메서드로 main JS가 push). 본 plan 범위 밖.

### 정리할 잔여

- `LocationService.java` line 157 (`private String kakaoRestKey`), line 199, 209, 231-233, 865 (early return when blank) — 모두 제거.
- `LocationPlugin.java` 12개 reference 모두 제거.
- `SharedPreferences "kakaoRestKey"` key는 기존 사용자 device에 남아있을 수 있음 → 안전상 LocationService 시작 시 `.remove("kakaoRestKey")` 1회 수행 (best-effort cleanup, 새 install엔 영향 없음).

---

## 작업 순서

| # | Task | 검증 |
|---|---|---|
| 1 | Edge Function `supabase/functions/kakao-proxy/index.ts` 작성 | local: deno check |
| 2 | `npx supabase secrets set KAKAO_REST_KEY=<key>` (또는 Dashboard) | `npx supabase secrets list` |
| 3 | `npx supabase functions deploy kakao-proxy` | Dashboard에서 active |
| 4 | curl로 endpoint 수동 검증 (with valid JWT) | 2xx Kakao JSON 응답 |
| 5 | `walkingRoute.js` 교체 + 관련 import (supabase) | vitest |
| 6 | `nativeLocationService.js` 에서 `kakaoRestKey` 제거 | vitest |
| 7 | `LocationPlugin.java` `kakaoRestKey` 인자 제거 | gradle assembleDebug |
| 8 | `LocationService.java::fetchWalkingRoutePoints` Edge Function 호출로 교체 + field/SharedPreferences 정리 + best-effort remove | gradle assembleDebug |
| 9 | `auth.js` dead comment, `.env.example` line, `nativeDeliveryHealth.test.js` 갱신 | vitest 전체 PASS |
| 10 | `npm run build` 후 `dist/assets/*.js` 에 `kakao` 키 literal 없음 확인 | `grep -r "VITE_KAKAO_REST" dist/` 0건 |
| 11 | APK 빌드 → R5CY40EE6QE / ZY22H9VTQD install | foreground 도보 경로 + background tick walking trail 정상 |
| 12 | commit + push (auto-ship) | pre-push hook 통과 |
| 13 | **사용자**: Kakao 콘솔에서 키 rotation, Supabase secrets 갱신 | 신규 키로 호출 성공, 구 키 폐기 |
| 14 | 메모리 [[project_santa_e9afa89_followups]] #1 closed로 갱신 | — |

---

## 검증 시나리오 (수동)

| # | 경로 | 기대 |
|---|---|---|
| V1 | 부모 앱에서 자녀 위치 → "도보 경로 보기" 탭 | 경로선 그려짐, 거리/시간 표시 |
| V2 | 자녀 앱 background로 두고 이동 | 부모 앱에 trail vertices 갱신 |
| V3 | accessToken 만료 후 V1 | gracefully 실패 (직선 fallback 또는 에러 안내), 앱 crash 없음 |
| V4 | Kakao 401 시뮬레이션 (secret 일시 unset) | cooldown latch 동작, 5분 후 재시도 |
| V5 | `adb shell run-as com.hyeni.calendar cat /data/data/.../shared_prefs/hyeni_location_prefs.xml` | `kakaoRestKey` key 부재 (또는 빈 값) |
| V6 | `grep -r "KakaoAK" dist/` | 0건 |

---

## 롤백 계획

- Edge Function 배포만 한 상태에서 client는 아직 직접 호출 → 호환. 안전.
- Client 변경 commit을 revert 하면 직접 호출로 복귀 (단, .env에 키가 여전히 있어야 함). 사용자가 키 rotation 후 revert 시 .env도 갱신.
- Edge Function 배포 자체 revert: `npx supabase functions delete kakao-proxy`. Client는 그 시점에 깨짐 — rotation 전이면 revert client 적용으로 복구, rotation 후면 신규 키 .env 재투입 필요.

가장 안전한 순서: **Edge Function 배포 + secret 등록 → client 교체 → 양쪽 검증 → key rotation**. Rotation은 마지막에 사용자가 진행.

---

## 위험·미해결

- **R1 (latency):** native LocationService가 location tick마다 walking route를 그릴 때, 매 호출이 device → Supabase → Kakao 의 2-hop. 측정 후 너무 느리면 Edge Function에서 캐시 (origin/destination 해시) 검토.
- **R2 (JWT 만료):** background service의 accessToken 갱신은 본 plan 범위 밖. 현재 코드도 만료 시 빈 trail. 본 plan은 이 동작을 유지.
- **R3 (Kakao 콘솔 IP 제한):** Edge Function의 outbound IP는 Supabase가 관리하며 변할 수 있음. Kakao 콘솔에 IP 제한이 걸려있지 않은지 확인 필요. **사용자에게 확인 요청**.
- **R4 (CORS):** Capacitor WebView origin은 `https://localhost` (Android) / `capacitor://localhost`. Edge Function CORS `*` 허용으로 무관하지만 검증 필요.

---

## 승인 필요 항목

1. 단일 함수 path-based 라우팅 (`/kakao-proxy/walking-directions`) vs 함수당 endpoint (`/walking-directions`)
2. Branch 전략: main 직접 vs `feat/kakao-proxy`
3. Kakao 콘솔 IP 제한 설정 확인 (R3)
4. Key rotation 타이밍: 검증 후 즉시 vs 며칠 observation 후
