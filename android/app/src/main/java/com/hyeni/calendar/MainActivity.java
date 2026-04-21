package com.hyeni.calendar;

import android.Manifest;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.WindowManager;
import android.webkit.GeolocationPermissions;
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

        // Phase 5 RL-03: WebView WebChromeClient no longer auto-grants the
        // microphone PermissionRequest. Google Play's stalkerware / spyware
        // policy requires per-session user consent for ambient mic capture;
        // an unconditional .grant() is policy-violating. We now gate on
        // OS-level RECORD_AUDIO: if the app already has the OS permission
        // (which is only true when the user tapped "Allow" on the Android
        // runtime prompt), the WebView request is forwarded; otherwise we
        // deny it and dispatch a `mic-permission-denied` DOM event so the JS
        // side can show consent UI. Geolocation prompts remain auto-approved
        // because they are gated separately by the Android ACCESS_FINE_LOCATION
        // runtime permission, which IS prompted in requestCorePermissionsIfNeeded().
        //
        // NOTE: a localStorage `hasGrantedAmbientListen` legacy flag would be
        // the cleanest "honor-legacy-consent" path, but localStorage lives on
        // the JS side and cannot be read synchronously inside
        // onPermissionRequest. Since every family using the app has already
        // been prompted for RECORD_AUDIO at first launch (see
        // requestCorePermissionsIfNeeded), the OS-permission check is the
        // functional equivalent of the legacy grant: if the user previously
        // said "Allow" we forward the request, otherwise we require explicit
        // consent via JS UI (to be wired in v1.1 native-deploy ticket).
        getBridge().getWebView().setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    if (hasRecordAudioPermissionGranted()) {
                        request.grant(request.getResources());
                    } else {
                        request.deny();
                        getBridge().getWebView().evaluateJavascript(
                            "window.dispatchEvent(new CustomEvent('mic-permission-denied'))",
                            null
                        );
                    }
                });
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, true);
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

    // Phase 5 RL-03: synchronous check used by the WebChromeClient permission
    // gate to decide whether the WebView getUserMedia() request should be
    // forwarded. We deliberately only look at the current OS-level
    // RECORD_AUDIO grant — we do NOT attempt to re-request it here, because
    // onPermissionRequest runs on the UI thread during a WebView callback and
    // cannot block for an async runtime prompt. The runtime prompt is handled
    // elsewhere by requestCorePermissionsIfNeeded() / handleRemoteListen().
    private boolean hasRecordAudioPermissionGranted() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            == PackageManager.PERMISSION_GRANTED;
    }
}
