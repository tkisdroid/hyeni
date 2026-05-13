# Permission Inventory — Android

Source: `android/app/src/main/AndroidManifest.xml`

| Permission | Justification | Runtime check site | Guard present |
|------------|--------------|-------------------|---------------|
| INTERNET | Supabase/FCM/Kakao network | n/a (normal) | n/a |
| ACCESS_NETWORK_STATE | Connectivity awareness | n/a (normal) | n/a |
| ACCESS_FINE_LOCATION | Child location tracking | LocationService.java:243 | YES |
| ACCESS_COARSE_LOCATION | Fallback location | covered by fine check | YES |
| ACCESS_BACKGROUND_LOCATION | Background tracking | LocationPlugin.java:71-76 | YES |
| FOREGROUND_SERVICE | FGS for location/audio | n/a (declared via service tags) | n/a |
| FOREGROUND_SERVICE_LOCATION | Android 14+ FGS type | LocationService.java:255-260 | YES |
| FOREGROUND_SERVICE_MICROPHONE | Android 14+ FGS type (RL) | AmbientListenService.java:130-150 | YES |
| FOREGROUND_SERVICE_SPECIAL_USE | Force ring + ambient listen fallback | ForceRingService.java + AmbientListenService.java | YES |
| POST_NOTIFICATIONS | Push delivery | pushNotifications.js:219 | YES |
| RECEIVE_BOOT_COMPLETED | Restart on boot | BootReceiver.java | YES |
| WAKE_LOCK | Keep CPU on during capture | AmbientListenService.java:498-507 (timed) | YES |
| **RECORD_AUDIO** | Remote listen capture | AmbientListenService.java:163-167 | **YES** |
| CAMERA | QR pairing scanner (WebView getUserMedia) | OS-gated WebView prompt | YES |
| USE_FULL_SCREEN_INTENT | ForceRing fullscreen alert | ForceRingService.java | YES |
| SYSTEM_ALERT_WINDOW | (declared, broad permission) | needs review | NOTE |
| REQUEST_IGNORE_BATTERY_OPTIMIZATIONS | Reliable background tracking | LocationService.java:269 | YES |
| SCHEDULE_EXACT_ALARM | Time-precise notifications | within app limits | YES |
| MODIFY_AUDIO_SETTINGS | ForceRing alarm volume | ForceRingService.java | YES |
| VIBRATE | Notification haptic | n/a (normal) | n/a |

## Foreground Service Notification Audit (Play stalkerware policy)

| Service | FGS type | Persistent notification | Visibility | Notes |
|---------|---------|------------------------|-----------|-------|
| LocationService | location | YES (channel `hyeni_location_v4`) | PUBLIC | OK |
| AmbientListenService | microphone (primary) / specialUse (fallback) | YES (`ambient_listen_fgs`, ongoing=true, PRIORITY_LOW) | PUBLIC | Korean copy "주변 소리 연결 중" |
| ForceRingService | specialUse | YES | parent emergency alert | OK |
| MyFirebaseMessagingService | (not FGS, messaging only) | n/a | n/a | OK |

`isMonitoringTool=child_monitoring` meta-data declared on `<application>` (AndroidManifest.xml:40-42) — Play Console recognizes this for parental-monitoring policy exemption.

## SharedPreferences `hyeni_location_prefs` — sensitive data at rest

| Key | Sensitivity | Storage mode | Backup-exposed via adb? |
|-----|------------|--------------|---------------------------|
| userId | medium (UUID) | MODE_PRIVATE | YES (allowBackup=true) |
| familyId | medium (UUID) | MODE_PRIVATE | YES |
| supabaseUrl | low (public) | MODE_PRIVATE | YES |
| supabaseKey | low (anon key, public) | MODE_PRIVATE | YES |
| **accessToken** | **HIGH (user JWT)** | MODE_PRIVATE | **YES — P1** |
| kakaoRestKey | medium (domain-restricted public key) | MODE_PRIVATE | YES |
| role | low (parent/child enum) | MODE_PRIVATE | YES |
| fcmToken | medium | MODE_PRIVATE | YES |

Source: `LocationService.java:202-209`, `MyFirebaseMessagingService.java`.
