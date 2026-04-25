package com.hyeni.calendar;

import android.Manifest;
import android.app.ActivityOptions;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.location.Location;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.RingtoneManager;
import android.os.Build;
import android.os.BatteryManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import com.google.android.gms.tasks.CancellationTokenSource;

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
import okhttp3.Protocol;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class LocationService extends Service {

    private static final String TAG = "LocationService";
    private static final String CHANNEL_ID = "hyeni_location_v4";
    private static final String ALERT_CHANNEL_ID = NotificationHelper.CHANNEL_EMERGENCY;
    private static final String REMOTE_LISTEN_CHANNEL_ID = "hyeni_remote_listen";
    public static final String ACTION_REFRESH_NOW = "REFRESH_NOW";
    private static final int NOTIFICATION_ID = 9001;
    private static final int ALERT_NOTIFICATION_BASE = 10000;
    private static final long NOTIF_POLL_INTERVAL_MS = 15_000;
    private static final long EVENT_CHECK_INTERVAL_MS = 30_000; // check events every 30s
    private static final String PREFS_NAME = "hyeni_location_prefs";

    // Location tracking constants
    private static final long LOCATION_INTERVAL_MOVING_MS = 5_000;
    private static final long LOCATION_INTERVAL_STATIONARY_MS = 15_000;
    private static final float STATIONARY_THRESHOLD_M = 15f;  // 15m 이내 이동 = 정지로 간주
    private static final long STATIONARY_WINDOW_MS = 60_000; // 60초 동안 정지 시 저전력 모드
    private static final float MIN_UPLOAD_DISTANCE_M = 2f;
    private static final float MIN_UPDATE_DISTANCE_M = 0f;
    private static final float MAX_ACCURACY_M = 100f;
    private static final long MAX_UPLOAD_AGE_MS = 15_000L;
    private static final int LOW_BATTERY_THRESHOLD_PERCENT = 5;
    private static final long LOW_BATTERY_CHECK_INTERVAL_MS = 60_000L;
    private static final long LOW_BATTERY_SAVE_INTERVAL_MS = 5 * 60_000L;

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
    private Runnable lowBatteryRunnable;
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
    private long lastUploadedAtMs = 0L;
    private long lastLowBatterySaveAtMs = 0L;

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
            .protocols(Collections.singletonList(Protocol.HTTP_1_1))
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
        boolean refreshNow = intent != null && ACTION_REFRESH_NOW.equals(intent.getAction());

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

        // 위치 권한 체크 — 없으면 서비스 시작하지 않음 (SDK 34+ FGS 크래시 방지)
        if (androidx.core.content.ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION)
                != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            Log.w(TAG, "Location permission not granted, cannot start foreground service");
            stopSelf();
            return START_NOT_STICKY;
        }

        try {
            startForeground(NOTIFICATION_ID, buildForegroundNotification());
        } catch (SecurityException e) {
            Log.e(TAG, "Cannot start foreground service: " + e.getMessage());
            stopSelf();
            return START_NOT_STICKY;
        }
        requestBatteryOptimizationExemption();
        ServiceKeepAlive.schedule(this);
        startLocationTracking();
        startLowBatteryLocationSafeguard();
        startNotificationPolling();
        startEventTimeChecking();
        startTokenRefresh();
        if (refreshNow) {
            Log.i(TAG, "REFRESH_NOW received, requesting immediate high-accuracy fix");
            requestImmediateLocationFix();
        }

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

    private void startLowBatteryLocationSafeguard() {
        if (lowBatteryRunnable != null) return;

        lowBatteryRunnable = new Runnable() {
            @Override
            public void run() {
                checkLowBatteryAndSaveLocation();
                handler.postDelayed(this, LOW_BATTERY_CHECK_INTERVAL_MS);
            }
        };
        handler.post(lowBatteryRunnable);
        Log.i(TAG, "Low battery location safeguard started");
    }

    private void checkLowBatteryAndSaveLocation() {
        int batteryPercent = getBatteryPercent();
        if (batteryPercent < 0 || batteryPercent > LOW_BATTERY_THRESHOLD_PERCENT) return;

        long now = System.currentTimeMillis();
        if (now - lastLowBatterySaveAtMs < LOW_BATTERY_SAVE_INTERVAL_MS) return;
        lastLowBatterySaveAtMs = now;

        Log.w(TAG, "Battery is " + batteryPercent + "%, forcing last location save");
        requestImmediateLocationFix();
    }

    private int getBatteryPercent() {
        Intent battery = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        if (battery == null) return -1;

        int level = battery.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
        int scale = battery.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
        if (level < 0 || scale <= 0) return -1;
        return Math.round((level * 100f) / scale);
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

        int priority = Priority.PRIORITY_HIGH_ACCURACY;
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
                handleLocation(result.getLastLocation(), false);
            }
        };

        try {
            fusedClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper());
            requestImmediateLocationFix();
            Log.i(TAG, "Location tracking started (HIGH_ACCURACY, "
                + (LOCATION_INTERVAL_MOVING_MS / 1000) + "s interval, "
                + (int) MIN_UPDATE_DISTANCE_M + "m min distance)");
        } catch (SecurityException e) {
            Log.e(TAG, "Location permission not granted", e);
        }
    }

    private void requestImmediateLocationFix() {
        try {
            CancellationTokenSource tokenSource = new CancellationTokenSource();
            fusedClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, tokenSource.getToken())
                .addOnSuccessListener(location -> {
                    if (location != null) {
                        handleLocation(location, true);
                    } else {
                        requestLastKnownLocationUpload("current_location_null");
                    }
                })
                .addOnFailureListener(error -> {
                    Log.w(TAG, "Immediate location request failed", error);
                    requestLastKnownLocationUpload("current_location_failed");
                });
        } catch (SecurityException e) {
            Log.e(TAG, "Location permission not granted for immediate fix", e);
        }
    }

    private void requestLastKnownLocationUpload(String reason) {
        try {
            fusedClient.getLastLocation()
                .addOnSuccessListener(location -> {
                    if (location == null) {
                        Log.w(TAG, "Last known location unavailable after " + reason);
                        return;
                    }
                    Log.i(TAG, "Uploading last known location after " + reason);
                    handleLocation(location, true);
                })
                .addOnFailureListener(error -> Log.w(TAG, "Last known location request failed", error));
        } catch (SecurityException e) {
            Log.e(TAG, "Location permission not granted for last known location", e);
        }
    }

    private void handleLocation(Location location, boolean forceUpload) {
        if (location == null) return;

        float accuracy = location.getAccuracy();
        if (accuracy > MAX_ACCURACY_M) {
            Log.w(TAG, "Location rejected: accuracy " + String.format("%.0f", accuracy)
                + "m exceeds " + (int) MAX_ACCURACY_M + "m threshold");
            return;
        }

        double rawLat = location.getLatitude();
        double rawLng = location.getLongitude();

        double[] filtered = applyKalmanFilter(rawLat, rawLng, accuracy);
        double lat = filtered[0];
        double lng = filtered[1];

        updateStationaryState(location);

        long now = System.currentTimeMillis();
        if (!forceUpload && !Double.isNaN(lastUploadedLat)) {
            float distFromLast = distanceBetween(lat, lng, lastUploadedLat, lastUploadedLng);
            long ageMs = now - lastUploadedAtMs;
            if (distFromLast < MIN_UPLOAD_DISTANCE_M && ageMs < MAX_UPLOAD_AGE_MS) {
                Log.d(TAG, "Skipping upload: moved "
                    + String.format("%.1f", distFromLast) + "m, age="
                    + (ageMs / 1000) + "s");
                return;
            }
        }

        Log.d(TAG, "Location update: accuracy=" + String.format("%.0f", accuracy)
            + "m, stationary=" + isStationary + ", force=" + forceUpload);
        uploadLocation(lat, lng, accuracy, now);
    }

    private void uploadLocation(double lat, double lng, float accuracy, long capturedAtMs) {
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
                boolean uploaded = false;

                // 1차 시도: 현재 토큰
                Response response = httpClient.newCall(new Request.Builder()
                    .url(url).header("apikey", supabaseKey).header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + bearer)
                    .post(RequestBody.create(bodyStr, jsonType)).build()).execute();
                int code = response.code();
                uploaded = code >= 200 && code < 300;
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
                    uploaded = code2 >= 200 && code2 < 300;
                    retry1.close();

                    if (code2 == 401 || code2 == 403) {
                        // 3차 시도: anon key (SECURITY DEFINER RPC용 최후 폴백)
                        Log.w(TAG, "Retry failed (" + code2 + "), final fallback with apikey");
                        Response retry2 = httpClient.newCall(new Request.Builder()
                            .url(url).header("apikey", supabaseKey).header("Content-Type", "application/json")
                            .header("Authorization", "Bearer " + supabaseKey)
                            .post(RequestBody.create(bodyStr, jsonType)).build()).execute();
                        uploaded = retry2.isSuccessful();
                        if (!uploaded) {
                            Log.e(TAG, "Location upload ALL retries failed: " + retry2.code());
                        } else {
                            Log.i(TAG, "Location uploaded with apikey fallback");
                        }
                        retry2.close();
                    } else if (uploaded) {
                        Log.i(TAG, "Location uploaded with refreshed token");
                    }
                } else if (uploaded) {
                    // 성공
                } else {
                    Log.w(TAG, "Location upload failed: " + code);
                }
                if (uploaded) {
                    lastUploadedLat = lat;
                    lastUploadedLng = lng;
                    lastUploadedAtMs = capturedAtMs;
                    broadcastLocation(lat, lng, accuracy, capturedAtMs);
                }
            } catch (Exception e) {
                Log.e(TAG, "Location upload error", e);
            }
        }).start();
    }

    private void broadcastLocation(double lat, double lng, float accuracy, long capturedAtMs) {
        try {
            java.text.SimpleDateFormat iso = new java.text.SimpleDateFormat(
                "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US);
            iso.setTimeZone(TimeZone.getTimeZone("UTC"));
            String updatedAt = iso.format(new java.util.Date(capturedAtMs));
            JSONObject payload = new JSONObject()
                .put("user_id", userId)
                .put("userId", userId)
                .put("family_id", familyId)
                .put("lat", lat)
                .put("lng", lng)
                .put("accuracy", accuracy)
                .put("updated_at", updatedAt)
                .put("updatedAt", updatedAt)
                .put("source", "native-location");

            JSONObject message = new JSONObject()
                .put("topic", "family-" + familyId)
                .put("event", "child_location")
                .put("payload", payload);

            JSONObject broadcastBody = new JSONObject()
                .put("messages", new JSONArray().put(message));

            String bearer = (accessToken != null && !accessToken.isEmpty()) ? accessToken : supabaseKey;
            boolean sent = postRealtimeBroadcast(broadcastBody, bearer);
            if (!sent && bearer != null && !bearer.equals(supabaseKey)) {
                postRealtimeBroadcast(broadcastBody, supabaseKey);
            }
        } catch (Exception e) {
            Log.e(TAG, "Location broadcast error", e);
        }
    }

    private boolean postRealtimeBroadcast(JSONObject body, String bearerToken) {
        try {
            String token = (bearerToken != null && !bearerToken.isEmpty()) ? bearerToken : supabaseKey;
            Request request = new Request.Builder()
                .url(supabaseUrl.replaceAll("/+$", "") + "/realtime/v1/api/broadcast")
                .header("apikey", supabaseKey)
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + token)
                .post(RequestBody.create(body.toString(), MediaType.get("application/json")))
                .build();

            Response response = httpClient.newCall(request).execute();
            boolean ok = response.isSuccessful();
            if (!ok) {
                Log.w(TAG, "Location broadcast failed: " + response.code());
            }
            response.close();
            return ok;
        } catch (Exception e) {
            Log.w(TAG, "Location broadcast request error", e);
            return false;
        }
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

                    // 보낸 사람 필터링: 내가 보낸 알림은 표시하지 않음
                    JSONObject data = notif.optJSONObject("data");
                    String sender = (data != null) ? data.optString("senderUserId", "") : "";
                    if (sender.equals(userId)) {
                        Log.d(TAG, "Skipping self-sent notification: " + id);
                        continue;
                    }

                    String title = notif.optString("title", "혜니캘린더");
                    String notifBody = notif.optString("body", "");
                    String type = data != null ? data.optString("type", data.optString("action", "schedule")) : "schedule";
                    boolean emergency = isEmergencyNotification(type, data);
                    String stableId = data != null
                        ? data.optString("pushId", data.optString("idempotencyKey", id))
                        : id;
                    if (!isPendingTargetedToThisDevice(data)) {
                        Log.d(TAG, "Skipping pending notification for another device role: " + id);
                        continue;
                    }
                    if ("remote_listen".equals(type)) {
                        if (!startAmbientListenFromPending(data)) {
                            showRemoteListenLauncher(data, stableId);
                        }
                        deliveredIds.put(id);
                        continue;
                    }
                    if ("request_location".equals(type)) {
                        if (shouldHandleLocationRefreshFromPending(data)) {
                            requestImmediateLocationFix();
                            deliveredIds.put(id);
                        }
                        continue;
                    }
                    deliveredIds.put(id);  // 실제 수신한 알림만 delivered 처리
                    showPolledNotification(title, notifBody, type, emergency, stableId);
                }

                if (deliveredIds.length() > 0) {
                    markDelivered(deliveredIds);
                }
            } catch (Exception e) {
                Log.e(TAG, "Notification poll error", e);
            }
        }).start();
    }

    private boolean isPendingTargetedToThisDevice(@Nullable JSONObject data) {
        if (data == null) return true;
        String targetRole = data.optString("targetRole", "");
        if (!isBlank(targetRole)) {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            String role = prefs.getString("role", "");
            if (!isBlank(role) && !targetRole.equalsIgnoreCase(role)) {
                return false;
            }
        }

        String targetUserId = data.optString("targetUserId", "");
        return isBlank(targetUserId) || targetUserId.equals(userId);
    }

    private boolean startAmbientListenFromPending(@Nullable JSONObject data) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            Log.w(TAG, "Remote listen pending start skipped: RECORD_AUDIO permission missing");
            return false;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            Log.i(TAG, "Remote listen pending start skipped on Android 14+: microphone FGS requires foreground UI");
            return false;
        }

        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String role = prefs.getString("role", "");
        if (!isBlank(role) && !"child".equalsIgnoreCase(role)) {
            Log.i(TAG, "Remote listen pending skipped: this device is not child mode");
            return false;
        }

        String requestFamilyId = data != null ? data.optString("familyId", "") : "";
        if (!isBlank(requestFamilyId) && !isBlank(familyId) && !requestFamilyId.equals(familyId)) {
            Log.w(TAG, "Remote listen pending start skipped: family mismatch");
            return false;
        }

        String resolvedFamilyId = firstNonBlank(requestFamilyId, familyId);
        if (isBlank(userId) || isBlank(resolvedFamilyId) || isBlank(supabaseUrl) || isBlank(supabaseKey)) {
            Log.w(TAG, "Remote listen pending start skipped: service context missing");
            return false;
        }

        Intent intent = new Intent(this, AmbientListenService.class);
        intent.setAction(AmbientListenService.ACTION_START);
        intent.putExtra(AmbientListenService.EXTRA_USER_ID, userId);
        intent.putExtra(AmbientListenService.EXTRA_FAMILY_ID, resolvedFamilyId);
        intent.putExtra(AmbientListenService.EXTRA_SUPABASE_URL, supabaseUrl);
        intent.putExtra(AmbientListenService.EXTRA_SUPABASE_KEY, supabaseKey);
        intent.putExtra(AmbientListenService.EXTRA_ACCESS_TOKEN, accessToken != null ? accessToken : "");
        intent.putExtra(AmbientListenService.EXTRA_DURATION_SEC, readRemoteListenDurationSec(data));

        String senderUserId = data != null ? data.optString("senderUserId", "") : "";
        if (!isBlank(senderUserId)) {
            intent.putExtra(AmbientListenService.EXTRA_INITIATOR_USER_ID, senderUserId);
        }
        String requestId = readRemoteListenRequestId(data);
        if (!isBlank(requestId)) {
            intent.putExtra(AmbientListenService.EXTRA_REQUEST_ID, requestId);
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent);
            } else {
                startService(intent);
            }
            Log.i(TAG, "Remote listen native foreground service started from pending notification");
            return true;
        } catch (Exception error) {
            Log.w(TAG, "Remote listen native service start failed from pending notification", error);
            return false;
        }
    }

    private boolean shouldHandleLocationRefreshFromPending(@Nullable JSONObject data) {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String role = prefs.getString("role", "");
        if (!isBlank(role) && !"child".equalsIgnoreCase(role)) {
            Log.i(TAG, "Location refresh pending skipped: this device is not child mode");
            return false;
        }

        String requestFamilyId = data != null ? data.optString("familyId", "") : "";
        if (!isBlank(requestFamilyId) && !isBlank(familyId) && !requestFamilyId.equals(familyId)) {
            Log.w(TAG, "Location refresh pending skipped: family mismatch");
            return false;
        }

        String targetUserId = data != null ? data.optString("targetUserId", data.optString("target_user_id", "")) : "";
        if (!isBlank(targetUserId) && !targetUserId.equals(userId)) {
            Log.i(TAG, "Location refresh pending skipped: target user mismatch");
            return false;
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            Log.w(TAG, "Location refresh pending skipped: ACCESS_FINE_LOCATION permission missing");
            return false;
        }

        return !isBlank(userId) && !isBlank(familyId) && !isBlank(supabaseUrl) && !isBlank(supabaseKey);
    }

    private void showRemoteListenLauncher(@Nullable JSONObject data, String stableId) {
        ensureRemoteListenChannel();

        Intent launchIntent = new Intent(this, RemoteListenActivity.class);
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        launchIntent.putExtra("fromPush", true);
        launchIntent.putExtra("remoteListen", true);
        if (data != null) {
            putIfNotBlank(launchIntent, "familyId", data.optString("familyId", familyId));
            putIfNotBlank(launchIntent, "senderUserId", data.optString("senderUserId", ""));
            putIfNotBlank(launchIntent, "durationSec", data.optString("durationSec", ""));
            putIfNotBlank(launchIntent, "requestId", readRemoteListenRequestId(data));
        } else {
            putIfNotBlank(launchIntent, "familyId", familyId);
        }

        int notificationId = NotificationHelper.stableRequestCode("remote_listen:" + stableId);
        PendingIntent launchPendingIntent = createRemoteListenPendingIntent(
            launchIntent,
            notificationId
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, REMOTE_LISTEN_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_hyeni_notification)
            .setColor(0xFFFF6B9D)
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

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(notificationId, builder.build());
        }
        try {
            launchPendingIntent.send(this, 0, null, null, null, null, remoteListenSendOptions());
        } catch (PendingIntent.CanceledException error) {
            Log.w(TAG, "Remote listen pending wake activity launch failed", error);
        }
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

    private void ensureRemoteListenChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel existing = manager.getNotificationChannel(REMOTE_LISTEN_CHANNEL_ID);
        if (existing != null) return;

        NotificationChannel channel = new NotificationChannel(
            REMOTE_LISTEN_CHANNEL_ID,
            "원격 듣기 연결",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.enableVibration(false);
        channel.setSound(null, null);
        channel.setBypassDnd(false);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }

    private void putIfNotBlank(Intent intent, String key, String value) {
        if (!isBlank(value)) {
            intent.putExtra(key, value);
        }
    }

    private int readRemoteListenDurationSec(@Nullable JSONObject data) {
        String raw = data != null ? data.optString("durationSec", "") : "";
        if (isBlank(raw)) return 30;
        try {
            int durationSec = Integer.parseInt(raw);
            if (durationSec < 5) return 30;
            return Math.min(durationSec, 120);
        } catch (NumberFormatException ignored) {
            return 30;
        }
    }

    private String readRemoteListenRequestId(@Nullable JSONObject data) {
        if (data == null) return "";
        return firstNonBlank(
            data.optString("requestId", ""),
            data.optString("pushId", ""),
            data.optString("idempotencyKey", ""),
            data.optString("idempotency_key", "")
        );
    }

    private String firstNonBlank(String... values) {
        if (values == null) return "";
        for (String value : values) {
            if (!isBlank(value)) return value.trim();
        }
        return "";
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
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

                    int diffToStart = evTotalMin - nowTotalMin;

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

                            // ── Parent status alert: only once during the scheduled minute ──
                            String keyStatus = eventId + "-status-" + dateKey;
                            if (diffToStart == 0 && !shownEventNotifs.contains(keyStatus)) {
                                shownEventNotifs.add(keyStatus);
                                if (atLocation) {
                                    sendParentAlert(
                                        "arrived",
                                        "✅ 도착 확인",
                                        emoji + " " + title + "에 잘 도착했어요! (" + time + ")",
                                        "info", eventId
                                    );
                                    Log.i(TAG, "Parent exact-time arrival alert for " + title);
                                } else {
                                    sendParentAlert(
                                        "not_arrived",
                                        "🚨 미도착 긴급 알림",
                                        emoji + " " + title + " 시작 시간인데 아직 도착하지 않았어요 (" + time + ")",
                                        "emergency", eventId
                                    );
                                    Log.i(TAG, "Parent exact-time emergency alert for " + title);
                                }
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
                pushBody.put("alertType", alertType);
                pushBody.put("severity", severity);
                if (eventId != null) pushBody.put("eventId", eventId);

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
    private void showPolledNotification(String title, String body, String type, boolean emergency, String stableId) {
        String channel = emergency ? "emergency" : ("kkuk".equals(type) ? "kkuk" : "schedule");
        int notificationId = NotificationHelper.stableRequestCode(stableId);
        NotificationHelper.showNotification(
            this,
            title,
            body,
            channel,
            emergency,
            emergency,
            notificationId
        );

        Log.i(TAG, "Polled notification: " + title + ", emergency=" + emergency);
    }

    private boolean isEmergencyNotification(String type, @Nullable JSONObject data) {
        if ("emergency".equals(type) || "sos".equals(type)) {
            return true;
        }
        if (data != null && "true".equalsIgnoreCase(data.optString("urgent", "false"))) {
            return true;
        }
        if (!"parent_alert".equals(type)) {
            return false;
        }
        String severity = data != null ? data.optString("severity", "") : "";
        String alertType = data != null ? data.optString("alertType", data.optString("alert_type", "")) : "";
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
                "android.resource://" + getPackageName() + "/" + R.raw.hyeni_notification);
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
        if (lowBatteryRunnable != null) {
            handler.removeCallbacks(lowBatteryRunnable);
            lowBatteryRunnable = null;
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
