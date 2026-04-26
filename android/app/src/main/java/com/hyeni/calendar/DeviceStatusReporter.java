package com.hyeni.calendar;

import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.BatteryManager;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.Nullable;

import org.json.JSONArray;
import org.json.JSONObject;

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

    private DeviceStatusReporter() {}

    static boolean publish(
            Context context,
            OkHttpClient httpClient,
            String supabaseUrl,
            String supabaseKey,
            String familyId,
            String userId,
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
            boolean success = response.isSuccessful();
            if (!success) {
                Log.w(TAG, "Device status broadcast failed: " + response.code());
            } else {
                Log.i(TAG, "Device status broadcast sent");
            }
            response.close();
            return success;
        } catch (Exception error) {
            Log.w(TAG, "Device status publish error", error);
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
            .put("source", "native-fcm");

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
}
