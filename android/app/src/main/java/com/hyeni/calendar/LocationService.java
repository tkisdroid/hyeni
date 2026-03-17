package com.hyeni.calendar;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.location.Location;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.RingtoneManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Collections;
import java.util.Set;
import java.util.TimeZone;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class LocationService extends Service {

    private static final String TAG = "LocationService";
    private static final String CHANNEL_ID = "hyeni_location_v2";
    private static final String ALERT_CHANNEL_ID = "hyeni_alert_v2";
    private static final int NOTIFICATION_ID = 9001;
    private static final int ALERT_NOTIFICATION_BASE = 10000;
    private static final long NOTIF_POLL_INTERVAL_MS = 15_000;
    private static final long EVENT_CHECK_INTERVAL_MS = 30_000; // check events every 30s
    private static final String PREFS_NAME = "hyeni_location_prefs";

    // Location tracking constants
    private static final long LOCATION_INTERVAL_MOVING_MS = 10_000;
    private static final long LOCATION_INTERVAL_STATIONARY_MS = 60_000;
    private static final float STATIONARY_THRESHOLD_M = 15f;  // 15m 이내 이동 = 정지로 간주
    private static final long STATIONARY_WINDOW_MS = 60_000; // 60초 동안 정지 시 저전력 모드
    private static final float MIN_UPLOAD_DISTANCE_M = 5f;
    private static final float MIN_UPDATE_DISTANCE_M = 3f;
    private static final float MAX_ACCURACY_M = 100f;

    // WakeLock: 6 hours with auto-renewal
    private static final long WAKELOCK_TIMEOUT_MS = 6 * 60 * 60 * 1000L;
    private static final long WAKELOCK_RENEW_INTERVAL_MS = 5 * 60 * 60 * 1000L; // renew at 5h

    private FusedLocationProviderClient fusedClient;
    private LocationCallback locationCallback;
    private OkHttpClient httpClient;
    private PowerManager.WakeLock wakeLock;
    private Handler handler;
    private Runnable notifPollRunnable;
    private Runnable eventCheckRunnable;
    private Runnable wakeLockRenewRunnable;
    private Runnable tokenRefreshRunnable;
    private static final long TOKEN_REFRESH_INTERVAL_MS = 50 * 60 * 1000L; // refresh token every 50min (before 60min expiry)
    private final AtomicInteger alertCounter = new AtomicInteger(0);

    // Track which event notifications we already showed (to avoid duplicates)
    private final Set<String> shownEventNotifs = ConcurrentHashMap.newKeySet();

    // ── Auto-silent mode at event locations ──────────────────────────────────────
    private static final float GEOFENCE_RADIUS_M = 80f;
    private static final int SILENT_WINDOW_BEFORE_MIN = 10;  // activate 10min before event
    private static final int SILENT_WINDOW_AFTER_MIN = 180;  // max 3 hours after event start
    private AudioManager audioManager;
    private int savedRingerMode = -1;  // -1 = not saved
    private String silentForEventId = null;
    private double silentEventLat = Double.NaN;
    private double silentEventLng = Double.NaN;

    // Kalman filter state for latitude and longitude
    private boolean kalmanInitialized = false;
    private double kalmanLat;
    private double kalmanLng;
    private double kalmanLatVariance;
    private double kalmanLngVariance;
    private static final double KALMAN_PROCESS_NOISE = 1e-8;

    // Adaptive location interval state
    private boolean isStationary = false;
    private Location stationaryReferenceLocation = null;
    private long stationaryReferenceTime = 0;

    // Last uploaded position for minimum distance filter
    private double lastUploadedLat = Double.NaN;
    private double lastUploadedLng = Double.NaN;

    private String supabaseUrl;
    private String supabaseKey;
    private String userId;
    private String familyId;
    private String accessToken;

    @Override
    public void onCreate() {
        super.onCreate();
        fusedClient = LocationServices.getFusedLocationProviderClient(this);
        httpClient = new OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .build();
        handler = new Handler(Looper.getMainLooper());
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        createNotificationChannels();
        acquireWakeLock();
        startWakeLockRenewal();
        recoverSilentModeIfNeeded();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);

        if (intent != null) {
            if (intent.hasExtra("userId")) {
                userId = intent.getStringExtra("userId");
                familyId = intent.getStringExtra("familyId");
                supabaseUrl = intent.getStringExtra("supabaseUrl");
                supabaseKey = intent.getStringExtra("supabaseKey");
                accessToken = intent.getStringExtra("accessToken");
                String role = intent.getStringExtra("role");

                SharedPreferences.Editor editor = prefs.edit()
                    .putString("userId", userId)
                    .putString("familyId", familyId)
                    .putString("supabaseUrl", supabaseUrl)
                    .putString("supabaseKey", supabaseKey)
                    .putString("accessToken", accessToken)
                    .putBoolean("serviceEnabled", true);
                if (role != null) editor.putString("role", role);
                editor.apply();
            }

            if ("STOP".equals(intent.getAction())) {
                prefs.edit().putBoolean("serviceEnabled", false).apply();
                ServiceKeepAlive.cancel(this);
                cancelAlarmRestart();
                stopAll();
                stopForeground(true);
                stopSelf();
                return START_NOT_STICKY;
            }
        }

        if (userId == null) {
            userId = prefs.getString("userId", null);
            familyId = prefs.getString("familyId", null);
            supabaseUrl = prefs.getString("supabaseUrl", null);
            supabaseKey = prefs.getString("supabaseKey", null);
            accessToken = prefs.getString("accessToken", null);
        }

        if (userId == null || familyId == null || supabaseUrl == null) {
            Log.w(TAG, "Missing config, stopping service");
            stopSelf();
            return START_NOT_STICKY;
        }

        startForeground(NOTIFICATION_ID, buildForegroundNotification());
        requestBatteryOptimizationExemption();
        ServiceKeepAlive.schedule(this);
        startLocationTracking();
        startNotificationPolling();
        startEventTimeChecking();
        startTokenRefresh();

        return START_STICKY;
    }

    // ── WakeLock (6h with auto-renewal) ─────────────────────────────────────────
    private void acquireWakeLock() {
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "hyeni:location_wakelock");
            wakeLock.acquire(WAKELOCK_TIMEOUT_MS);
            Log.i(TAG, "WakeLock acquired (6h timeout)");
        }
    }

    private void renewWakeLock() {
        if (wakeLock != null) {
            if (wakeLock.isHeld()) {
                wakeLock.release();
            }
            wakeLock.acquire(WAKELOCK_TIMEOUT_MS);
            Log.i(TAG, "WakeLock renewed (6h timeout)");
        }
    }

    private void startWakeLockRenewal() {
        wakeLockRenewRunnable = new Runnable() {
            @Override
            public void run() {
                renewWakeLock();
                handler.postDelayed(this, WAKELOCK_RENEW_INTERVAL_MS);
            }
        };
        handler.postDelayed(wakeLockRenewRunnable, WAKELOCK_RENEW_INTERVAL_MS);
        Log.i(TAG, "WakeLock auto-renewal scheduled every 5h");
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
    }

    // ── Battery Optimization Exemption ──────────────────────────────────────────
    @android.annotation.SuppressLint("BatteryLife")
    private void requestBatteryOptimizationExemption() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                try {
                    Intent intent = new Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(android.net.Uri.parse("package:" + getPackageName()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                    Log.i(TAG, "Requesting battery optimization exemption");
                } catch (Exception e) {
                    Log.w(TAG, "Cannot request battery exemption: " + e.getMessage());
                }
            } else {
                Log.i(TAG, "Already exempted from battery optimizations");
            }
        }
    }

    // ── Crash Recovery: restore ringer if app crashed while in silent mode ─────
    private void recoverSilentModeIfNeeded() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        int persistedRinger = prefs.getInt("savedRingerMode", -1);
        String persistedEventId = prefs.getString("silentForEventId", null);
        if (persistedRinger >= 0 && persistedEventId != null && audioManager != null) {
            try {
                audioManager.setRingerMode(persistedRinger);
                Log.i(TAG, "Crash recovery: ringer restored to mode=" + persistedRinger);
            } catch (SecurityException e) {
                Log.w(TAG, "Crash recovery: cannot restore ringer: " + e.getMessage());
            }
            prefs.edit().remove("savedRingerMode").remove("silentForEventId").apply();
        }
    }

    // ── Token Refresh (re-read from SharedPreferences periodically) ─────────────
    private void startTokenRefresh() {
        if (tokenRefreshRunnable != null) return;

        tokenRefreshRunnable = new Runnable() {
            @Override
            public void run() {
                refreshAccessToken();
                handler.postDelayed(this, TOKEN_REFRESH_INTERVAL_MS);
            }
        };
        handler.postDelayed(tokenRefreshRunnable, TOKEN_REFRESH_INTERVAL_MS);
        Log.i(TAG, "Token refresh scheduled every 45min");
    }

    private void refreshAccessToken() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String newToken = prefs.getString("accessToken", null);
        if (newToken != null && !newToken.equals(accessToken)) {
            accessToken = newToken;
            Log.i(TAG, "Access token refreshed from SharedPreferences");
        }
    }

    // ── Kalman Filter ───────────────────────────────────────────────────────────
    private double[] applyKalmanFilter(double lat, double lng, float accuracy) {
        // Convert accuracy (meters) to approximate degree variance
        double accuracyDeg = accuracy / 111_000.0;
        double measurementVariance = accuracyDeg * accuracyDeg;

        if (!kalmanInitialized) {
            kalmanLat = lat;
            kalmanLng = lng;
            kalmanLatVariance = measurementVariance;
            kalmanLngVariance = measurementVariance;
            kalmanInitialized = true;
            return new double[]{lat, lng};
        }

        // Prediction step: add process noise
        kalmanLatVariance += KALMAN_PROCESS_NOISE;
        kalmanLngVariance += KALMAN_PROCESS_NOISE;

        // Update step: compute Kalman gain
        double kLat = kalmanLatVariance / (kalmanLatVariance + measurementVariance);
        double kLng = kalmanLngVariance / (kalmanLngVariance + measurementVariance);

        // Update estimate
        kalmanLat = kalmanLat + kLat * (lat - kalmanLat);
        kalmanLng = kalmanLng + kLng * (lng - kalmanLng);

        // Update variance
        kalmanLatVariance = (1 - kLat) * kalmanLatVariance;
        kalmanLngVariance = (1 - kLng) * kalmanLngVariance;

        return new double[]{kalmanLat, kalmanLng};
    }

    // ── Adaptive Location Mode ──────────────────────────────────────────────────
    private void updateStationaryState(Location location) {
        long now = System.currentTimeMillis();

        if (stationaryReferenceLocation == null) {
            stationaryReferenceLocation = location;
            stationaryReferenceTime = now;
            return;
        }

        float distFromRef = location.distanceTo(stationaryReferenceLocation);

        if (distFromRef > STATIONARY_THRESHOLD_M) {
            // Moved significantly: reset reference and mark as moving
            stationaryReferenceLocation = location;
            stationaryReferenceTime = now;
            if (isStationary) {
                isStationary = false;
                Log.i(TAG, "Motion detected (moved " + String.format("%.1f", distFromRef)
                    + "m), switching to HIGH_ACCURACY mode");
                restartLocationWithMode(false);
            }
            return;
        }

        // Within threshold: check if we've been stationary long enough
        long elapsed = now - stationaryReferenceTime;
        if (elapsed >= STATIONARY_WINDOW_MS && !isStationary) {
            isStationary = true;
            Log.i(TAG, "Stationary detected (moved " + String.format("%.1f", distFromRef)
                + "m in " + (elapsed / 1000) + "s), switching to BALANCED_POWER mode");
            restartLocationWithMode(true);
        }
    }

    private void restartLocationWithMode(boolean lowPower) {
        if (locationCallback == null) return;

        fusedClient.removeLocationUpdates(locationCallback);

        int priority = lowPower
            ? Priority.PRIORITY_BALANCED_POWER_ACCURACY
            : Priority.PRIORITY_HIGH_ACCURACY;
        long interval = lowPower
            ? LOCATION_INTERVAL_STATIONARY_MS
            : LOCATION_INTERVAL_MOVING_MS;

        LocationRequest request = new LocationRequest.Builder(priority, interval)
            .setMinUpdateIntervalMillis(interval / 2)
            .setMinUpdateDistanceMeters(MIN_UPDATE_DISTANCE_M)
            .setWaitForAccurateLocation(false)
            .build();

        try {
            fusedClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper());
            Log.i(TAG, "Location mode switched: priority=" + priority
                + ", interval=" + (interval / 1000) + "s");
        } catch (SecurityException e) {
            Log.e(TAG, "Location permission not granted on mode switch", e);
        }
    }

    // ── Distance Calculation ────────────────────────────────────────────────────
    private float distanceBetween(double lat1, double lng1, double lat2, double lng2) {
        float[] results = new float[1];
        Location.distanceBetween(lat1, lng1, lat2, lng2, results);
        return results[0];
    }

    // ── Location Tracking ───────────────────────────────────────────────────────
    private void startLocationTracking() {
        if (locationCallback != null) return;

        LocationRequest request = new LocationRequest.Builder(
                Priority.PRIORITY_HIGH_ACCURACY, LOCATION_INTERVAL_MOVING_MS)
            .setMinUpdateIntervalMillis(LOCATION_INTERVAL_MOVING_MS / 2)
            .setMinUpdateDistanceMeters(MIN_UPDATE_DISTANCE_M)
            .setWaitForAccurateLocation(false)
            .build();

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult result) {
                if (result == null || result.getLastLocation() == null) return;
                Location location = result.getLastLocation();

                // Reject wildly inaccurate fixes (accuracy > 100m)
                float accuracy = location.getAccuracy();
                if (accuracy > MAX_ACCURACY_M) {
                    Log.w(TAG, "Location rejected: accuracy " + String.format("%.0f", accuracy)
                        + "m exceeds " + (int) MAX_ACCURACY_M + "m threshold");
                    return;
                }

                double rawLat = location.getLatitude();
                double rawLng = location.getLongitude();

                // Apply Kalman filter for GPS smoothing
                double[] filtered = applyKalmanFilter(rawLat, rawLng, accuracy);
                double lat = filtered[0];
                double lng = filtered[1];

                // Update stationary/moving detection for adaptive intervals
                updateStationaryState(location);

                // Only upload if moved more than 5m from last uploaded position
                if (!Double.isNaN(lastUploadedLat)) {
                    float distFromLast = distanceBetween(
                        lat, lng, lastUploadedLat, lastUploadedLng);
                    if (distFromLast < MIN_UPLOAD_DISTANCE_M) {
                        Log.d(TAG, "Skipping upload: moved only "
                            + String.format("%.1f", distFromLast) + "m (< "
                            + (int) MIN_UPLOAD_DISTANCE_M + "m)");
                        return;
                    }
                }

                Log.d(TAG, "Location update: accuracy=" + String.format("%.0f", accuracy)
                    + "m, stationary=" + isStationary);
                lastUploadedLat = lat;
                lastUploadedLng = lng;
                uploadLocation(lat, lng);
            }
        };

        try {
            fusedClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper());
            Log.i(TAG, "Location tracking started (HIGH_ACCURACY, "
                + (LOCATION_INTERVAL_MOVING_MS / 1000) + "s interval, "
                + (int) MIN_UPDATE_DISTANCE_M + "m min distance)");
        } catch (SecurityException e) {
            Log.e(TAG, "Location permission not granted", e);
        }
    }

    private void uploadLocation(double lat, double lng) {
        new Thread(() -> {
            try {
                JSONObject body = new JSONObject();
                body.put("p_user_id", userId);
                body.put("p_family_id", familyId);
                body.put("p_lat", lat);
                body.put("p_lng", lng);

                String url = supabaseUrl + "/rest/v1/rpc/upsert_child_location";
                String bodyStr = body.toString();
                MediaType jsonType = MediaType.get("application/json");
                String bearer = (accessToken != null && !accessToken.isEmpty()) ? accessToken : supabaseKey;

                // 1차 시도: 현재 토큰
                Response response = httpClient.newCall(new Request.Builder()
                    .url(url).header("apikey", supabaseKey).header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + bearer)
                    .post(RequestBody.create(bodyStr, jsonType)).build()).execute();
                int code = response.code();
                response.close();

                if (code == 401 || code == 403) {
                    // 2차 시도: SharedPreferences에서 최신 토큰 재로드
                    refreshAccessToken();
                    String freshToken = (accessToken != null && !accessToken.isEmpty()) ? accessToken : supabaseKey;
                    Log.w(TAG, "Location upload auth failed (" + code + "), retrying with refreshed token");
                    Response retry1 = httpClient.newCall(new Request.Builder()
                        .url(url).header("apikey", supabaseKey).header("Content-Type", "application/json")
                        .header("Authorization", "Bearer " + freshToken)
                        .post(RequestBody.create(bodyStr, jsonType)).build()).execute();
                    int code2 = retry1.code();
                    retry1.close();

                    if (code2 == 401 || code2 == 403) {
                        // 3차 시도: anon key (SECURITY DEFINER RPC용 최후 폴백)
                        Log.w(TAG, "Retry failed (" + code2 + "), final fallback with apikey");
                        Response retry2 = httpClient.newCall(new Request.Builder()
                            .url(url).header("apikey", supabaseKey).header("Content-Type", "application/json")
                            .header("Authorization", "Bearer " + supabaseKey)
                            .post(RequestBody.create(bodyStr, jsonType)).build()).execute();
                        if (!retry2.isSuccessful()) {
                            Log.e(TAG, "Location upload ALL retries failed: " + retry2.code());
                        } else {
                            Log.i(TAG, "Location uploaded with apikey fallback");
                        }
                        retry2.close();
                    } else if (code2 >= 200 && code2 < 300) {
                        Log.i(TAG, "Location uploaded with refreshed token");
                    }
                } else if (code >= 200 && code < 300) {
                    // 성공
                } else {
                    Log.w(TAG, "Location upload failed: " + code);
                }
            } catch (Exception e) {
                Log.e(TAG, "Location upload error", e);
            }
        }).start();
    }

    // ── Notification Polling (instant alerts from parent) ───────────────────────
    private void startNotificationPolling() {
        if (notifPollRunnable != null) return;

        notifPollRunnable = new Runnable() {
            @Override
            public void run() {
                pollForNotifications();
                handler.postDelayed(this, NOTIF_POLL_INTERVAL_MS);
            }
        };
        handler.postDelayed(notifPollRunnable, 5000);
        Log.i(TAG, "Notification polling started");
    }

    private void pollForNotifications() {
        new Thread(() -> {
            try {
                JSONObject body = new JSONObject();
                body.put("p_family_id", familyId);

                String url = supabaseUrl + "/rest/v1/rpc/get_pending_notifications";
                String bearer = (accessToken != null && !accessToken.isEmpty()) ? accessToken : supabaseKey;
                Request req = new Request.Builder()
                    .url(url)
                    .header("apikey", supabaseKey)
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + bearer)
                    .post(RequestBody.create(body.toString(), MediaType.get("application/json")))
                    .build();

                Response response = httpClient.newCall(req).execute();
                if (response.code() == 401 || response.code() == 403) {
                    response.close();
                    refreshAccessToken();
                    Log.w(TAG, "Notification poll auth failed (" + response.code() + "), token refreshed for next cycle");
                    return;
                }
                if (!response.isSuccessful()) {
                    response.close();
                    return;
                }

                String respBody = response.body().string();
                response.close();

                JSONArray notifications = new JSONArray(respBody);
                if (notifications.length() == 0) return;

                Log.i(TAG, "Found " + notifications.length() + " pending notifications");

                JSONArray deliveredIds = new JSONArray();
                for (int i = 0; i < notifications.length(); i++) {
                    JSONObject notif = notifications.getJSONObject(i);
                    String id = notif.getString("id");
                    String title = notif.optString("title", "혜니캘린더");
                    String notifBody = notif.optString("body", "");
                    showHeadsUpNotification(title, notifBody);
                    deliveredIds.put(id);
                }

                markDelivered(deliveredIds);
            } catch (Exception e) {
                Log.e(TAG, "Notification poll error", e);
            }
        }).start();
    }

    private void markDelivered(JSONArray ids) {
        try {
            JSONObject body = new JSONObject();
            body.put("p_ids", ids);

            String url = supabaseUrl + "/rest/v1/rpc/mark_notifications_delivered";
            String bearer = (accessToken != null && !accessToken.isEmpty()) ? accessToken : supabaseKey;
            Request req = new Request.Builder()
                .url(url)
                .header("apikey", supabaseKey)
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + bearer)
                .post(RequestBody.create(body.toString(), MediaType.get("application/json")))
                .build();

            Response response = httpClient.newCall(req).execute();
            response.close();
        } catch (Exception e) {
            Log.e(TAG, "Mark delivered error", e);
        }
    }

    // ── Event Time Checking (15분 전 + 시작 시 알림) ────────────────────────────
    private void startEventTimeChecking() {
        if (eventCheckRunnable != null) return;

        eventCheckRunnable = new Runnable() {
            @Override
            public void run() {
                checkEventTimes();
                handler.postDelayed(this, EVENT_CHECK_INTERVAL_MS);
            }
        };
        handler.postDelayed(eventCheckRunnable, 10000); // first check after 10s
        Log.i(TAG, "Event time checking started (every " + EVENT_CHECK_INTERVAL_MS + "ms)");
    }

    private void checkEventTimes() {
        new Thread(() -> {
            try {
                // Get current time in KST
                Calendar kst = Calendar.getInstance(TimeZone.getTimeZone("Asia/Seoul"));
                int year = kst.get(Calendar.YEAR);
                int month = kst.get(Calendar.MONTH) + 1; // Calendar.MONTH is 0-based, convert to 1-based
                int day = kst.get(Calendar.DAY_OF_MONTH);
                int nowHour = kst.get(Calendar.HOUR_OF_DAY);
                int nowMin = kst.get(Calendar.MINUTE);
                int nowTotalMin = nowHour * 60 + nowMin;

                String dateKey = year + "-" + month + "-" + day;

                // Fetch today's events via RPC
                JSONObject body = new JSONObject();
                body.put("p_family_id", familyId);
                body.put("p_date_key", dateKey);

                String url = supabaseUrl + "/rest/v1/rpc/get_today_events";
                String bearer = (accessToken != null && !accessToken.isEmpty()) ? accessToken : supabaseKey;
                Request req = new Request.Builder()
                    .url(url)
                    .header("apikey", supabaseKey)
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + bearer)
                    .post(RequestBody.create(body.toString(), MediaType.get("application/json")))
                    .build();

                Response response = httpClient.newCall(req).execute();
                if (!response.isSuccessful()) {
                    response.close();
                    return;
                }

                String respBody = response.body().string();
                response.close();

                JSONArray events = new JSONArray(respBody);
                if (events.length() == 0) return;

                // Track whether we're still at the silenced event's location
                boolean stillAtSilentLocation = false;

                for (int i = 0; i < events.length(); i++) {
                    JSONObject ev = events.getJSONObject(i);
                    String eventId = ev.getString("event_id");
                    String title = ev.optString("event_title", "일정");
                    String time = ev.optString("event_time", "00:00");
                    String emoji = ev.optString("event_emoji", "📅");
                    JSONObject location = ev.optJSONObject("event_location");

                    String[] parts = time.split(":");
                    if (parts.length < 2) continue;
                    int evHour, evMin;
                    try {
                        evHour = Integer.parseInt(parts[0].trim());
                        evMin = Integer.parseInt(parts[1].trim());
                    } catch (NumberFormatException nfe) {
                        Log.w(TAG, "Invalid time format: " + time);
                        continue;
                    }
                    int evTotalMin = evHour * 60 + evMin;

                    // Check 15 minutes before — friendly message
                    int diffTo15 = (evTotalMin - 15) - nowTotalMin;
                    String key15 = eventId + "-15min-" + dateKey;
                    if (diffTo15 >= -1 && diffTo15 <= 1 && !shownEventNotifs.contains(key15)) {
                        shownEventNotifs.add(key15);
                        showHeadsUpNotification(
                            "🐰 준비 시간!",
                            emoji + " " + title + " 가기 15분 전이야! 준비물 챙겼니? 🎒 (" + time + ")"
                        );
                        Log.i(TAG, "15min alert for: " + title + " at " + time);
                    }

                    // Check 5 minutes before — friendly message
                    int diffTo5 = (evTotalMin - 5) - nowTotalMin;
                    String key5 = eventId + "-5min-" + dateKey;
                    if (diffTo5 >= -1 && diffTo5 <= 1 && !shownEventNotifs.contains(key5)) {
                        shownEventNotifs.add(key5);
                        showHeadsUpNotification(
                            "🏃 출발!",
                            emoji + " " + title + " 곧 시작이야! 출발~ 화이팅! 💪 (" + time + ")"
                        );
                        Log.i(TAG, "5min alert for: " + title + " at " + time);
                    }

                    // Check at start time — friendly message
                    int diffToStart = evTotalMin - nowTotalMin;
                    String keyStart = eventId + "-start-" + dateKey;
                    if (diffToStart >= -1 && diffToStart <= 1 && !shownEventNotifs.contains(keyStart)) {
                        shownEventNotifs.add(keyStart);
                        showHeadsUpNotification(
                            "⏰ 시작!",
                            emoji + " " + title + " 시작 시간이야! 화이팅! 💪"
                        );
                        Log.i(TAG, "Start alert for: " + title + " at " + time);
                    }

                    // ── Geo-fence checks: auto-silent + parent alerts ────────────
                    if (location != null && !Double.isNaN(lastUploadedLat)) {
                        double evLat = location.optDouble("lat", Double.NaN);
                        double evLng = location.optDouble("lng", Double.NaN);

                        if (!Double.isNaN(evLat) && !Double.isNaN(evLng)) {
                            float distToEvent = distanceBetween(
                                lastUploadedLat, lastUploadedLng, evLat, evLng);
                            boolean inTimeWindow = nowTotalMin >= (evTotalMin - SILENT_WINDOW_BEFORE_MIN)
                                && nowTotalMin <= (evTotalMin + SILENT_WINDOW_AFTER_MIN);
                            boolean atLocation = distToEvent <= GEOFENCE_RADIUS_M;

                            // Currently silenced for this event — check if still there
                            if (eventId.equals(silentForEventId)) {
                                if (atLocation) {
                                    stillAtSilentLocation = true;
                                }
                            }

                            // Activate silent: in time window + at location + not already silent
                            if (inTimeWindow && atLocation && silentForEventId == null) {
                                activateSilentMode(eventId, title, evLat, evLng);
                                stillAtSilentLocation = true;
                            }

                            // ── Parent alert: not departed (5min before, far from location)
                            int diffTo5Before = (evTotalMin - 5) - nowTotalMin;
                            String keyNotDeparted = eventId + "-notdeparted-" + dateKey;
                            if (diffTo5Before >= -1 && diffTo5Before <= 1
                                    && distToEvent > 500f
                                    && !shownEventNotifs.contains(keyNotDeparted)) {
                                shownEventNotifs.add(keyNotDeparted);
                                sendParentAlert(
                                    "late_departure",
                                    "🏃 아직 출발 전이에요",
                                    emoji + " " + title + " 시작 5분 전인데 아직 출발하지 않은 것 같아요 (" + time + ")",
                                    "warning", eventId
                                );
                                Log.i(TAG, "Parent alert: not departed for " + title);
                            }

                            // ── Parent alert: not arrived (10min after start, not at location)
                            int diffAfter10 = nowTotalMin - (evTotalMin + 10);
                            String keyNotArrived = eventId + "-notarrived-" + dateKey;
                            if (diffAfter10 >= 0 && diffAfter10 <= 1
                                    && distToEvent > 200f
                                    && !shownEventNotifs.contains(keyNotArrived)) {
                                shownEventNotifs.add(keyNotArrived);
                                sendParentAlert(
                                    "late_arrival",
                                    "📍 아직 도착 전이에요",
                                    emoji + " " + title + " 시작 10분이 지났는데 아직 도착하지 않은 것 같아요 (" + time + ")",
                                    "warning", eventId
                                );
                                Log.i(TAG, "Parent alert: not arrived for " + title);
                            }

                            // ── Parent alert: arrived on time
                            String keyArrived = eventId + "-arrived-" + dateKey;
                            if (atLocation
                                    && nowTotalMin >= (evTotalMin - 10) && nowTotalMin <= (evTotalMin + 5)
                                    && !shownEventNotifs.contains(keyArrived)) {
                                shownEventNotifs.add(keyArrived);
                                sendParentAlert(
                                    "arrived",
                                    "✅ 정시 도착!",
                                    emoji + " " + title + "에 잘 도착했어요! 👍 (" + time + ")",
                                    "info", eventId
                                );
                                Log.i(TAG, "Parent alert: arrived for " + title);
                            }
                        }
                    }
                }

                // ── Restore ringer if we left the silenced event's location ──────
                if (silentForEventId != null && !stillAtSilentLocation) {
                    restoreRingerMode();
                }

                // Clean up old notification keys (reset at midnight)
                if (nowTotalMin == 0) {
                    shownEventNotifs.clear();
                }

            } catch (Exception e) {
                Log.e(TAG, "Event time check error", e);
            }
        }).start();
    }

    // ── Send alert to parent (stored in DB + push notification) ────────────────
    private void sendParentAlert(String alertType, String title, String message,
                                 String severity, String eventId) {
        new Thread(() -> {
            try {
                JSONObject body = new JSONObject();
                body.put("p_family_id", familyId);
                body.put("p_alert_type", alertType);
                body.put("p_title", title);
                body.put("p_message", message);
                body.put("p_severity", severity);
                if (eventId != null) body.put("p_event_id", eventId);

                String url = supabaseUrl + "/rest/v1/rpc/insert_parent_alert";
                String bearer = (accessToken != null && !accessToken.isEmpty()) ? accessToken : supabaseKey;
                Request req = new Request.Builder()
                    .url(url)
                    .header("apikey", supabaseKey)
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + bearer)
                    .post(RequestBody.create(body.toString(), MediaType.get("application/json")))
                    .build();

                Response response = httpClient.newCall(req).execute();
                if (response.isSuccessful()) {
                    Log.i(TAG, "Parent alert sent: " + alertType + " - " + title);
                } else {
                    Log.w(TAG, "Parent alert failed: " + response.code());
                }
                response.close();

                // Also trigger push notification to parents
                JSONObject pushBody = new JSONObject();
                pushBody.put("action", "parent_alert");
                pushBody.put("familyId", familyId);
                pushBody.put("senderUserId", userId);
                pushBody.put("title", title);
                pushBody.put("message", message);

                String pushUrl = supabaseUrl + "/functions/v1/push-notify";
                Request pushReq = new Request.Builder()
                    .url(pushUrl)
                    .header("apikey", supabaseKey)
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + bearer)
                    .post(RequestBody.create(pushBody.toString(), MediaType.get("application/json")))
                    .build();

                Response pushResp = httpClient.newCall(pushReq).execute();
                pushResp.close();

            } catch (Exception e) {
                Log.e(TAG, "Send parent alert error", e);
            }
        }).start();
    }

    // ── Auto-Silent Mode Control ───────────────────────────────────────────────
    private void activateSilentMode(String eventId, String eventTitle, double lat, double lng) {
        if (audioManager == null) return;
        try {
            savedRingerMode = audioManager.getRingerMode();
            audioManager.setRingerMode(AudioManager.RINGER_MODE_VIBRATE);
            silentForEventId = eventId;
            silentEventLat = lat;
            silentEventLng = lng;

            // Persist saved ringer mode to SharedPreferences for crash recovery
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            prefs.edit()
                .putInt("savedRingerMode", savedRingerMode)
                .putString("silentForEventId", eventId)
                .apply();

            // Schedule a max-timeout safety restore (3 hours)
            handler.postDelayed(() -> {
                if (silentForEventId != null) {
                    Log.w(TAG, "Auto-silent safety timeout reached, restoring ringer");
                    restoreRingerMode();
                }
            }, SILENT_WINDOW_AFTER_MIN * 60 * 1000L);

            // Update foreground notification to show silent status
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                Notification notif = new NotificationCompat.Builder(this, CHANNEL_ID)
                    .setContentTitle("혜니캘린더 🔇")
                    .setContentText("📍 " + eventTitle + " 도착 — 자동 무음 중")
                    .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                    .setOngoing(true)
                    .setPriority(NotificationCompat.PRIORITY_LOW)
                    .build();
                manager.notify(NOTIFICATION_ID, notif);
            }

            Log.i(TAG, "Silent mode ON for: " + eventTitle + " (saved ringer=" + savedRingerMode + ")");
        } catch (SecurityException e) {
            // DND access not granted — reset state so we don't get stuck
            silentForEventId = null;
            savedRingerMode = -1;
            Log.w(TAG, "Cannot set ringer mode (DND access needed): " + e.getMessage());
        }
    }

    private void restoreRingerMode() {
        if (audioManager == null || savedRingerMode < 0) return;
        try {
            audioManager.setRingerMode(savedRingerMode);
            Log.i(TAG, "Ringer restored to mode=" + savedRingerMode
                + " (left event " + silentForEventId + ")");
        } catch (SecurityException e) {
            Log.w(TAG, "Cannot restore ringer mode: " + e.getMessage());
        } finally {
            // Always clear state, even if restore fails
            savedRingerMode = -1;
            silentForEventId = null;
            silentEventLat = Double.NaN;
            silentEventLng = Double.NaN;

            // Clear persisted state
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            prefs.edit()
                .remove("savedRingerMode")
                .remove("silentForEventId")
                .apply();
        }

        // Restore foreground notification
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, buildForegroundNotification());
        }
    }

    // ── Heads-Up Notification (popup) ───────────────────────────────────────────
    private void showHeadsUpNotification(String title, String body) {
        // Wake screen for safety-critical alerts
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null && !pm.isInteractive()) {
            PowerManager.WakeLock screenWake = pm.newWakeLock(
                PowerManager.FULL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                "hyeni:alert_wake"
            );
            screenWake.acquire(15000);
        }

        int currentAlert = alertCounter.incrementAndGet();
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        openIntent.putExtra("fromPush", true);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, currentAlert, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent alertIntent = new Intent(this, PushAlertActivity.class);
        alertIntent.putExtra("title", title);
        alertIntent.putExtra("body", body);
        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
            this, ALERT_NOTIFICATION_BASE + currentAlert, alertIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setVibrate(new long[]{0, 500, 200, 500, 200, 500})
            .setWhen(System.currentTimeMillis())
            .setFullScreenIntent(fullScreenPendingIntent, true);

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.notify(ALERT_NOTIFICATION_BASE + currentAlert, builder.build());
        }

        Log.i(TAG, "Heads-up notification: " + title);
    }

    // ── Notification Channels ───────────────────────────────────────────────────
    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager == null) return;

            NotificationChannel locationChannel = new NotificationChannel(
                CHANNEL_ID, "위치 추적", NotificationManager.IMPORTANCE_LOW);
            locationChannel.setDescription("아이 위치를 부모님께 공유합니다");
            manager.createNotificationChannel(locationChannel);

            // Delete and recreate alert channel to apply new sound
            manager.deleteNotificationChannel(ALERT_CHANNEL_ID);
            android.net.Uri cuteSound = android.net.Uri.parse(
                "android.resource://" + getPackageName() + "/" + R.raw.notif_cute);
            NotificationChannel alertChannel = new NotificationChannel(
                ALERT_CHANNEL_ID, "일정 알림", NotificationManager.IMPORTANCE_HIGH);
            alertChannel.setDescription("일정 알림 + 안전 알림");
            alertChannel.enableVibration(true);
            alertChannel.setVibrationPattern(new long[]{0, 100, 60, 100});
            alertChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            alertChannel.setBypassDnd(true);
            alertChannel.setShowBadge(true);
            alertChannel.setSound(cuteSound,
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            );
            manager.createNotificationChannel(alertChannel);
        }
    }

    // ── Foreground Notification ─────────────────────────────────────────────────
    private Notification buildForegroundNotification() {
        Intent openIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        String role = getSharedPreferences(PREFS_NAME, MODE_PRIVATE).getString("role", "child");
        String statusText = "parent".equals(role)
            ? "아이와 함께하고 있어요 💕"
            : "부모님이 함께하고 있어요 💕";

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("혜니캘린더")
            .setContentText(statusText)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    // ── Cleanup ─────────────────────────────────────────────────────────────────
    private void stopAll() {
        // Restore ringer if silent mode is active
        if (silentForEventId != null) {
            restoreRingerMode();
        }
        if (locationCallback != null) {
            fusedClient.removeLocationUpdates(locationCallback);
            locationCallback = null;
        }
        if (notifPollRunnable != null) {
            handler.removeCallbacks(notifPollRunnable);
            notifPollRunnable = null;
        }
        if (eventCheckRunnable != null) {
            handler.removeCallbacks(eventCheckRunnable);
            eventCheckRunnable = null;
        }
        if (wakeLockRenewRunnable != null) {
            handler.removeCallbacks(wakeLockRenewRunnable);
            wakeLockRenewRunnable = null;
        }
        if (tokenRefreshRunnable != null) {
            handler.removeCallbacks(tokenRefreshRunnable);
            tokenRefreshRunnable = null;
        }
        releaseWakeLock();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        stopAll();
        // Schedule AlarmManager restart if service was not explicitly stopped
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        if (prefs.getBoolean("serviceEnabled", false)) {
            scheduleAlarmRestart();
        }
        super.onDestroy();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        Log.i(TAG, "Task removed, scheduling restart via AlarmManager");
        scheduleAlarmRestart();
        super.onTaskRemoved(rootIntent);
    }

    // ── AlarmManager-based restart (more reliable than startForegroundService in onTaskRemoved) ──
    private static final int ALARM_RESTART_REQUEST_CODE = 9999;

    private void scheduleAlarmRestart() {
        try {
            Intent restartIntent = new Intent(this, BootReceiver.class);
            restartIntent.setAction(BootReceiver.ACTION_RESTART_LOCATION_SERVICE);
            PendingIntent pi = PendingIntent.getBroadcast(
                this, ALARM_RESTART_REQUEST_CODE, restartIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (am != null) {
                long triggerAt = System.currentTimeMillis() + 5000; // restart in 5 seconds
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
                } else {
                    am.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pi);
                }
                Log.i(TAG, "AlarmManager restart scheduled in 5 seconds");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to schedule alarm restart: " + e.getMessage());
        }
    }

    private void cancelAlarmRestart() {
        try {
            Intent restartIntent = new Intent(this, BootReceiver.class);
            restartIntent.setAction(BootReceiver.ACTION_RESTART_LOCATION_SERVICE);
            PendingIntent pi = PendingIntent.getBroadcast(
                this, ALARM_RESTART_REQUEST_CODE, restartIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (am != null) {
                am.cancel(pi);
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to cancel alarm restart: " + e.getMessage());
        }
    }
}
