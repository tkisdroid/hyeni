package com.hyeni.calendar;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import com.google.firebase.messaging.FirebaseMessaging;

@CapacitorPlugin(
    name = "BackgroundLocation",
    permissions = {
        @Permission(strings = { Manifest.permission.ACCESS_FINE_LOCATION }, alias = "location"),
        @Permission(strings = { Manifest.permission.ACCESS_COARSE_LOCATION }, alias = "coarseLocation"),
        @Permission(strings = { Manifest.permission.ACCESS_BACKGROUND_LOCATION }, alias = "backgroundLocation")
    }
)
public class LocationPlugin extends Plugin {

    private static final String TAG = "LocationPlugin";

    @PluginMethod
    public void startService(PluginCall call) {
        String userId = call.getString("userId");
        String familyId = call.getString("familyId");
        String supabaseUrl = call.getString("supabaseUrl");
        String supabaseKey = call.getString("supabaseKey");
        String accessToken = call.getString("accessToken", "");
        String role = call.getString("role", "child");

        if (userId == null || familyId == null) {
            call.reject("userId and familyId are required");
            return;
        }

        // Save role to SharedPreferences for LocationService
        getContext().getSharedPreferences("hyeni_location_prefs", android.content.Context.MODE_PRIVATE)
            .edit().putString("role", role).apply();

        // Check fine location permission first
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            // Save call and request permission
            bridge.saveCall(call);
            requestAllPermissions(call, "onLocationPermissionResult");
            return;
        }

        // If we have fine location, also request background (Android 10+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(getActivity(),
                new String[]{ Manifest.permission.ACCESS_BACKGROUND_LOCATION }, 2001);
        }

        launchService(userId, familyId, supabaseUrl, supabaseKey, accessToken);
        call.resolve(new JSObject().put("status", "started"));
    }

    @PluginMethod
    public void requestCurrentLocation(PluginCall call) {
        String userId = call.getString("userId");
        String familyId = call.getString("familyId");
        String supabaseUrl = call.getString("supabaseUrl");
        String supabaseKey = call.getString("supabaseKey");
        String accessToken = call.getString("accessToken", "");
        String role = call.getString("role", "child");

        if (userId == null || familyId == null) {
            call.reject("userId and familyId are required");
            return;
        }

        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            call.reject("Location permission denied");
            return;
        }

        getContext().getSharedPreferences("hyeni_location_prefs", android.content.Context.MODE_PRIVATE)
            .edit().putString("role", role).apply();

        launchRefresh(userId, familyId, supabaseUrl, supabaseKey, accessToken);
        call.resolve(new JSObject().put("status", "refresh_requested"));
    }

    @PermissionCallback
    private void onLocationPermissionResult(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED) {
            String userId = call.getString("userId");
            String familyId = call.getString("familyId");
            String supabaseUrl = call.getString("supabaseUrl");
            String supabaseKey = call.getString("supabaseKey");
            String accessToken = call.getString("accessToken", "");

            // Also request background location (Android 10+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ActivityCompat.requestPermissions(getActivity(),
                    new String[]{ Manifest.permission.ACCESS_BACKGROUND_LOCATION }, 2001);
            }

            launchService(userId, familyId, supabaseUrl, supabaseKey, accessToken);
            call.resolve(new JSObject().put("status", "started"));
        } else {
            call.reject("Location permission denied");
        }
    }

    private void launchService(String userId, String familyId, String supabaseUrl, String supabaseKey, String accessToken) {
        String role = getContext().getSharedPreferences("hyeni_location_prefs", android.content.Context.MODE_PRIVATE)
            .getString("role", "child");
        Intent intent = new Intent(getContext(), LocationService.class);
        intent.putExtra("userId", userId);
        intent.putExtra("familyId", familyId);
        intent.putExtra("supabaseUrl", supabaseUrl);
        intent.putExtra("supabaseKey", supabaseKey);
        intent.putExtra("accessToken", accessToken);
        intent.putExtra("role", role);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
        Log.i(TAG, "Location service launched");
    }

    private void launchRefresh(String userId, String familyId, String supabaseUrl, String supabaseKey, String accessToken) {
        String role = getContext().getSharedPreferences("hyeni_location_prefs", android.content.Context.MODE_PRIVATE)
            .getString("role", "child");
        Intent intent = new Intent(getContext(), LocationService.class);
        intent.setAction("REFRESH_NOW");
        intent.putExtra("userId", userId);
        intent.putExtra("familyId", familyId);
        intent.putExtra("supabaseUrl", supabaseUrl);
        intent.putExtra("supabaseKey", supabaseKey);
        intent.putExtra("accessToken", accessToken);
        intent.putExtra("role", role);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
        Log.i(TAG, "Immediate location refresh requested");
    }

    @PluginMethod
    public void stopService(PluginCall call) {
        Intent intent = new Intent(getContext(), LocationService.class);
        intent.setAction("STOP");
        getContext().startService(intent);
        call.resolve(new JSObject().put("status", "stopped"));
    }

    @PluginMethod
    public void updateToken(PluginCall call) {
        String newToken = call.getString("accessToken");
        if (newToken == null || newToken.isEmpty()) {
            call.reject("accessToken is required");
            return;
        }
        // Write to SharedPreferences so LocationService picks it up on next refresh cycle
        getContext()
            .getSharedPreferences("hyeni_location_prefs", android.content.Context.MODE_PRIVATE)
            .edit()
            .putString("accessToken", newToken)
            .apply();
        Log.i(TAG, "Access token updated via bridge");
        call.resolve(new JSObject().put("status", "updated"));
    }

    @PluginMethod
    public void getFcmToken(PluginCall call) {
        // First check SharedPreferences (set by MyFirebaseMessagingService.onNewToken)
        String cached = getContext()
            .getSharedPreferences("hyeni_location_prefs", android.content.Context.MODE_PRIVATE)
            .getString("fcmToken", null);

        if (cached != null && !cached.isEmpty()) {
            call.resolve(new JSObject().put("token", cached));
            return;
        }

        // Otherwise fetch from Firebase SDK
        FirebaseMessaging.getInstance().getToken()
            .addOnSuccessListener(token -> {
                getContext()
                    .getSharedPreferences("hyeni_location_prefs", android.content.Context.MODE_PRIVATE)
                    .edit()
                    .putString("fcmToken", token)
                    .apply();
                call.resolve(new JSObject().put("token", token));
            })
            .addOnFailureListener(e -> {
                Log.e(TAG, "Failed to get FCM token: " + e.getMessage());
                call.reject("Failed to get FCM token");
            });
    }

    @PluginMethod
    public void setPushContext(PluginCall call) {
        String userId = call.getString("userId");
        String familyId = call.getString("familyId");
        String supabaseUrl = call.getString("supabaseUrl");
        String supabaseKey = call.getString("supabaseKey");
        String accessToken = call.getString("accessToken", "");

        if (userId == null || familyId == null || supabaseUrl == null || supabaseKey == null) {
            call.reject("userId, familyId, supabaseUrl, supabaseKey are required");
            return;
        }

        getContext()
            .getSharedPreferences("hyeni_location_prefs", android.content.Context.MODE_PRIVATE)
            .edit()
            .putString("userId", userId)
            .putString("familyId", familyId)
            .putString("supabaseUrl", supabaseUrl)
            .putString("supabaseKey", supabaseKey)
            .putString("accessToken", accessToken)
            .apply();

        Log.i(TAG, "Push context saved for user=" + userId + ", family=" + familyId);
        call.resolve(new JSObject().put("status", "saved"));
    }

    @PluginMethod
    public void isRunning(PluginCall call) {
        boolean enabled = getContext()
            .getSharedPreferences("hyeni_location_prefs", android.content.Context.MODE_PRIVATE)
            .getBoolean("serviceEnabled", false);
        call.resolve(new JSObject().put("running", enabled));
    }

    @PluginMethod
    public void checkBackgroundLocationPermission(PluginCall call) {
        boolean fineGranted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
        boolean backgroundGranted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            backgroundGranted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                    == PackageManager.PERMISSION_GRANTED;
        }
        JSObject result = new JSObject();
        result.put("fineLocation", fineGranted);
        result.put("backgroundLocation", backgroundGranted);
        call.resolve(result);
    }

    @PluginMethod
    public void openAppLocationSettings(PluginCall call) {
        try {
            Intent intent = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(android.net.Uri.fromParts("package", getContext().getPackageName(), null));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve(new JSObject().put("status", "opened"));
        } catch (Exception e) {
            call.reject("Cannot open settings: " + e.getMessage());
        }
    }
}
