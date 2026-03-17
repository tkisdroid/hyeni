package com.hyeni.calendar;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

public final class NotificationHelper {

    public static final String CHANNEL_SCHEDULE = "hyeni_schedule_v4";
    public static final String CHANNEL_EMERGENCY = "hyeni_alert_v4";
    public static final String CHANNEL_KKUK = "hyeni_kkuk_v4";
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
            "hyeni_kkuk_v3"
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

        Uri cuteSound = Uri.parse("android.resource://" + context.getPackageName() + "/" + R.raw.hyeni_notification);
        AudioAttributes audioAttr = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();

        // Delete old channels to apply new sound
        nm.deleteNotificationChannel(CHANNEL_SCHEDULE);
        nm.deleteNotificationChannel(CHANNEL_EMERGENCY);
        nm.deleteNotificationChannel(CHANNEL_KKUK);

        NotificationChannel schedule = new NotificationChannel(
                CHANNEL_SCHEDULE, "일정 알림", NotificationManager.IMPORTANCE_HIGH);
        schedule.setDescription("일정 시작 전 알림");
        schedule.enableVibration(true);
        schedule.setVibrationPattern(new long[]{0, 100, 60, 100});
        schedule.setSound(cuteSound, audioAttr);
        schedule.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        schedule.setShowBadge(true);
        nm.createNotificationChannel(schedule);

        NotificationChannel emergency = new NotificationChannel(
                CHANNEL_EMERGENCY, "긴급 알림", NotificationManager.IMPORTANCE_HIGH);
        emergency.setDescription("긴급 알림 (미도착, 안전 등)");
        emergency.enableVibration(true);
        emergency.setVibrationPattern(new long[]{0, 100, 60, 100});
        emergency.setSound(cuteSound, audioAttr);
        emergency.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        emergency.setShowBadge(true);
        emergency.setBypassDnd(true);
        nm.createNotificationChannel(emergency);

        NotificationChannel kkuk = new NotificationChannel(
                CHANNEL_KKUK, "꾹 알림", NotificationManager.IMPORTANCE_HIGH);
        kkuk.setDescription("꾹 긴급 핑");
        kkuk.enableVibration(true);
        kkuk.setVibrationPattern(new long[]{0, 100, 60, 100});
        kkuk.setSound(cuteSound, audioAttr);
        kkuk.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        kkuk.setShowBadge(true);
        kkuk.setBypassDnd(true);
        nm.createNotificationChannel(kkuk);
    }

    public static int stableRequestCode(String stableId) {
        return 20_000 + (stableId == null ? 0 : (stableId.hashCode() & 0x7fffffff));
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

        int requestCode = Math.max(1, notificationId);
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

        long[] vibration = new long[]{0, 100, 60, 100};

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
                .setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setContentIntent(contentPi)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setVibrate(vibration)
                .setWhen(System.currentTimeMillis());

        if (fullScreen || wakeScreen) {
            builder.setFullScreenIntent(fullScreenPi, true);
        }

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(requestCode, builder.build());
        }
    }
}
