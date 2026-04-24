package com.hyeni.calendar;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

public final class NotificationHelper {

    public static final String CHANNEL_SCHEDULE = "hyeni_schedule_v5";
    public static final String CHANNEL_EMERGENCY = "hyeni_alert_v5";
    public static final String CHANNEL_KKUK = "hyeni_kkuk_v5";

    private static final String DEDUPE_PREFS_NAME = "hyeni_notification_dedupe";
    private static final long DEDUPE_WINDOW_MS = 90_000L;

    private static final String[] LEGACY_CHANNELS = {
            "hyeni_schedule",
            "hyeni_emergency",
            "hyeni_kkuk",
            "hyeni_schedule_channel",
            "hyeni_alert_channel",
            "hyeni_schedule_v2",
            "hyeni_alert_v2",
            "hyeni_kkuk_v2",
            "hyeni_schedule_v3",
            "hyeni_alert_v3",
            "hyeni_kkuk_v3",
            "hyeni_schedule_v4",
            "hyeni_alert_v4",
            "hyeni_kkuk_v4"
    };

    private NotificationHelper() {}

    public static void createChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) {
            return;
        }

        for (String legacyChannel : LEGACY_CHANNELS) {
            if (nm.getNotificationChannel(legacyChannel) != null) {
                nm.deleteNotificationChannel(legacyChannel);
            }
        }

        Uri sound = Uri.parse("android.resource://" + context.getPackageName() + "/" + R.raw.hyeni_notification);
        AudioAttributes audioAttr = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();

        NotificationChannel schedule = new NotificationChannel(
                CHANNEL_SCHEDULE,
                "Schedule notifications",
                NotificationManager.IMPORTANCE_DEFAULT
        );
        schedule.setDescription("General schedule and reminder notifications");
        schedule.enableVibration(false);
        schedule.setSound(sound, audioAttr);
        schedule.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        schedule.setShowBadge(true);
        nm.createNotificationChannel(schedule);

        NotificationChannel emergency = new NotificationChannel(
                CHANNEL_EMERGENCY,
                "Emergency alerts",
                NotificationManager.IMPORTANCE_HIGH
        );
        emergency.setDescription("Full-screen emergency alerts");
        emergency.enableVibration(true);
        emergency.setVibrationPattern(new long[]{0, 300, 120, 300, 120, 600});
        emergency.setSound(sound, audioAttr);
        emergency.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        emergency.setShowBadge(true);
        emergency.setBypassDnd(true);
        nm.createNotificationChannel(emergency);

        NotificationChannel kkuk = new NotificationChannel(
                CHANNEL_KKUK,
                "Kkuk notifications",
                NotificationManager.IMPORTANCE_DEFAULT
        );
        kkuk.setDescription("General kkuk notifications");
        kkuk.enableVibration(true);
        kkuk.setVibrationPattern(new long[]{0, 120, 80, 120});
        kkuk.setSound(sound, audioAttr);
        kkuk.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        kkuk.setShowBadge(true);
        nm.createNotificationChannel(kkuk);
    }

    public static int stableRequestCode(String stableId) {
        if (stableId == null || stableId.trim().isEmpty()) {
            return 20_000;
        }
        return 20_000 + Math.floorMod(stableId.hashCode(), 1_000_000_000);
    }

    public static void showNotification(
            Context context,
            String title,
            String body,
            String channel,
            boolean wakeScreen,
            boolean fullScreen,
            int notificationId
    ) {
        createChannels(context);

        int requestCode = Math.max(1, notificationId);
        if (isDuplicate(context, requestCode)) {
            return;
        }

        Uri sound = Uri.parse("android.resource://" + context.getPackageName() + "/" + R.raw.hyeni_notification);
        boolean emergency = "emergency".equals(channel) || fullScreen;
        boolean kkuk = "kkuk".equals(channel);

        if (wakeScreen) {
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isInteractive()) {
                @SuppressWarnings("deprecation")
                PowerManager.WakeLock wl = pm.newWakeLock(
                        PowerManager.FULL_WAKE_LOCK
                                | PowerManager.ACQUIRE_CAUSES_WAKEUP
                                | PowerManager.ON_AFTER_RELEASE,
                        "hyeni:notification_wake"
                );
                wl.acquire(15_000);
            }
        }

        Intent contentIntent = new Intent(context, MainActivity.class);
        contentIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        contentIntent.putExtra("fromPush", true);
        PendingIntent contentPi = PendingIntent.getActivity(
                context,
                requestCode,
                contentIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent alertIntent = new Intent(context, PushAlertActivity.class);
        alertIntent.putExtra("title", title);
        alertIntent.putExtra("body", body);
        PendingIntent fullScreenPi = PendingIntent.getActivity(
                context,
                requestCode + 10_000,
                alertIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String channelId;
        switch (channel) {
            case "emergency":
                channelId = CHANNEL_EMERGENCY;
                break;
            case "kkuk":
                channelId = CHANNEL_KKUK;
                break;
            default:
                channelId = CHANNEL_SCHEDULE;
                break;
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
                .setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(emergency ? NotificationCompat.PRIORITY_MAX : NotificationCompat.PRIORITY_DEFAULT)
                .setCategory(emergency
                        ? NotificationCompat.CATEGORY_ALARM
                        : (kkuk ? NotificationCompat.CATEGORY_MESSAGE : NotificationCompat.CATEGORY_REMINDER))
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setContentIntent(contentPi)
                .setWhen(System.currentTimeMillis());

        if (emergency) {
            builder.setVibrate(new long[]{0, 300, 120, 300, 120, 600});
        } else if (kkuk) {
            builder.setVibrate(new long[]{0, 120, 80, 120});
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            builder.setSound(sound);
        }

        if (fullScreen) {
            builder.setFullScreenIntent(fullScreenPi, true);
        }

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(requestCode, builder.build());
        }
    }

    private static boolean isDuplicate(Context context, int notificationId) {
        long now = System.currentTimeMillis();
        SharedPreferences prefs = context.getSharedPreferences(DEDUPE_PREFS_NAME, Context.MODE_PRIVATE);
        String key = "n_" + notificationId;
        long lastShownAt = prefs.getLong(key, 0L);
        if (lastShownAt > 0L && now - lastShownAt < DEDUPE_WINDOW_MS) {
            return true;
        }
        prefs.edit().putLong(key, now).apply();
        return false;
    }
}
