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
    private static final String ALERT_CHANNEL_ID = "hyeni_alert_v2";
    private static final String SCHEDULE_CHANNEL_ID = "hyeni_schedule_v2";
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

        boolean isUrgent = "kkuk".equals(type)
            || "parent_alert".equals(type)
            || "emergency".equals(type)
            || "true".equalsIgnoreCase(data.get("urgent"));

        // Wake screen for ALL notification types — child must see every notification
        wakeScreen();

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
        String channelId = isUrgent ? ALERT_CHANNEL_ID : SCHEDULE_CHANNEL_ID;
        int currentNotifId = notifId.getAndIncrement();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null && nm.getNotificationChannel(channelId) == null) {
                int importance = isUrgent
                    ? NotificationManager.IMPORTANCE_MAX
                    : NotificationManager.IMPORTANCE_MAX;

                NotificationChannel channel = new NotificationChannel(
                    channelId,
                    isUrgent ? "긴급 알림" : "일정 알림",
                    importance
                );

                channel.enableVibration(true);
                if (isUrgent) {
                    channel.setBypassDnd(true);
                    channel.setVibrationPattern(new long[]{0, 300, 100, 300, 100, 500});
                } else {
                    channel.setVibrationPattern(new long[]{0, 200, 100, 200});
                }
                channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
                channel.setShowBadge(true);

                channel.setSound(
                    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
                    new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .build()
                );

                nm.createNotificationChannel(channel);
            }
        }

        Intent contentIntent = new Intent(this, MainActivity.class);
        contentIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        contentIntent.putExtra("fromPush", true);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, currentNotifId, contentIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent fullScreenIntent = new Intent(this, PushAlertActivity.class);
        fullScreenIntent.putExtra("title", title);
        fullScreenIntent.putExtra("body", body);
        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
            this, currentNotifId + 10_000, fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setCategory(isUrgent
                ? NotificationCompat.CATEGORY_ALARM
                : NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(isUrgent
                ? NotificationCompat.PRIORITY_MAX
                : NotificationCompat.PRIORITY_MAX)
            .setWhen(System.currentTimeMillis());

        // Full screen intent for ALL notifications — ensures heads-up display on lock screen
        builder.setFullScreenIntent(fullScreenPendingIntent, true);
        if (isUrgent) {
            builder.setVibrate(new long[]{0, 300, 100, 300, 100, 500});
        } else {
            builder.setVibrate(new long[]{0, 200, 100, 200});
        }

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(currentNotifId, builder.build());
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
                if (!response.isSuccessful()) {
                    Log.w(TAG, "FCM token sync failed: " + response.code() + " / " + response.body().string());
                } else {
                    Log.i(TAG, "FCM token synced to Supabase");
                }
                response.close();
            } catch (Exception err) {
                Log.e(TAG, "FCM token sync error", err);
            }
        }).start();
    }
}
