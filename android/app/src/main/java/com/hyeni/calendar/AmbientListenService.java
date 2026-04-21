package com.hyeni.calendar;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;
import androidx.core.app.NotificationCompat;

/**
 * Phase 5 · D-B06 · RL-03 — AmbientListenService
 *
 * Google Play stalkerware / spyware policy requires that apps capturing the
 * microphone for ambient transmission show a persistent, non-dismissable
 * foreground-service notification for the entire duration of the capture, and
 * declare the {@code microphone} foreground service type on Android 14+
 * (API 34). This service implements both requirements.
 *
 * Activation flow (wired in v1.1 native-deploy ticket — NOT invoked in this
 * phase):
 *  1. JS layer (src/App.jsx) calls a future Capacitor bridge method
 *     {@code AmbientListenPlugin.start()} when the parent's
 *     {@code remote_listen} realtime broadcast arrives OR when the FCM
 *     launch intent flag is set.
 *  2. The plugin starts this service with
 *     {@code startForegroundService(new Intent(ctx, AmbientListenService.class))}.
 *  3. This service posts {@link #NOTIF_ID} with the "recording" banner,
 *     attaches the {@code microphone} FGS type on API 34+, and keeps running
 *     for the capture duration. A second {@code stop} intent stops the
 *     service (and therefore the notification) when capture ends — whether
 *     normally, by user cancel, by timeout, or by page_unload.
 *
 * Why author-only in Phase 5:
 *  Per {@code .planning/phases/05-ux-safety-hardening/05-CONTEXT.md} §D-B06,
 *  the Phase 5 scope is to AUTHOR the service + manifest declaration + JS
 *  bridge stub so reviewers and downstream engineers have a complete
 *  compliance artefact. The actual Capacitor bridge wiring, Gradle rebuild,
 *  and Google Play internal-track submission are DEFERRED to v1.1 native-
 *  deploy, because the Phase 5 dev environment cannot safely APK-build on
 *  Windows without a local Android SDK + emulator + Play Console
 *  self-certification.
 *
 * Lifecycle guarantee:
 *  {@code onStartCommand} returns {@link Service#START_NOT_STICKY} — if the
 *  process dies mid-capture, Android does NOT restart the service with a
 *  stale Intent, which matches the "fail-closed on loss of transparency"
 *  requirement. The remote_listen_sessions audit row is closed independently
 *  by the JS-side beforeunload handler (see RL-04 in App.jsx).
 */
public class AmbientListenService extends Service {

    private static final String TAG = "AmbientListenService";
    private static final String CHANNEL_ID = "ambient_listen_fgs";
    private static final int NOTIF_ID = 1001;

    @Override
    public IBinder onBind(Intent intent) {
        // Not a bound service — JS bridge interacts via startService/stopService.
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createChannel();
        Notification notif = buildOngoingNotification();

        // Android 14 (API 34) requires foregroundServiceType microphone for
        // any FGS that captures audio. We declare it both here and in
        // AndroidManifest.xml (see <service android:foregroundServiceType="microphone" />).
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE /* API 34 */) {
            try {
                startForeground(
                    NOTIF_ID,
                    notif,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                );
            } catch (SecurityException se) {
                // Missing FOREGROUND_SERVICE_MICROPHONE permission — log and
                // fall back to untyped startForeground so at least the
                // notification is shown. v1.1 APK build MUST verify the
                // permission is declared in AndroidManifest.xml.
                Log.e(TAG, "FGS-microphone type denied; falling back", se);
                startForeground(NOTIF_ID, notif);
            }
        } else {
            startForeground(NOTIF_ID, notif);
        }

        Log.i(TAG, "Ambient listen FGS started (notif id=" + NOTIF_ID + ")");
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        Log.i(TAG, "Ambient listen FGS stopped");
        super.onDestroy();
    }

    private Notification buildOngoingNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("주변 소리 연결 중")
            .setContentText("부모님과 연결된 주위 소리 듣기 세션이 활성 상태예요")
            // Reuse the system mic icon until a branded vector drawable is
            // produced in v1.1. LocationService.java follows the same pattern
            // (android.R.drawable.ic_menu_mylocation).
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm =
                (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm == null) return;
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "주변 소리 세션",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("주위 소리 듣기 세션이 활성 중일 때 표시됩니다");
            channel.setShowBadge(false);
            nm.createNotificationChannel(channel);
        }
    }
}
