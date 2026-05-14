# Pairing Evidence — Two-Device Parent/Child Runtime

## Devices
- **PARENT**: R5CY40EE6QE — Samsung SM-A556S — Android 16 (SDK 36)
- **CHILD**: ZY22H9VTQD — motorola razr 40 ultra — Android 15 (SDK 35)

## Automated Flow Results

### Step 1: Install & Cold Launch — PASS (both)
- APK installed on both devices via `adb install -r` (Success).
- App data cleared via `pm clear com.hyeni.calendar` (Success).
- App cold-launched via monkey LAUNCHER intent on both.
- Live PIDs after launch: PARENT 7230, CHILD 31908.

### Step 2: Mode Select Screen — PASS (both)
- Both devices presented `누구로 시작할까요?` screen.
- Buttons `부모로 시작` and `자녀로 시작` rendered on both devices identically.
- Evidence: `parent-screenshots/01-launch.{png,xml}`, `child-screenshots/01-launch.{png,xml}`.

### Step 3: Role Selection — PASS (both)
- PARENT tapped `부모로 시작` toggle at center (539, 1058).
- CHILD tapped `자녀로 시작` toggle at center (539, 1492).
- Helper text `역할을 선택하면 시작할 수 있어요` disappeared, "다음" button became active on both.
- Evidence: `*/02-mode-select.{png,xml}`.

### Step 4: Next Button Advances Flow — PASS (both)
- Tapped `다음` button on both devices.
- PARENT advanced to auth screen (`혜니캘린더에 오신 것을 환영해요!` with 카카오/네이버/구글 + 이메일·비밀번호 options).
- CHILD advanced to pairing input screen (`부모님과 연결하기`, `부모님 앱에 있는 연동 코드를 입력해 주세요`, QR option).
- Evidence: `parent-screenshots/04-auth-screen.{png,xml}`, `child-screenshots/07-pair-input.{png,xml}`.

### Step 5: Email/Password Form Expansion — PASS (parent only)
- PARENT tapped `아이디 · 비밀번호로 로그인 ▾` and form expanded showing `로그인` CTA.
- Confirms auth form is wired and present.
- Evidence: `parent-screenshots/04b-auth-expanded.{png,xml}`.

## Automated Flow Halts (Manual Intervention Required)

### Step 6: PARENT Authentication — NOT AUTOMATED
- 카카오/네이버/구글 OAuth requires external app handoff which cannot be safely automated without test credentials.
- 이메일/비밀번호 path requires a pre-existing test account; project guidelines forbid creating accounts that touch production data.
- **Manual step required**: tester must complete OAuth or sign in with a known test account on PARENT (R5CY40EE6QE).

### Step 7: Family Create + Pair Code Issuance — NOT REACHED
- Blocked by Step 6.
- **Manual step required**: after auth, tester taps "가족 만들기" and captures the 6-digit pair code.

### Step 8: CHILD Enters Pair Code — NOT REACHED
- Blocked by Step 7 (no code to enter).
- **Manual step required**: tester inputs the pair code shown on PARENT into CHILD's `부모님과 연결하기` screen.

### Step 9: Paired State Verification (Parent home + Child home) — NOT REACHED
- Blocked by Step 8.

## Logcat Summary

### Health Signals (both devices)
- AmbientListen Capacitor plugin registered.
- FCM token primed on both devices.
- Realtime context provider initialized (PARENT: `RealtimeMovingContextProvider - hit!`).
- Periodic state-snapshot console logs from app webview confirm runtime is healthy and reading device state.

### Errors / Crashes
- `FATAL EXCEPTION`: NONE on either device.
- `ANR`: NONE.
- `Force closed`: NONE.
- `com.hyeni.calendar E/`: NONE.
- `AndroidRuntime` entries are entirely from `monkey` and `uiautomator` helper processes — no app crash trace.

### Notable Observations
- PARENT (Android 16) and CHILD (Android 15) both reach the welcome / pair-input screens cleanly within ~3 seconds of cold launch.
- Both devices report `notificationsEnabled: false`, `postPermissionGranted: false`, `recordAudioGranted: false` — expected for first-run before permission wizard.
- Both devices report `locationServiceRunning: false` and `ready: false` — expected pre-auth.

## Conclusion

Cold-launch through pre-auth flow verified PASS on both real devices. No crashes, no errors, both screens render identically and match the expected UX. Beyond auth, evidence collection requires manual tester action.
