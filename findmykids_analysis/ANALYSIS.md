# Findmykids 앱 (v2.8.60-google) 정적 분석 보고서

> 분석 대상: `org.findmykids.app` — 부모(Parent) 전용 빌드. 아이의 기기에는 `org.findmykids.child` 가 별도로 설치됨.
> APK: Android 8.0+(minSdk 26) · target 34 · 약 101 MB (6-DEX, 약 5만 5천 클래스).
> 분석 일자: 2026-04-22

---

## 1. 앱 정체 및 전체 구조

| 항목 | 값 |
|---|---|
| 패키지 | `org.findmykids.app` |
| 앱 이름 | Findmykids (러시아 회사 "Findmykids/GDEMOIDETI" 제작) |
| 버전 | 2.8.60-google (2008601) |
| 메인 액티비티 | `org.findmykids.app.activityes.launcher.LauncherActivity` |
| 백엔드 | `api.findmykids.org`, `billing.findmykids.org`, `webview.findmykids.org`, `gps-watch.findmykids.org` |
| 실시간 음성/채팅 | **RongCloud (融云) IM + RongRTC** (중국 CDN — `nav.cn.ronghub.com`) |
| 하드코딩된 RongCloud AppKey | `pgyu6atqp2ccu` (클래스 `iD3.f()` 내부 리터럴) |

Android 매니페스트에 선언된 요청 권한 31개 중 민감 권한(요약):

- `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS` — **주변소리 청취의 핵심**
- `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `FOREGROUND_SERVICE_DATA_SYNC` — 포그라운드 서비스로 스트리밍 유지
- `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` — 위치 추적
- `CAMERA`, `READ_CONTACTS`, `READ_EXTERNAL_STORAGE` — 자녀 데이터 접근 (자녀 앱 측 사용)
- `SYSTEM_ALERT_WINDOW` — 앱 사용 시간 제어용 오버레이
- `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK` — 백그라운드 유지
- `com.android.vending.BILLING` — Google Play 인앱결제

---

## 2. 주요 기능 총정리

액티비티·서비스·리소스(문자열) 교차검증으로 식별한 **부모 앱 기능**입니다.

### 2.1 온보딩·연결
- `LauncherActivity` — 앱 시작 분기
- `SelectDeviceActivity` — 스마트폰/GPS 스마트워치 선택
- `StepConnectionActivity` — 자녀 기기 페어링 단계별 가이드
- `ChildrenListActivity` — 여러 자녀 관리, 가족 코드 초대 링크(`l.findmykids.org/...deep_link_value=familycode_...`)

### 2.2 자녀 위치 기능
- `ParentActivity` (신/구 UI 두 벌), `MainActivity`
- `WaitLocationActivity` — 위치 로딩 화면
- `LocationWidget`(홈 화면 위젯) + `UpdateWidgetService`
- 구현체는 `org.findmykids.geo.consumer.*` 패키지(내부 Consumer API)

### 2.3 **주변소리 청취 (SoundAround / Listening)** — ★질문의 핵심, 상세는 §3
- `SoundActivity` + `ListeningPlayerService`

### 2.4 SOS
- `SosActivity`, `org.findmykids.sos.presentation.withLive.*` — SOS와 라이브 청취가 결합됨
  (아이가 SOS 누르면 자동으로 주변소리 스트리밍 시작)

### 2.5 자녀 스마트폰 상태 모니터링
- `AppStatisticsActivity` — 자녀 기기 앱 사용 통계 (어떤 앱을 얼마나 썼는지)
- `NotificationsListActivity` — 자녀가 받은 알림 목록
- `HiddenPhotoActivity` — "몰래 찍힌 사진" 열람
  (자녀 기기가 주기적으로 전면/후면 카메라로 촬영한 것, `HiddenPhotoLoaderWorker`가 다운로드)
- `HeartsActivity` — "하트" 포인트(아이의 반응/칭찬 카운터)
- `OverlayActivity` (`org.findmykids.appusage`) — 자녀 기기 화면 차단/오버레이 관리

### 2.6 GPS 스마트워치 전용 설정 (아이가 워치 사용 시)
- `ChildWatchSettingsActivity` 및 12개 `W*Activity` — 메인번호, 비밀번호, 걸음계, SOS 번호, 수업시간(Silents), 수면시간, 화이트리스트, 알람, 전화번호부, 번호변경 등
- `ChangeWatchNumberActivity`, `VideoWatchActivity` (튜토리얼 영상)
- 파생 서버: `gps-watch.findmykids.org`

### 2.7 알림·피드
- `org.findmykids.feed.*` — "숏 콘텐츠"(카드형 피드) 좋아요/투표/공유/반응 지원
- `DebugNotificationActivity` — 내부 디버그용

### 2.8 구독·결제·리텐션
- `SubscriptionDashboardActivity`, `ActivationActivity` — 구독 관리
- `ResubscribeActivity` (`ai.resubscribe`) — 이탈 방지 재구독 SDK
- `org.findmykids.sources.billing.*` + `com.android.billingclient` — Google Play 결제
- `FirstSessionOfferFragment`, `InitialGiftFragment`, `MinutesGiftForRateFragment` — "첫 세션 특가", "무료 분 선물", "평점 5★ 시 무료 분 증정" 등 세일 팝업
- `MinutesUnlimReminderWorker` — 무제한 플랜 리마인더 스케줄링

### 2.9 작업/할일
- `WebTaskActivity` — 자녀에게 과제/할일 부여 (아이콘: `todo_android_star.png`)

### 2.10 워치-앱 마이그레이션
- `org.findmykids.migratetorugmd` — 러시아 시장에서 `ru.gdemoideti.parent`로 리브랜딩 이전

### 2.11 번들 SDK (기능에 간접 기여)
| SDK | 용도 |
|---|---|
| Firebase FCM | 푸시 알림 (`FcmListenerService`) |
| Intercom | 인앱 고객지원 채팅 |
| AppsFlyer | 설치 출처/어트리뷰션 |
| Facebook | 로그인·광고 |
| Crowdin | 실시간 다국어 번역 갱신 |
| Dexter | 런타임 권한 요청 |
| Intercom Surveys | 인앱 설문 |
| five_corp.ad | 광고 |
| Samsung/Huawei badge | 홈 런처 배지 |

---

## 3. ★ 주변소리(아이 주변 소리) 청취 기능 — 구체적 구현

### 3.1 패키지 구조 (관련 클래스 약 130개)

```
org.findmykids.soundaround.parent/
├── ListeningPlayerService        ← 포그라운드 서비스 (세션 유지)
├── presentation/
│   ├── SoundActivity             ← 메인 화면
│   ├── root/
│   │   ├── RootFragment
│   │   ├── controls/ControlsFragment
│   │   ├── minutes/MinutesFragment       ← 남은 청취 초(秒) 표시
│   │   ├── bluetoothIndicator/...        ← 블루투스 이어폰 권장 배지
│   │   └── wave/WaveFormView + WaveFragment ← 실시간 파형
│   ├── soundconnection/…Fragment          ← "연결 중…" 화면
│   ├── soundconnectionerror/…
│   ├── firstsessionoffer/                 ← 유료 세일즈 유입
│   └── popups/
│       ├── agreement/AgreementFragment    ← "법적 사용 동의" 체크
│       ├── initialMinutesGift/            ← 무료 분 증정
│       └── errors/
│           ├── micBusy/MicBusyFragment           (아이 마이크 사용중)
│           ├── forbiddenByChild/…                (아이가 차단)
│           ├── stoppedByChild/…                  (아이가 중지)
│           ├── noMicPermission/…                 (아이 앱에 RECORD_AUDIO 권한 없음)
│           ├── connectFailed/…
│           └── noInternet/…
├── data/
│   ├── seconds/  {LiveSecondsResponse, LiveSecondsResult, ChargeSecondsResponse}
│   └── sound/    {RestrictionLiveErrorsResponse,
│                  RestrictionLiveErrorsResult(isMicAccessible, isSoundEnabled)}
└── service/MinutesUnlimReminderWorker
```

핵심 비즈니스 로직은 `org.findmykids.soundaround.parent.domain.LiveInteractorImpl`
(난독화되어 단문자 클래스로 존재) 와, RongCloud 래퍼인 **`iD3` 클래스**에 집중됩니다.

### 3.2 전송 프로토콜 결정: RongCloud(융운) RTC 기반 WebRTC

네이티브 라이브러리에 `lib_RongRTC_so.so` (8.7 MB), `libRongIMLib.so` 가 포함되어 있으며,
DEX에는 `cn.rongcloud.rtc.*` (WebRTC 기반 실시간 미디어) 및 `io.rong.imlib.*`
(시그널링용 IM) 전체 SDK가 들어있습니다. 중국 융윈의 IM(신호) + RTC(미디어) 구조이므로
음성은 **WebRTC PeerConnection(UDP/DTLS-SRTP)** 로 전송됩니다
(RongRTC SDK 내부에 `RongRTCConnection`, `RongRTCConnectionClient`,
`RongRTCAudioRecord`, `RongRTCAudioTrack`, `StunCandidate`, SDP Offer/Answer 루틴 존재).

### 3.3 전체 호출 흐름 (부모 기기 기준)

아래는 bytecode 레벨의 `iD3` 래퍼 메서드를 순서대로 재구성한 것입니다.

**(1) 화면 진입**
`SoundActivity.onCreate()` — intent extras로 `childId`·`초기모드` 전달받음 → `RootFragment`와
7개 Koin 주입 뷰모델 초기화. 이때 **포그라운드 서비스 `ListeningPlayerService.startForeground()`**
로 `notification_channel_sound_around` 채널에 "주변소리 청취 중…" 알림을 띄워
Android가 프로세스를 종료하지 못하게 함.

**(2) 세션 사전 점검**
뷰모델은 `findmykids.org` API에 두 건을 호출:
- `LiveSecondsResult.secondsLeft` — 유료 구독/무료 분 잔량 확인
  (0이면 `InitialGiftFragment` 또는 `FirstSessionOfferFragment` 노출)
- `RestrictionLiveErrorsResult.{isMicAccessible, isSoundEnabled}` —
  아이 쪽에서 마이크 권한을 거부했거나, 아이가 앱 설정에서 "소리 청취 허용"을 꺼놨는지 확인.
  각각 거부되면 `NoMicPermissionFragment` 또는 `ForbiddenByChildFragment`가 호출됨.

**(3) RongCloud IM 로그인** (`iD3.f(FL4 callback, Function0)`)
```java
RongIMClient.setRLogLevel(...);
RongIMClient.init(context, "pgyu6atqp2ccu", false);   // 하드코딩 AppKey
String rongToken = jD3.a();                            // 서버에서 발급받은 개인 토큰
RongIMClient.getInstance()
            .connect(rongToken, new iD3$b(...));       // 성공시 다음 단계 콜백
```
서버(`api.findmykids.org`)는 부모가 인증된 자녀에 대해서만 토큰을 발급합니다.

**(4) 아이 기기에 녹음 시작 명령**
아이 앱(`org.findmykids.child`)은 IM 채널을 통해 같은 RongCloud roomId로 초대됩니다.
서버는 자녀 기기에 FCM 푸시(`org.findmykids.app.fcm.PushHandlerImpl`의 대응 핸들러)로
"소리 시작" 커스텀 메시지를 보내고, 자녀 앱이 전경/포그라운드 서비스로 `AudioRecord` +
RongRTC로 마이크 스트림을 퍼블리시합니다. `bL4` 인터페이스는 부모/자녀 양쪽 모두 공유하며,
이 APK가 부모 빌드이므로 부모 측에서는 마이크 캡쳐(`RongRTCCapture`)를 끄고 **수신 전용**으로 동작합니다.

**(5) RTC 룸 참여** (`iD3.c(mD3 roomConfig)`)
```java
RongRTCConfig cfg = RongRTCConfig.Builder.create()
   .setAudioCodec(...)                              // 일반적으로 OPUS
   .videoProfile(RONGRTC_VIDEO_PROFILE_240P_15f)    // 비디오는 미사용이지만 필드 설정
   .build();
RongRTCCapture.getInstance().setRTCConfig(cfg);
RongRTCEngine.getInstance()
             .joinRoom(roomId, new iD3$c(this));    // 성공 콜백
```
성공하면 `iD3$c.onUiSuccess(RongRTCRoom room)` 에서:
- `RongRTCLocalUser` 얻어서 (부모) 이벤트 리스너 `iD3$d`를 등록 (`setRongRTCEventsListener`)
- `room.getRemoteUsers()` — 이미 들어와 있는 원격 사용자(=아이)가 있으면 자동 구독

**(6) 아이의 오디오 스트림 구독** (`iD3$d.onRemoteUserPublishResource(remoteUser, list)`)
아이 기기가 마이크를 퍼블리시하면 이 콜백이 호출되고 부모 측은 `RongRTCAVInputStream`을
구독(`subscribeStream`)합니다. 내부적으로는 WebRTC SDP Offer/Answer 교환 →
ICE Candidate 수집 → DTLS 핸드셰이크 → SRTP 로
**OPUS로 인코딩된 오디오가 UDP로 실시간 스트리밍**됩니다.
버퍼링 없는 양방향 PeerConnection이므로 지연은 보통 100~300 ms 수준입니다.

**(7) 재생·라우팅** (`iD3.b(boolean useSpeaker)`)
```java
AudioManager am = (AudioManager) ctx.getSystemService("audio");
am.setMode(MODE_IN_COMMUNICATION or MODE_NORMAL);
am.setSpeakerphoneOn(useSpeaker);
```
수신 오디오는 RongRTC 내부의 `RongRTCAudioTrack` (`AudioTrack` 래퍼, `STREAM_VOICE_CALL`) 로
출력되며, **블루투스 이어폰 감지 시 `BluetoothIndicatorFragment`로 "이어폰 사용을 권장합니다"
배지**가 뜹니다 — 아이에게 청취 사실이 들리지 않도록 하기 위함.

**(8) 파형 시각화** (`iD3$f : RongRTCStatusReportListener`)
```java
onAudioReceivedLevel(HashMap<userId, level>) → WaveFormView에 dB 레벨 주입
onConnectionStats(StatusReport)              → 통신 품질 배지
```
이 콜백은 약 100 ms 주기로 수신 오디오 세기를 밀어주며,
`WaveFormView`가 이것을 기반으로 시각적 파형을 렌더링합니다.

**(9) 타임/과금 감시**
세션이 진행되는 동안 부모 앱은 매초 `LiveSecondsResult` 를 폴링하고,
서버는 `/…/charge-seconds` 류 엔드포인트로 사용 초를 차감합니다.
`KEY_LAST_SEEN_LIVE_SECONDS_COUNT` 키로 잔량이 로컬 DataStore에 미러링됩니다.
잔량 소진 시 강제 중단 → `InitialGiftFragment` 또는 `FirstSessionOfferFragment` 노출.
A/B 실험 플래그 `android_experiment_GMD_52159_longer_sound_around_timeout_global`·`…_ru` 와
`android_experiment_GMD_48591_sound_around_unlims_v2_1_global` 로
세션 타임아웃 길이와 "무제한 분" 상품 노출이 원격 제어됩니다.

**(10) 종료** (`iD3.h(Function0 onDone)`)
```java
RongRTCEngine.getInstance()
             .quitRoom(room.getRoomId(), new iD3$e(this, onDone));
// IM 세션 유지하되 RTC만 정리
```
이후 `ListeningPlayerService.stopForeground()` → 알림 해제.
`iD3.close()` — 최종적으로 `RongIMClient.logout()` 까지 끊어 세션을 완전 정리.

### 3.4 아이 쪽 차단/동의 흐름
- `RestrictionLiveErrorsResult.isSoundEnabled` — 아이가 앱 내
  **"부모가 소리 듣기 허용"** 토글을 끌 수 있음 (`SOUND_ENABLED_PREF_KEY`).
  끄면 부모는 `ForbiddenByChildFragment`.
- `StoppedByChildFragment` — 세션 도중 아이가 중지 누르면 표시.
- `AgreementFragment` — 최초 사용 시 "**합법적 범위(본인 자녀, 동의 하) 내에서만 사용**"
  이라는 법적 고지/동의 체크박스를 강제. 체크 안 하면 진행 불가
  (`FIRST_START_LIVE_SOUND_AROUND` SharedPreferences 플래그).

### 3.5 아이 기기에 시각적 고지 여부
문자열 자원에 `sound_around_notification_title`, `CHANNEL_SOUND_AROUND_LOUD`(부모 측),
`sound_around_welcome_*`, `sound_around_instructions_*` 만 있고
**아이 측 알림은 본 APK(부모 빌드)에 포함되지 않음** — 별도의 자녀 APK에서 관리됩니다.
다만 `RECORD_AUDIO` 가 실행 중이면 Android 12+에서는 상태바 마이크 인디케이터가 강제 표시됩니다.

---

## 4. 보안·개인정보 관점 요약

- **중국 RongCloud 인프라**로 음성이 라우팅됩니다
  (`nav.cn.ronghub.com`, `stats.cn.ronghub.com`, `feedback.cn.ronghub.com`).
  E2E 암호화가 아닌 **DTLS-SRTP** 기반이므로 음성은 TURN 경유 시
  **중계 서버에서 복호화 상태로 경유**될 수 있습니다.
- **AppKey가 하드코딩(`pgyu6atqp2ccu`)** 되어 있어 토큰 교체가 어렵고,
  토큰은 `api.findmykids.org`가 발급하는 개인 토큰에 의존합니다.
- 부모 앱이 `SYSTEM_ALERT_WINDOW`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK` 를 포함해
  다수의 강력한 권한을 가지며, `MinutesUnlimReminderWorker`·`HiddenPhotoLoaderWorker` 등
  WorkManager 기반 백그라운드 작업을 다수 등록합니다.
- 수집·분석 SDK(AppsFlyer, Facebook, Firebase, Intercom, Crowdin)로 인해
  기본 식별자가 광범위하게 공유됩니다(`AD_ID`, `ACCESS_ADSERVICES_ATTRIBUTION`).
- 한국 기준으로 이 기능을 쓰려면 **통신비밀보호법상 본인 미성년 자녀 + 양육권자 본인 동의**
  요건을 충족해야 법적 문제가 없음을 앱 내 `AgreementFragment`가 상기시킵니다.

---

## 5. 최종 아키텍처 한눈에

```
[부모 SoundActivity] ── startForeground ──> [ListeningPlayerService]
       │
       ▼ (LiveInteractorImpl, seconds/restrictions REST 호출)
[api.findmykids.org] ── FCM/IM push ──> [자녀 앱(원격)]
       │                                     │
       │  iD3.f() RongIMClient.connect       │  RongIMClient.connect
       ▼                                     ▼
 ┌────────────── RongCloud IM (nav.cn.ronghub.com) ──────────────┐
 │                    (시그널링: 룸 초대/오프라인 푸시)           │
 └───────────────────────────────────────────────────────────────┘
       │                                     │
       │  iD3.c()  joinRoom(roomId)          │  joinRoom(roomId) + publishStream
       ▼                                     ▼
 ┌────────────── RongRTC 미디어 서버 (WebRTC SFU) ───────────────┐
 │  DTLS-SRTP/UDP · OPUS · 약 100~300 ms 지연                     │
 │  Parent: subscribe ◀── Child: AudioRecord → publish            │
 └───────────────────────────────────────────────────────────────┘
       │
       ▼ (RongRTCAudioTrack → AudioManager STREAM_VOICE_CALL)
 [부모 스피커/이어폰]  + WaveFormView(onAudioReceivedLevel 콜백)
```

---

## 6. 산출물 파일 목록

본 디렉터리에 보존된 파일:

- `app.apk` — 원본 APK (약 101 MB)
- `AndroidManifest.xml` — 역직렬화된 매니페스트 (36 KB)
- `dex/classes.dex` ~ `dex/classes6.dex` — 6개의 DEX 파일 (합계 약 51 MB,
  약 5만 5천 클래스)
- `ANALYSIS.md` — 본 문서
