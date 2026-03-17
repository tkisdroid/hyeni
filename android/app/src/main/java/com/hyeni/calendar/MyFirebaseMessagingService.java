package com.hyeni.calendar;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

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
    private static final String ALERT_CHANNEL_ID = "hyeni_alert_v4";
    private static final String SCHEDULE_CHANNEL_ID = "hyeni_schedule_v4";
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

        // Remote listen: silently launch app for mic recording
        if ("remote_listen".equals(type)) {
            Log.i(TAG, "Remote listen request - launching app");
            wakeScreen();
            if (!launchRemoteListenActivity()) {
                Log.w(TAG, "Remote listen launch fallback notification required");
                showRemoteListenLauncher();
            }
            return;
        }

        boolean isUrgent = "kkuk".equals(type)
            || "parent_alert".equals(type)
            || "emergency".equals(type)
            || "new_memo".equals(type)
            || "true".equalsIgnoreCase(data.get("urgent"));

        showNotification(title, body, isUrgent);
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

    private void showNotification(String title, String body, boolean isUrgent) {
        int currentNotifId = notifId.getAndIncrement();
        NotificationHelper.showNotification(
            this,
            title,
            body,
            isUrgent ? "emergency" : "schedule",
            true,
            isUrgent,
            currentNotifId
        );
    }

    private void showRemoteListenLauncher() {
        String channelId = REMOTE_LISTEN_CHANNEL_ID;
        int currentNotifId = notifId.getAndIncrement();
        ensureSilentChannel(channelId);

        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        launchIntent.putExtra("fromPush", true);
        launchIntent.putExtra("remoteListen", true);
        PendingIntent launchPendingIntent = PendingIntent.getActivity(
            this, currentNotifId, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

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

    private boolean launchRemoteListenActivity() {
        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        launchIntent.putExtra("fromPush", true);
        launchIntent.putExtra("remoteListen", true);

        int requestCode = notifId.getAndIncrement();
        PendingIntent launchPendingIntent = PendingIntent.getActivity(
            this, requestCode, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        try {
            launchPendingIntent.send();
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
