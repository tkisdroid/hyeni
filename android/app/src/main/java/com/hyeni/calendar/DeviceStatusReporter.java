package com.hyeni.calendar;

import android.Manifest;
import android.app.ActivityManager;
import android.app.AlarmManager;
import android.app.KeyguardManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.media.AudioManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.BatteryManager;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.net.URLEncoder;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

final class DeviceStatusReporter {
    private static final String TAG = "DeviceStatusReporter";
    private static final String PREFS_NAME = "hyeni_location_prefs";
    private static final String REMOTE_LISTEN_CHANNEL_ID = "hyeni_remote_listen_v2";

    private DeviceStatusReporter() {}

    static boolean publish(
            Context context,
            OkHttpClient httpClient,
            String supabaseUrl,
            String supabaseKey,
            String familyId,
            String userId,
            @Nullable String accessToken,
            @Nullable String requestId,
            @Nullable String requesterUserId
    ) {
        if (isBlank(supabaseUrl) || isBlank(supabaseKey) || isBlank(familyId) || isBlank(userId)) {
            Log.w(TAG, "Device status publish skipped: missing context");
            return false;
        }

        try {
            JSONObject payload = buildPayload(context, familyId, userId, requestId, requesterUserId);
            JSONObject message = new JSONObject()
                .put("topic", "family-" + familyId)
                .put("event", "child_device_status")
                .put("payload", payload);
            JSONObject body = new JSONObject().put("messages", new JSONArray().put(message));

            String baseUrl = supabaseUrl.replaceAll("/+$", "");
            Request request = new Request.Builder()
                .url(baseUrl + "/realtime/v1/api/broadcast")
                .header("apikey", supabaseKey)
                .header("Authorization", "Bearer " + supabaseKey)
                .header("Content-Type", "application/json")
                .post(RequestBody.create(body.toString(), MediaType.get("application/json")))
                .build();

            Response response = httpClient.newCall(request).execute();
            boolean broadcastSuccess = response.isSuccessful();
            if (!broadcastSuccess) {
                Log.w(TAG, "Device status broadcast failed: " + response.code());
            } else {
                Log.i(TAG, "Device status broadcast sent");
            }
            response.close();
            boolean persistSuccess = persistDeviceHealth(httpClient, baseUrl, supabaseKey, accessToken, familyId, userId, payload);
            return broadcastSuccess || persistSuccess;
        } catch (Exception error) {
            Log.w(TAG, "Device status publish error", error);
            return false;
        }
    }

    private static boolean persistDeviceHealth(
            OkHttpClient httpClient,
            String baseUrl,
            String supabaseKey,
            @Nullable String accessToken,
            String familyId,
            String userId,
            JSONObject payload
    ) {
        try {
            String bearer = !isBlank(accessToken) ? accessToken : supabaseKey;
            String query = "?family_id=eq." + URLEncoder.encode(familyId, "UTF-8")
                + "&user_id=eq." + URLEncoder.encode(userId, "UTF-8");
            JSONObject body = new JSONObject().put("device_health", payload);
            Request request = new Request.Builder()
                .url(baseUrl + "/rest/v1/family_members" + query)
                .header("apikey", supabaseKey)
                .header("Authorization", "Bearer " + bearer)
                .header("Content-Type", "application/json")
                .header("Prefer", "return=minimal")
                .patch(RequestBody.create(body.toString(), MediaType.get("application/json")))
                .build();
            Response response = httpClient.newCall(request).execute();
            boolean success = response.isSuccessful();
            if (!success) {
                Log.w(TAG, "Device status persist failed: " + response.code());
            }
            response.close();
            return success;
        } catch (Exception error) {
            Log.w(TAG, "Device status persist error", error);
            return false;
        }
    }

    private static JSONObject buildPayload(
            Context context,
            String familyId,
            String userId,
            @Nullable String requestId,
            @Nullable String requesterUserId
    ) throws Exception {
        long now = System.currentTimeMillis();
        DeviceBattery battery = readBattery(context);
        UsageSnapshot usage = readUsageSnapshot(context);
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        ActivityManager activityManager = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        AudioManager audio = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        KeyguardManager keyguard = (KeyguardManager) context.getSystemService(Context.KEYGUARD_SERVICE);
        Configuration config = context.getResources().getConfiguration();
        ConnectivityHealth connectivity = readConnectivity(context);
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        boolean notificationsEnabled = nm == null || nm.areNotificationsEnabled();
        boolean postPermissionGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
            == PackageManager.PERMISSION_GRANTED;
        boolean batteryOptimizationsIgnored = Build.VERSION.SDK_INT < Build.VERSION_CODES.M
            || pm == null
            || pm.isIgnoringBatteryOptimizations(context.getPackageName());
        boolean powerSaveMode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP
            && pm != null
            && pm.isPowerSaveMode();
        boolean backgroundRestricted = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
            && activityManager != null
            && activityManager.isBackgroundRestricted();
        // Android 14+: NotificationManager.canUseFullScreenIntent gates whether
        // the child can auto-open the foreground bridge from a lock-screen push.
        boolean fullScreenIntentAllowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE
            || nm == null
            || nm.canUseFullScreenIntent();
        boolean exactAlarmAllowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.S
            || am == null
            || am.canScheduleExactAlarms();
        boolean recordAudioGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO)
            == PackageManager.PERMISSION_GRANTED;
        boolean backgroundLocationGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
            || ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
        boolean remoteListenChannelEnabled = isChannelEnabled(nm, REMOTE_LISTEN_CHANNEL_ID);
        int remoteListenChannelImportance = getChannelImportance(nm, REMOTE_LISTEN_CHANNEL_ID);
        boolean remoteListenChannelBlocked = remoteListenChannelImportance == NotificationManager.IMPORTANCE_NONE;
        boolean locationServiceRunning = prefs.getBoolean("serviceEnabled", false);
        String ringerMode = describeRingerMode(audio);
        String dndMode = describeDndMode(nm);
        boolean dndAccess = Build.VERSION.SDK_INT < Build.VERSION_CODES.M
            || nm == null
            || nm.isNotificationPolicyAccessGranted();
        boolean keyguardLocked = keyguard != null && keyguard.isKeyguardLocked();

        JSONObject payload = new JSONObject()
            .put("family_id", familyId)
            .put("user_id", userId)
            .put("updatedAt", formatIsoUtc(now))
            .put("batteryLevel", battery.level != null ? battery.level : JSONObject.NULL)
            .put("isCharging", battery.charging != null ? battery.charging : JSONObject.NULL)
            .put("connectionType", "native")
            .put("appState", "native-background")
            .put("screenInteractive", usage.screenInteractive)
            .put("recentApp", usage.recentAppPackage.isEmpty()
                ? "혜니캘린더 (앱 외 사용기록은 OS 권한 필요)"
                : usage.recentAppPackage)
            .put("usagePermission", usage.usagePermission)
            .put("source", "native-fcm")
            .put("recordAudio", recordAudioGranted)
            .put("postNotif", postPermissionGranted && notificationsEnabled)
            .put("fullScreen", fullScreenIntentAllowed)
            .put("battery", batteryOptimizationsIgnored)
            .put("powerSaveMode", powerSaveMode)
            .put("backgroundRestricted", backgroundRestricted)
            .put("channelOk", remoteListenChannelEnabled)
            .put("remoteListenChannelImportance", remoteListenChannelImportance)
            .put("remoteListenChannelBlocked", remoteListenChannelBlocked)
            .put("locationOk", backgroundLocationGranted)
            .put("recordAudioGranted", recordAudioGranted)
            .put("postPermissionGranted", postPermissionGranted)
            .put("notificationsEnabled", notificationsEnabled)
            .put("fullScreenIntentAllowed", fullScreenIntentAllowed)
            .put("batteryOptimizationsIgnored", batteryOptimizationsIgnored)
            .put("powerSaveMode", powerSaveMode)
            .put("backgroundRestricted", backgroundRestricted)
            .put("exactAlarmAllowed", exactAlarmAllowed)
            .put("backgroundLocationGranted", backgroundLocationGranted)
            .put("remoteListenChannelEnabled", remoteListenChannelEnabled)
            .put("remoteListenChannelImportance", remoteListenChannelImportance)
            .put("remoteListenChannelBlocked", remoteListenChannelBlocked)
            .put("locationServiceRunning", locationServiceRunning)
            .put("ringerMode", ringerMode)
            .put("dndMode", dndMode)
            .put("dndAccess", dndAccess)
            .put("networkConnected", connectivity.connected)
            .put("networkValidated", connectivity.validated)
            .put("keyguardLocked", keyguardLocked)
            .put("screenWidthDp", config.screenWidthDp)
            .put("screenHeightDp", config.screenHeightDp)
            .put("smallestScreenWidthDp", config.smallestScreenWidthDp)
            .put("foldState", inferFoldState(config))
            .put("sdkInt", Build.VERSION.SDK_INT)
            .put("manufacturer", Build.MANUFACTURER)
            .put("model", Build.MODEL)
            .put("ready", notificationsEnabled
                && postPermissionGranted
                && fullScreenIntentAllowed
                && batteryOptimizationsIgnored
                && !powerSaveMode
                && !backgroundRestricted
                && exactAlarmAllowed
                && recordAudioGranted
                && remoteListenChannelEnabled
                && connectivity.connected
                && locationServiceRunning);

        if (!isBlank(requestId)) payload.put("requestId", requestId);
        if (!isBlank(requesterUserId)) payload.put("requesterUserId", requesterUserId);
        return payload;
    }

    private static DeviceBattery readBattery(Context context) {
        Intent batteryStatus = context.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        if (batteryStatus == null) return new DeviceBattery(null, null);

        int level = batteryStatus.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
        int scale = batteryStatus.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
        Integer pct = null;
        if (level >= 0 && scale > 0) {
            pct = Math.round(level * 100f / scale);
        }
        boolean charging = batteryStatus.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) != 0;
        return new DeviceBattery(pct, charging);
    }

    private static UsageSnapshot readUsageSnapshot(Context context) {
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        boolean interactive = pm != null && pm.isInteractive();
        String recentApp = "";
        String usagePermission = "unavailable";

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            UsageStatsManager usm = (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
            if (usm != null) {
                long end = System.currentTimeMillis();
                long start = end - 10 * 60 * 1000L;
                UsageEvents events = usm.queryEvents(start, end);
                if (events != null) {
                    UsageEvents.Event event = new UsageEvents.Event();
                    while (events.hasNextEvent()) {
                        events.getNextEvent(event);
                        if (event.getEventType() == UsageEvents.Event.ACTIVITY_RESUMED && event.getPackageName() != null) {
                            recentApp = event.getPackageName();
                        }
                    }
                }
                usagePermission = recentApp.isEmpty() ? "requires_permission" : "granted";
            }
        }

        return new UsageSnapshot(interactive, recentApp, usagePermission);
    }

    private static boolean isChannelEnabled(@Nullable NotificationManager nm, String channelId) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || nm == null) {
            return true;
        }
        NotificationChannel channel = nm.getNotificationChannel(channelId);
        return channel == null || channel.getImportance() != NotificationManager.IMPORTANCE_NONE;
    }

    private static int getChannelImportance(@Nullable NotificationManager nm, String channelId) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || nm == null) {
            return NotificationManager.IMPORTANCE_DEFAULT;
        }
        NotificationChannel channel = nm.getNotificationChannel(channelId);
        return channel == null ? NotificationManager.IMPORTANCE_DEFAULT : channel.getImportance();
    }

    private static String describeRingerMode(@Nullable AudioManager audio) {
        if (audio == null) return "unknown";
        int mode = audio.getRingerMode();
        if (mode == AudioManager.RINGER_MODE_NORMAL) return "normal";
        if (mode == AudioManager.RINGER_MODE_VIBRATE) return "vibrate";
        if (mode == AudioManager.RINGER_MODE_SILENT) return "silent";
        return "unknown";
    }

    private static String describeDndMode(@Nullable NotificationManager nm) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || nm == null) return "all";
        int filter = nm.getCurrentInterruptionFilter();
        if (filter == NotificationManager.INTERRUPTION_FILTER_ALL) return "all";
        if (filter == NotificationManager.INTERRUPTION_FILTER_PRIORITY) return "priority";
        if (filter == NotificationManager.INTERRUPTION_FILTER_NONE) return "none";
        if (filter == NotificationManager.INTERRUPTION_FILTER_ALARMS) return "alarms";
        return "unknown";
    }

    private static ConnectivityHealth readConnectivity(Context context) {
        ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return new ConnectivityHealth(false, false);
        Network network = cm.getActiveNetwork();
        if (network == null) return new ConnectivityHealth(false, false);
        NetworkCapabilities caps = cm.getNetworkCapabilities(network);
        if (caps == null) return new ConnectivityHealth(false, false);
        boolean connected = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
        boolean validated = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        return new ConnectivityHealth(connected, validated);
    }

    private static String inferFoldState(Configuration config) {
        String model = (Build.MANUFACTURER + " " + Build.MODEL).toLowerCase(Locale.US);
        boolean likelyFoldable = model.contains("fold")
            || model.contains("flip")
            || model.contains("zflip")
            || model.contains("z fold");
        if (!likelyFoldable) return "not_foldable_or_unknown";
        if (config.screenWidthDp >= 600) return "wide_open";
        if (config.smallestScreenWidthDp >= 600 || config.screenWidthDp < 420) {
            return "possibly_folded";
        }
        return "unknown";
    }

    private static String formatIsoUtc(long timeMs) {
        SimpleDateFormat iso = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        iso.setTimeZone(TimeZone.getTimeZone("UTC"));
        return iso.format(new Date(timeMs));
    }

    private static boolean isBlank(@Nullable String value) {
        return value == null || value.trim().isEmpty();
    }

    private static final class DeviceBattery {
        final Integer level;
        final Boolean charging;

        DeviceBattery(@Nullable Integer level, @Nullable Boolean charging) {
            this.level = level;
            this.charging = charging;
        }
    }

    private static final class UsageSnapshot {
        final boolean screenInteractive;
        final String recentAppPackage;
        final String usagePermission;

        UsageSnapshot(boolean screenInteractive, String recentAppPackage, String usagePermission) {
            this.screenInteractive = screenInteractive;
            this.recentAppPackage = recentAppPackage;
            this.usagePermission = usagePermission;
        }
    }

    private static final class ConnectivityHealth {
        final boolean connected;
        final boolean validated;

        ConnectivityHealth(boolean connected, boolean validated) {
            this.connected = connected;
            this.validated = validated;
        }
    }
}
