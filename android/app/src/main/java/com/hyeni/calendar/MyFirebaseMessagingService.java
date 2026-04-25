package com.hyeni.calendar;

import android.Manifest;
import android.app.ActivityOptions;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

/**
 * Handles FCM push messages delivered by Google's push infrastructure.
 * Works even when the app process is completely dead — Android starts this
 * service automatically when an FCM message arrives.
 */
public class MyFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "FCMService";
    private static final String PREFS_NAME = "hyeni_location_prefs";
    private static final String ALERT_CHANNEL_ID = NotificationHelper.CHANNEL_EMERGENCY;
    private static final String SCHEDULE_CHANNEL_ID = NotificationHelper.CHANNEL_SCHEDULE;
    private static final String REMOTE_LISTEN_CHANNEL_ID = "hyeni_remote_listen";
    private static final AtomicInteger notifId = new AtomicInteger(5000);
    private static final OkHttpClient HTTP_CLIENT = new OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build();

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.i(TAG, "FCM token refreshed");
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        prefs.edit().putString("fcmToken", token).apply();
        syncTokenToSupabase(token);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.i(TAG, "FCM message received from: " + remoteMessage.getFrom());

        Map<String, String> data = remoteMessage.getData();
        String title = data.get("title");
        String body = data.get("body");
        String type = data.get("type");

        // Fallback to notification payload if data payload is empty
        if (title == null && remoteMessage.getNotification() != null) {
            title = remoteMessage.getNotification().getTitle();
            body = remoteMessage.getNotification().getBody();
        }

        if (title == null) title = "혜니캘린더";
        if (body == null) body = "";

        // Skip if this notification was sent by me
        String senderUserId = data.get("senderUserId");
        if (senderUserId != null && !senderUserId.isEmpty()) {
            String myUserId = getSharedPreferences(PREFS_NAME, MODE_PRIVATE).getString("userId", "");
            if (senderUserId.equals(myUserId)) {
                Log.i(TAG, "Skipping self-notification for: " + type);
                return;
            }
        }

        if ("request_location".equals(type)) {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            if (!shouldHandleChildCommand(prefs)) {
                Log.i(TAG, "Location refresh skipped: this device is not child mode");
                return;
            }
            if (startLocationRefreshService(data)) {
                return;
            }
            Log.w(TAG, "Location refresh request could not start native service");
            return;
        }

        // Remote listen: silently launch app for mic recording
        if ("remote_listen".equals(type)) {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            if (!shouldHandleChildCommand(prefs)) {
                Log.i(TAG, "Remote listen skipped: this device is not child mode");
                return;
            }
            Log.i(TAG, "Remote listen request - launching app requestId=" + resolveRemoteListenRequestId(data));
            wakeScreen();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                showRemoteListenLauncher(data);
                launchRemoteListenActivity(data);
                return;
            }
            if (startAmbientListenService(data)) {
                return;
            }
            if (!launchRemoteListenActivity(data)) {
                Log.w(TAG, "Remote listen launch fallback notification required");
                showRemoteListenLauncher(data);
            }
            return;
        }

        boolean isEmergency = isEmergencyNotification(type, data);
        String stableId = firstNonBlank(
            data.get("pushId"),
            data.get("idempotencyKey"),
            data.get("idempotency_key"),
            type + ":" + title + ":" + body
        );

        showNotification(title, body, type, isEmergency, stableId);
    }

    private void wakeScreen() {
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            @SuppressWarnings("deprecation")
            PowerManager.WakeLock wl = pm.newWakeLock(
                PowerManager.FULL_WAKE_LOCK
                    | PowerManager.ACQUIRE_CAUSES_WAKEUP
                    | PowerManager.ON_AFTER_RELEASE,
                "hyeni:fcm_wake"
            );
            wl.acquire(15000);
        }
    }

    private void showNotification(String title, String body, String type, boolean isEmergency, String stableId) {
        int currentNotifId = stableId != null && !stableId.trim().isEmpty()
            ? NotificationHelper.stableRequestCode(stableId)
            : notifId.getAndIncrement();
        String channel = isEmergency ? "emergency" : ("kkuk".equals(type) ? "kkuk" : "schedule");
        NotificationHelper.showNotification(
            this,
            title,
            body,
            channel,
            isEmergency,
            isEmergency,
            currentNotifId
        );
    }

    private boolean isEmergencyNotification(String type, Map<String, String> data) {
        if ("emergency".equals(type) || "sos".equals(type)) {
            return true;
        }
        if ("true".equalsIgnoreCase(data.get("urgent"))) {
            return true;
        }
        if (!"parent_alert".equals(type)) {
            return false;
        }
        String severity = firstNonBlank(data.get("severity"), "");
        String alertType = firstNonBlank(data.get("alertType"), data.get("alert_type"), "");
        if ("emergency".equalsIgnoreCase(severity)
                || "critical".equalsIgnoreCase(severity)
                || "urgent".equalsIgnoreCase(severity)) {
            return true;
        }
        return "not_arrived".equals(alertType)
                || "missed_arrival".equals(alertType)
                || "danger_zone".equals(alertType)
                || "danger_enter".equals(alertType)
                || "danger_entry".equals(alertType)
                || "danger_exit".equals(alertType);
    }

    private boolean shouldHandleChildCommand(SharedPreferences prefs) {
        String role = prefs != null ? prefs.getString("role", "") : "";
        return isBlank(role) || "child".equalsIgnoreCase(role);
    }

    private boolean startLocationRefreshService(Map<String, String> data) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            Log.w(TAG, "Location refresh skipped: ACCESS_FINE_LOCATION permission missing");
            return false;
        }

        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String userId = prefs.getString("userId", "");
        String prefsFamilyId = prefs.getString("familyId", "");
        String pushFamilyId = data != null ? data.get("familyId") : null;
        if (!isBlank(pushFamilyId) && !isBlank(prefsFamilyId) && !pushFamilyId.equals(prefsFamilyId)) {
            Log.w(TAG, "Location refresh skipped: family mismatch");
            return false;
        }

        String familyId = firstNonBlank(pushFamilyId, prefsFamilyId);
        String supabaseUrl = prefs.getString("supabaseUrl", "");
        String supabaseKey = prefs.getString("supabaseKey", "");
        String accessToken = prefs.getString("accessToken", "");

        if (isBlank(userId) || isBlank(familyId) || isBlank(supabaseUrl) || isBlank(supabaseKey)) {
            Log.w(TAG, "Location refresh skipped: push context missing");
            return false;
        }

        Intent intent = new Intent(this, LocationService.class);
        intent.setAction(LocationService.ACTION_REFRESH_NOW);
        intent.putExtra("userId", userId);
        intent.putExtra("familyId", familyId);
        intent.putExtra("supabaseUrl", supabaseUrl);
        intent.putExtra("supabaseKey", supabaseKey);
        intent.putExtra("accessToken", accessToken);
        intent.putExtra("role", "child");
        String requestId = resolveRemoteListenRequestId(data);
        if (!isBlank(requestId)) {
            intent.putExtra("requestId", requestId);
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent);
            } else {
                startService(intent);
            }
            Log.i(TAG, "Location refresh foreground service started from FCM");
            return true;
        } catch (Exception error) {
            Log.w(TAG, "Location refresh service start failed from FCM", error);
            return false;
        }
    }

    private void showRemoteListenLauncher(Map<String, String> data) {
        String channelId = REMOTE_LISTEN_CHANNEL_ID;
        int currentNotifId = notifId.getAndIncrement();
        ensureSilentChannel(channelId);

        Intent launchIntent = createRemoteListenIntent(data);
        PendingIntent launchPendingIntent = createRemoteListenPendingIntent(
            launchIntent,
            currentNotifId
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle("안전 확인 연결 중")
            .setContentText("주변 소리 연결을 시작합니다.")
            .setStyle(new NotificationCompat.BigTextStyle().bigText("주변 소리 연결을 시작합니다."))
            .setAutoCancel(true)
            .setContentIntent(launchPendingIntent)
            .setSilent(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setFullScreenIntent(launchPendingIntent, true)
            .setWhen(System.currentTimeMillis());

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(currentNotifId, builder.build());
        }
    }

    private boolean launchRemoteListenActivity(Map<String, String> data) {
        Intent launchIntent = createRemoteListenIntent(data);

        int requestCode = notifId.getAndIncrement();
        PendingIntent launchPendingIntent = createRemoteListenPendingIntent(
            launchIntent,
            requestCode
        );

        try {
            launchPendingIntent.send(this, 0, null, null, null, null, remoteListenSendOptions());
            return true;
        } catch (PendingIntent.CanceledException pendingIntentError) {
            Log.w(TAG, "PendingIntent remote listen launch failed", pendingIntentError);
        }

        try {
            startActivity(launchIntent);
            return true;
        } catch (Exception launchError) {
            Log.w(TAG, "Direct remote listen launch failed", launchError);
            return false;
        }
    }

    private Intent createRemoteListenIntent(Map<String, String> data) {
        Intent launchIntent = new Intent(this, RemoteListenActivity.class);
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        launchIntent.putExtra("fromPush", true);
        launchIntent.putExtra("remoteListen", true);
        putRemoteListenExtras(launchIntent, data);
        return launchIntent;
    }

    private PendingIntent createRemoteListenPendingIntent(Intent launchIntent, int requestCode) {
        return PendingIntent.getActivity(
            this,
            requestCode,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE,
            remoteListenCreatorOptions()
        );
    }

    private Bundle remoteListenCreatorOptions() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            return null;
        }

        ActivityOptions options = ActivityOptions.makeBasic();
        options.setPendingIntentCreatorBackgroundActivityStartMode(
            ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED
        );
        return options.toBundle();
    }

    private Bundle remoteListenSendOptions() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            return null;
        }

        ActivityOptions options = ActivityOptions.makeBasic();
        options.setPendingIntentBackgroundActivityStartMode(
            ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED
        );
        return options.toBundle();
    }

    private boolean startAmbientListenService(Map<String, String> data) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            Log.w(TAG, "Remote listen native start skipped: RECORD_AUDIO permission missing");
            return false;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            Log.i(TAG, "Remote listen native start skipped on Android 14+: microphone FGS requires foreground UI");
            return false;
        }

        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String userId = prefs.getString("userId", "");
        String prefsFamilyId = prefs.getString("familyId", "");
        String pushFamilyId = data != null ? data.get("familyId") : null;
        if (!isBlank(pushFamilyId) && !isBlank(prefsFamilyId) && !pushFamilyId.equals(prefsFamilyId)) {
            Log.w(TAG, "Remote listen native start skipped: family mismatch");
            return false;
        }

        String familyId = firstNonBlank(pushFamilyId, prefsFamilyId);
        String supabaseUrl = prefs.getString("supabaseUrl", "");
        String supabaseKey = prefs.getString("supabaseKey", "");
        String accessToken = prefs.getString("accessToken", "");

        if (isBlank(userId) || isBlank(familyId) || isBlank(supabaseUrl) || isBlank(supabaseKey)) {
            Log.w(TAG, "Remote listen native start skipped: push context missing");
            return false;
        }

        Intent intent = new Intent(this, AmbientListenService.class);
        intent.setAction(AmbientListenService.ACTION_START);
        intent.putExtra(AmbientListenService.EXTRA_USER_ID, userId);
        intent.putExtra(AmbientListenService.EXTRA_FAMILY_ID, familyId);
        intent.putExtra(AmbientListenService.EXTRA_SUPABASE_URL, supabaseUrl);
        intent.putExtra(AmbientListenService.EXTRA_SUPABASE_KEY, supabaseKey);
        intent.putExtra(AmbientListenService.EXTRA_ACCESS_TOKEN, accessToken);
        intent.putExtra(AmbientListenService.EXTRA_DURATION_SEC, readDurationSec(data));

        String senderUserId = data != null ? data.get("senderUserId") : null;
        if (!isBlank(senderUserId)) {
            intent.putExtra(AmbientListenService.EXTRA_INITIATOR_USER_ID, senderUserId);
        }
        String requestId = resolveRemoteListenRequestId(data);
        if (!isBlank(requestId)) {
            intent.putExtra(AmbientListenService.EXTRA_REQUEST_ID, requestId);
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent);
            } else {
                startService(intent);
            }
            Log.i(TAG, "Remote listen native foreground service started from FCM");
            return true;
        } catch (Exception error) {
            Log.w(TAG, "Remote listen native service start failed from FCM", error);
            return false;
        }
    }

    private void putRemoteListenExtras(Intent intent, Map<String, String> data) {
        if (intent == null || data == null) return;
        putIfPresent(intent, "familyId", data.get("familyId"));
        putIfPresent(intent, "senderUserId", data.get("senderUserId"));
        putIfPresent(intent, "durationSec", data.get("durationSec"));
        putIfPresent(intent, "requestId", resolveRemoteListenRequestId(data));
    }

    private void putIfPresent(Intent intent, String key, String value) {
        if (!isBlank(value)) {
            intent.putExtra(key, value);
        }
    }

    private int readDurationSec(Map<String, String> data) {
        String raw = data != null ? data.get("durationSec") : null;
        if (isBlank(raw)) return 30;
        try {
            int durationSec = Integer.parseInt(raw);
            if (durationSec < 5) return 30;
            return Math.min(durationSec, 120);
        } catch (NumberFormatException ignored) {
            return 30;
        }
    }

    private String resolveRemoteListenRequestId(Map<String, String> data) {
        if (data == null) return "";
        return firstNonBlank(
            data.get("requestId"),
            data.get("pushId"),
            data.get("idempotencyKey"),
            data.get("idempotency_key")
        );
    }

    private String firstNonBlank(String... values) {
        if (values == null) return "";
        for (String value : values) {
            if (!isBlank(value)) {
                return value.trim();
            }
        }
        return "";
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private void ensureSilentChannel(String channelId) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                NotificationChannel existing = nm.getNotificationChannel(channelId);
                if (existing != null) {
                    nm.deleteNotificationChannel(channelId);
                }

                NotificationChannel channel = new NotificationChannel(
                    channelId, "원격 듣기 연결", NotificationManager.IMPORTANCE_HIGH);
                channel.enableVibration(false);
                channel.setBypassDnd(false);
                channel.setSound(null, null);
                channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
                channel.setShowBadge(false);
                nm.createNotificationChannel(channel);
            }
        }
    }

    private void syncTokenToSupabase(String token) {
        new Thread(() -> {
            try {
                SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
                String userId = prefs.getString("userId", null);
                String familyId = prefs.getString("familyId", null);
                String supabaseUrl = prefs.getString("supabaseUrl", null);
                String supabaseKey = prefs.getString("supabaseKey", null);
                String accessToken = prefs.getString("accessToken", null);

                if (userId == null || familyId == null || supabaseUrl == null || supabaseKey == null) {
                    Log.w(TAG, "FCM token sync skipped: push context not ready yet");
                    return;
                }

                JSONObject body = new JSONObject();
                body.put("user_id", userId);
                body.put("family_id", familyId);
                body.put("fcm_token", token);
                SimpleDateFormat iso = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
                iso.setTimeZone(TimeZone.getTimeZone("UTC"));
                body.put("updated_at", iso.format(new Date()));

                String bearer = (accessToken != null && !accessToken.isEmpty()) ? accessToken : supabaseKey;
                Request req = new Request.Builder()
                    .url(supabaseUrl + "/rest/v1/fcm_tokens?on_conflict=user_id,fcm_token")
                    .header("apikey", supabaseKey)
                    .header("Authorization", "Bearer " + bearer)
                    .header("Content-Type", "application/json")
                    .header("Prefer", "resolution=merge-duplicates,return=minimal")
                    .post(RequestBody.create(body.toString(), MediaType.get("application/json")))
                    .build();

                Response response = HTTP_CLIENT.newCall(req).execute();
                int code = response.code();
                if (response.isSuccessful()) {
                    Log.i(TAG, "FCM token synced to Supabase");
                    response.close();
                } else {
                    String errBody = response.body() != null ? response.body().string() : "";
                    response.close();
                    Log.w(TAG, "FCM token sync failed: " + code + " / " + errBody);

                    // JWT 만료 시 anon key로 재시도
                    if (code == 401 || code == 403) {
                        Log.i(TAG, "Retrying FCM token sync with apikey");
                        Request retryReq = new Request.Builder()
                            .url(supabaseUrl + "/rest/v1/fcm_tokens?on_conflict=user_id,fcm_token")
                            .header("apikey", supabaseKey)
                            .header("Authorization", "Bearer " + supabaseKey)
                            .header("Content-Type", "application/json")
                            .header("Prefer", "resolution=merge-duplicates,return=minimal")
                            .post(RequestBody.create(body.toString(), MediaType.get("application/json")))
                            .build();
                        Response retryResp = HTTP_CLIENT.newCall(retryReq).execute();
                        if (retryResp.isSuccessful()) {
                            Log.i(TAG, "FCM token synced with apikey fallback");
                        } else {
                            Log.e(TAG, "FCM token sync retry failed: " + retryResp.code());
                        }
                        retryResp.close();
                    }
                }
            } catch (Exception err) {
                Log.e(TAG, "FCM token sync error", err);
            }
        }).start();
    }
}
