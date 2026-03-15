package com.hyeni.calendar;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.WindowManager;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends BridgeActivity {

    private static final int NOTIFICATION_PERMISSION_CODE = 1001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LocationPlugin.class);
        registerPlugin(SpeechPlugin.class);
        registerPlugin(NotificationPlugin.class);
        super.onCreate(savedInstanceState);

        handlePushLaunch(getIntent());
        handleRemoteListen(getIntent());
        requestNotificationPermission();
        primeFcmToken();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handlePushLaunch(intent);
        handleRemoteListen(intent);
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this,
                        new String[]{ Manifest.permission.POST_NOTIFICATIONS },
                        NOTIFICATION_PERMISSION_CODE);
            }
        }
    }

    private void handleRemoteListen(Intent intent) {
        if (intent == null || !intent.getBooleanExtra("remoteListen", false)) return;
        intent.removeExtra("remoteListen"); // consume once
        Log.i("MainActivity", "Remote listen intent - will inject JS flag");
        // Wait for WebView to be ready, then set a flag the web app can check
        getBridge().getWebView().postDelayed(() -> {
            getBridge().getWebView().evaluateJavascript("window.__REMOTE_LISTEN_REQUESTED = true;", null);
        }, 2000);
    }

    private void handlePushLaunch(Intent intent) {
        if (intent == null || !intent.getBooleanExtra("fromPush", false)) {
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                    | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                    | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            );
        }
    }

    private void primeFcmToken() {
        FirebaseMessaging.getInstance().setAutoInitEnabled(true);
        FirebaseMessaging.getInstance().getToken()
            .addOnSuccessListener(token -> {
                if (token == null || token.isEmpty()) {
                    return;
                }

                getSharedPreferences("hyeni_location_prefs", MODE_PRIVATE)
                    .edit()
                    .putString("fcmToken", token)
                    .apply();

                Log.i("MainActivity", "FCM token primed: " + token.substring(0, Math.min(20, token.length())) + "...");
            })
            .addOnFailureListener(error ->
                Log.w("MainActivity", "Failed to prime FCM token", error)
            );
    }
}
