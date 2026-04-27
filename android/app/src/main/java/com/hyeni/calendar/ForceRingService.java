package com.hyeni.calendar;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

public class ForceRingService extends Service {
    public static final String EXTRA_EVENT_ID = "event_id";
    public static final String EXTRA_MESSAGE = "message";
    public static final String EXTRA_INITIATOR = "initiator_name";
    public static final int NOTIF_ID = 7301;
    private static final long HARD_CAP_MS = 15_000L;
    private static final String TAG = "ForceRingService";

    private MediaPlayer mediaPlayer;
    private Vibrator vibrator;
    private AudioManager audioManager;
    private int originalAlarmVolume = -1;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable autoStop = this::stopSelf;
    private String currentEventId;

    @Nullable
    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
        currentEventId = intent.getStringExtra(EXTRA_EVENT_ID);
        String message = intent.getStringExtra(EXTRA_MESSAGE);
        String initiator = intent.getStringExtra(EXTRA_INITIATOR);

        ForceRingRequestStore.markLauncherShown(this, currentEventId);
        NotificationHelper.ensureForceRingChannel(this);

        Intent activityIntent = new Intent(this, ForceRingActivity.class);
        activityIntent.putExtra(EXTRA_EVENT_ID, currentEventId);
        activityIntent.putExtra(EXTRA_MESSAGE, message);
        activityIntent.putExtra(EXTRA_INITIATOR, initiator);
        activityIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_NO_HISTORY);

        PendingIntent fullScreenPI = PendingIntent.getActivity(
                this, 0, activityIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        int iconRes = getApplicationInfo().icon != 0
                ? getApplicationInfo().icon
                : android.R.drawable.ic_dialog_alert;

        Notification notif = new NotificationCompat.Builder(this, NotificationHelper.FORCE_RING_CHANNEL_ID)
                .setSmallIcon(iconRes)
                .setContentTitle("응급 신호: " + (initiator != null ? initiator : "부모님"))
                .setContentText(message != null ? message : "")
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setFullScreenIntent(fullScreenPI, true)
                .setOngoing(true)
                .setAutoCancel(false)
                .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIF_ID, notif);
        }

        playAlarm();
        startVibration();
        handler.postDelayed(autoStop, HARD_CAP_MS);

        return START_NOT_STICKY;
    }

    private void playAlarm() {
        try {
            audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
            if (audioManager != null) {
                try {
                    originalAlarmVolume = audioManager.getStreamVolume(AudioManager.STREAM_ALARM);
                    int max = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM);
                    audioManager.setStreamVolume(AudioManager.STREAM_ALARM, max, 0);
                } catch (SecurityException volumeBlocked) {
                    android.util.Log.w(TAG, "Cannot raise alarm volume (DND policy)", volumeBlocked);
                }
            }

            Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (alarmUri == null) {
                alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }
            if (alarmUri == null) {
                android.util.Log.e(TAG, "No system alarm/notification ringtone available");
                return;
            }

            AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();

            mediaPlayer = new MediaPlayer();
            mediaPlayer.setAudioAttributes(attrs);
            mediaPlayer.setDataSource(this, alarmUri);
            mediaPlayer.setLooping(true);
            mediaPlayer.prepare();
            mediaPlayer.start();
        } catch (Exception e) {
            android.util.Log.e(TAG, "Failed to play alarm", e);
        }
    }

    private void startVibration() {
        vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        if (vibrator == null || !vibrator.hasVibrator()) return;
        long[] pattern = { 0, 1000, 500, 1000, 500, 1000 };
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
            } else {
                vibrator.vibrate(pattern, 0);
            }
        } catch (Exception e) {
            android.util.Log.w(TAG, "Vibration failed", e);
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        handler.removeCallbacks(autoStop);
        if (mediaPlayer != null) {
            try { mediaPlayer.stop(); mediaPlayer.release(); } catch (Exception ignored) {}
            mediaPlayer = null;
        }
        if (audioManager != null && originalAlarmVolume >= 0) {
            try {
                audioManager.setStreamVolume(AudioManager.STREAM_ALARM, originalAlarmVolume, 0);
            } catch (Exception ignored) {}
        }
        if (vibrator != null) {
            try { vibrator.cancel(); } catch (Exception ignored) {}
        }

        sendBroadcast(new Intent("com.hyeni.calendar.FORCE_RING_STOP")
                .setPackage(getPackageName()));
    }
}
