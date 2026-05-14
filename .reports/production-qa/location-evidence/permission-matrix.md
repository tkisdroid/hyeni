# Permission Matrix — Location

Source: android/app/src/main/AndroidManifest.xml

| Permission | Declared | Runtime Requester | Notes |
|------------|----------|-------------------|-------|
| ACCESS_FINE_LOCATION | line 7 | LocationPlugin.java:62 (Capacitor `@Permission` alias="location") | gate in LocationService onStartCommand:243 — stopSelf if not granted |
| ACCESS_COARSE_LOCATION | line 8 | LocationPlugin alias="coarseLocation" | not independently used; bundled |
| ACCESS_BACKGROUND_LOCATION | line 9 | LocationPlugin.java:74 (raw ActivityCompat.requestPermissions, code 2001) | requested only if FINE already granted; no rationale dialog before |
| FOREGROUND_SERVICE_LOCATION | line 11 | startForeground in LocationService.java:255-260 (SDK 34+ FOREGROUND_SERVICE_TYPE_LOCATION) | OK |
| FOREGROUND_SERVICE | line 10 | implicit | OK |

Graceful fallback patterns:
- LocationService.java:243-247 — stopSelf() returned when FINE not granted. Service does not crash, but ServiceKeepAlive.schedule(this) is only called AFTER permission check passes (line 270), so the alarm-keepalive cycle is not orphaned. However, BootReceiver and ServiceKeepAlive will re-launch the service on boot regardless, generating a stopSelf each cycle until user grants permission.
- requestNativeCurrentLocation web fallback (App.jsx:1907) uses navigator.geolocation; native failure path is console.warn only — no user-visible toast.
- Web watchPosition error handler (App.jsx:3094) maps err.code === 1 → "위치 권한이 꺼져 있어요" toast. Good UX.
