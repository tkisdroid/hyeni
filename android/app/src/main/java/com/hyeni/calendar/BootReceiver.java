package com.hyeni.calendar;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver {

    private static final String TAG = "BootReceiver";
    public static final String ACTION_RESTART_LOCATION_SERVICE = "com.hyeni.calendar.action.RESTART_LOCATION_SERVICE";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : null;
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
                || Intent.ACTION_USER_UNLOCKED.equals(action)
                || "android.intent.action.QUICKBOOT_POWERON".equals(action)
                || ACTION_RESTART_LOCATION_SERVICE.equals(action)) {
            SharedPreferences prefs = context.getSharedPreferences("hyeni_location_prefs", Context.MODE_PRIVATE);
            boolean enabled = prefs.getBoolean("serviceEnabled", false);
            String userId = prefs.getString("userId", null);

            if (enabled && userId != null) {
                // 위치 권한 체크 후 서비스 재시작 (권한 없으면 크래시 방지)
                if (androidx.core.content.ContextCompat.checkSelfPermission(context, android.Manifest.permission.ACCESS_FINE_LOCATION)
                        != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    Log.w(TAG, "Location permission not granted, skipping service restart");
                    return;
                }
                Log.i(TAG, "Restart trigger received (" + action + "), restarting location service");
                try {
                    Intent serviceIntent = new Intent(context, LocationService.class);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        context.startForegroundService(serviceIntent);
                    } else {
                        context.startService(serviceIntent);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Failed to restart service: " + e.getMessage());
                }
            }
        }
    }
}
