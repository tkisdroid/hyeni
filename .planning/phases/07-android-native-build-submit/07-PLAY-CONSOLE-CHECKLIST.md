# Phase 7 Play Console Checklist

Updated: 2026-04-23

## Policy Basis

- Google Play Malware policy, Stalkerware and monitoring applications:
  https://support.google.com/googleplay/android-developer/answer/9888380
- Google Play Help, Use of the isMonitoringTool flag:
  https://support.google.com/googleplay/android-developer/answer/12955211

## Required Build Artifacts

- Signed release AAB: `hyeni-calendar-aab-<commit-sha>`
- Signed release APK: `hyeni-calendar-apk-<commit-sha>` for device smoke and manifest inspection
- APK inspection artifact: `gradle-build-log-<commit-sha>` includes:
  - `apk-badging.txt`
  - `apk-manifest.xmltree.txt`
  - Gradle logs/reports

The workflow builds AAB only when all four GitHub Actions secrets exist:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

## Manifest Declarations To Verify

- `package: name='com.hyeni.calendar'`
- `versionCode='2'`
- `isMonitoringTool` = `child_monitoring`
- `AmbientListenService`
- `foregroundServiceType` on `AmbientListenService`

## Store Listing Disclosure Draft

혜니캘린더는 보호자가 본인의 자녀 일정과 안전 상태를 함께 확인하기 위한 가족용 앱입니다. 아이 기기에서 위치 공유, 일정 알림, 비상 알림, 주위 소리 듣기 기능이 사용될 수 있으며, 기능이 동작할 때 아이 화면과 Android 알림에 명확히 표시됩니다. 이 앱은 몰래 감시하거나 제3자를 추적하기 위한 앱이 아니며, 가족 연동 코드로 연결된 보호자와 자녀 사이에서만 사용됩니다.

## Monitoring Declaration Draft

This app is exclusively designed and marketed as a family safety and child schedule coordination app for parents or legal guardians to monitor their own children. It is not a secret surveillance or spying app and must not be used to monitor a spouse, partner, employee, or any other individual.

The app discloses monitoring functionality in the app UI and store listing. When child location sharing or ambient listening is active, the child device shows visible in-app status and/or a persistent Android notification that clearly identifies Hyeni Calendar. Monitoring features require family pairing through an in-app code and are limited to linked parent-child family accounts.

## Internal Testing Steps

1. Open Play Console.
2. Select Hyeni Calendar.
3. Confirm app content declarations and data safety match the disclosure above.
4. Go to Testing > Internal testing.
5. Create or edit the active internal testing release.
6. Upload the signed release AAB from the latest successful Android Build workflow.
7. Add release notes: `v1.1 Android native safety build: child location precision, microphone permission guidance, monitoring disclosure metadata.`
8. Add at least one tester email, for example `energetk@naver.com`.
9. Roll out to internal testing.
10. Install from the tester invite link on the child Android device and run Phase 8 live smoke.

## Phase 8 Live Smoke Gate

- Parent app can open child precision location map.
- Child app shows new logo on launch/splash.
- Parent/child pairing works.
- KKUK and memo still work after reinstall.
- Remote listen permission denied path shows Korean microphone permission guidance.
- When microphone is allowed, child device shows visible active-listening state and Android notification.
