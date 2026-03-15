package com.hyeni.calendar;

import android.Manifest;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.google.firebase.messaging.FirebaseMessaging;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {

    private static final int NOTIFICATION_PERMISSION_CODE = 1001;
    private static final int MICROPHONE_PERMISSION_CODE = 1002;
    private static final int CORE_PERMISSION_REQUEST_CODE = 1003;
    private static final String PREFS_NAME = "hyeni_location_prefs";
    private static final String CORE_PERMISSION_PROMPTED_KEY = "corePermissionPrompted";
    private boolean pendingRemoteListen = false;
    private boolean suppressNotificationPermissionPrompt = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LocationPlugin.class);
        registerPlugin(SpeechPlugin.class);
        registerPlugin(NotificationPlugin.class);
        super.onCreate(savedInstanceState);

        // Allow WebView to access microphone (for getUserMedia)
        getBridge().getWebView().setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                request.grant(request.getResources());
            }
        });

        handlePushLaunch(getIntent());
        handleRemoteListen(getIntent());
        requestCorePermissionsIfNeeded(getIntent());
        requestNotificationPermission();
        primeFcmToken();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handlePushLaunch(intent);
        handleRemoteListen(intent);
        requestCorePermissionsIfNeeded(intent);
    }

    private void requestNotificationPermission() {
        if (suppressNotificationPermissionPrompt) {
            return;
        }
        if (getSharedPreferences(PREFS_NAME, MODE_PRIVATE).getBoolean(CORE_PERMISSION_PROMPTED_KEY, false)) {
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this,
                        new String[]{ Manifest.permission.POST_NOTIFICATIONS },
                        NOTIFICATION_PERMISSION_CODE);
            }
        }
    }

    private void requestCorePermissionsIfNeeded(Intent intent) {
        if (intent != null && intent.getBooleanExtra("remoteListen", false)) {
            return;
        }

        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        if (prefs.getBoolean(CORE_PERMISSION_PROMPTED_KEY, false)) {
            return;
        }

        List<String> missingPermissions = new ArrayList<>();
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            missingPermissions.add(Manifest.permission.RECORD_AUDIO);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            missingPermissions.add(Manifest.permission.ACCESS_FINE_LOCATION);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            missingPermissions.add(Manifest.permission.POST_NOTIFICATIONS);
        }

        if (missingPermissions.isEmpty()) {
            prefs.edit().putBoolean(CORE_PERMISSION_PROMPTED_KEY, true).apply();
            return;
        }

        prefs.edit().putBoolean(CORE_PERMISSION_PROMPTED_KEY, true).apply();
        ActivityCompat.requestPermissions(
            this,
            missingPermissions.toArray(new String[0]),
            CORE_PERMISSION_REQUEST_CODE
        );
    }

    private void handleRemoteListen(Intent intent) {
        if (intent == null || !intent.getBooleanExtra("remoteListen", false)) return;
        suppressNotificationPermissionPrompt = true;
        intent.removeExtra("remoteListen"); // consume once
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            pendingRemoteListen = true;
            ActivityCompat.requestPermissions(this,
                    new String[]{ Manifest.permission.RECORD_AUDIO },
                    MICROPHONE_PERMISSION_CODE);
            return;
        }
        queueRemoteListenFlagInjection();
    }

    private void queueRemoteListenFlagInjection() {
        pendingRemoteListen = false;
        Log.i("MainActivity", "Remote listen intent - will inject JS flag");
        injectRemoteListenFlag(1000);
        injectRemoteListenFlag(3000);
        injectRemoteListenFlag(6000);
        injectRemoteListenFlag(10000);
    }

    private void injectRemoteListenFlag(long delayMs) {
        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }
        getBridge().getWebView().postDelayed(() -> {
            if (getBridge() == null || getBridge().getWebView() == null) {
                return;
            }
            getBridge().getWebView().evaluateJavascript("window.__REMOTE_LISTEN_REQUESTED = true;", null);
        }, delayMs);
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

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == CORE_PERMISSION_REQUEST_CODE) {
            Log.i("MainActivity", "Initial core permission prompt completed");
            return;
        }

        if (requestCode != MICROPHONE_PERMISSION_CODE) {
            return;
        }

        boolean granted = grantResults.length > 0
            && grantResults[0] == PackageManager.PERMISSION_GRANTED;

        if (granted && pendingRemoteListen) {
            queueRemoteListenFlagInjection();
            return;
        }

        pendingRemoteListen = false;
        Log.w("MainActivity", "Remote listen microphone permission denied");
    }
}
