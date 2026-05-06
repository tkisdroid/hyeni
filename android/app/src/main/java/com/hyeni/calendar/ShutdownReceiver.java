package com.hyeni.calendar;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.TimeUnit;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

// Phase 0-A: 시스템 종료(ACTION_SHUTDOWN) 직전, LocationService 가 영속화한
// 마지막 좌표를 읽어 Supabase 에 final upload 를 시도한다.
//
// ACTION_SHUTDOWN 은 일반 BroadcastReceiver 에 수 초 단위 짧은 윈도우만 허용하므로
// 동기 HTTP POST + 2s 타임아웃 으로 fire-and-forget. 실패해도 무시.
public class ShutdownReceiver extends BroadcastReceiver {

    private static final String TAG = "ShutdownReceiver";
    private static final String PREFS_NAME = "hyeni_location_prefs";
    private static final String LAST_LAT = "last_uploaded_lat";
    private static final String LAST_LNG = "last_uploaded_lng";
    private static final String LAST_AT_MS = "last_uploaded_at_ms";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : null;
        if (!Intent.ACTION_SHUTDOWN.equals(action)
                && !"android.intent.action.QUICKBOOT_POWEROFF".equals(action)) {
            return;
        }

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean enabled = prefs.getBoolean("serviceEnabled", false);
        String userId = prefs.getString("userId", null);
        String supabaseUrl = prefs.getString("supabaseUrl", null);
        String supabaseKey = prefs.getString("supabaseKey", null);
        String accessToken = prefs.getString("accessToken", null);
        String latStr = prefs.getString(LAST_LAT, null);
        String lngStr = prefs.getString(LAST_LNG, null);
        long capturedAtMs = prefs.getLong(LAST_AT_MS, 0L);

        if (!enabled || userId == null || supabaseUrl == null || supabaseKey == null
                || latStr == null || lngStr == null || capturedAtMs <= 0) {
            Log.i(TAG, "shutdown skipped: missing context or no cached location");
            return;
        }

        try {
            double lat = Double.parseDouble(latStr);
            double lng = Double.parseDouble(lngStr);

            JSONObject body = new JSONObject();
            body.put("user_id", userId);
            body.put("latitude", lat);
            body.put("longitude", lng);
            body.put("captured_at", formatIsoUtc(capturedAtMs));
            body.put("source", "shutdown");
            body.put("is_final_before_shutdown", true);

            String bearer = (accessToken != null && !accessToken.isEmpty()) ? accessToken : supabaseKey;
            OkHttpClient client = new OkHttpClient.Builder()
                    .connectTimeout(2, TimeUnit.SECONDS)
                    .readTimeout(2, TimeUnit.SECONDS)
                    .writeTimeout(2, TimeUnit.SECONDS)
                    .build();
            Request req = new Request.Builder()
                    .url(supabaseUrl + "/rest/v1/locations")
                    .header("apikey", supabaseKey)
                    .header("Authorization", "Bearer " + bearer)
                    .header("Content-Type", "application/json")
                    .header("Prefer", "resolution=merge-duplicates")
                    .post(RequestBody.create(body.toString(), MediaType.get("application/json")))
                    .build();
            try (Response res = client.newCall(req).execute()) {
                Log.i(TAG, "shutdown final upload result=" + res.code());
            }
        } catch (Exception e) {
            Log.w(TAG, "shutdown final upload failed", e);
        }
    }

    private static String formatIsoUtc(long timeMs) {
        SimpleDateFormat iso = new SimpleDateFormat(
                "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        iso.setTimeZone(TimeZone.getTimeZone("UTC"));
        return iso.format(new Date(timeMs));
    }
}
