## Session Memory

Date: 2026-03-16

### Current focus

- Stabilize remote ambient audio listening.
- Ensure memo/event pushes reach the other family member.
- Request core Android permissions early on first normal app launch.

### Changes already made

- Fixed instant push delivery path in `src/App.jsx` so authenticated requests use XHR/fetch before beacon fallback.
- Updated `supabase/functions/push-notify/index.ts` CORS and instant notification handling.
- Restored today memo UI wiring in `src/App.jsx` so memo content is visible and save/send handlers run.
- Changed remote listen FCM delivery to data-only for `remote_listen` so it does not create a normal system notification.
- Prevented `remote_listen` from being inserted into `pending_notifications` and from browser push display paths.
- Adjusted parent remote listen UI text in `src/App.jsx` to show waiting state instead of `0 sec receiving`.
- Added Android remote listen launch path improvements in `MyFirebaseMessagingService.java`:
  - launch app directly first
  - show fallback silent launcher notification only if direct launch fails
- Added Android microphone permission handling for remote listen in `MainActivity.java` before JS remote capture starts.
- Added first-run core Android permission prompt in `MainActivity.java` for:
  - `RECORD_AUDIO`
  - `ACCESS_FINE_LOCATION`
  - `POST_NOTIFICATIONS` on Android 13+

### Files currently modified

- `src/App.jsx`
- `android/app/src/main/java/com/hyeni/calendar/MainActivity.java`
- `android/app/src/main/java/com/hyeni/calendar/MyFirebaseMessagingService.java`
- `supabase/functions/push-notify/index.ts`

### Important behavior now intended

- Remote listen should wake the child app without a normal visible notification in the common path.
- Remote listen should only show fallback notification if Android refuses direct activity launch.
- Child microphone capture should not start until runtime mic permission is granted.
- First normal app launch should proactively ask for notification, microphone, and location permissions.

### Still required after code changes

- Rebuild and reinstall the Android app.
- Redeploy `supabase/functions/push-notify`.
- Verify on a physical child device:
  - first launch permission prompts
  - remote listen from closed app
  - no duplicate/unwanted child notifications
  - actual audio chunk playback on parent side
  - memo/event push delivery to the opposite role

### Local environment limits seen in this session

- Node/Vite build is not reliable in this environment due to a local crypto startup failure.
- Android Gradle compile also failed earlier in this environment before Java compilation.

