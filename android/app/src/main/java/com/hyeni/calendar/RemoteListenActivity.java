package com.hyeni.calendar;

import android.Manifest;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

public class RemoteListenActivity extends AppCompatActivity {

    private static final String TAG = "RemoteListenActivity";
    private static final String PREFS_NAME = "hyeni_location_prefs";
    private static final int MICROPHONE_PERMISSION_CODE = 2101;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private Intent pendingIntent;
    private TextView statusView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        wakeOverLockScreen();
        renderStatus();
        handleRemoteListenIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleRemoteListenIntent(intent);
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }

    private void wakeOverLockScreen() {
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
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && km != null) {
            km.requestDismissKeyguard(this, null);
        }
    }

    private void renderStatus() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        int padding = dp(24);
        root.setPadding(padding, padding, padding, padding);
        root.setBackgroundColor(0xEEFFF4F8);

        TextView title = new TextView(this);
        title.setText("주변 소리 연결");
        title.setTextColor(0xFF3B2230);
        title.setTextSize(20);
        title.setGravity(Gravity.CENTER);
        title.setTypeface(title.getTypeface(), android.graphics.Typeface.BOLD);

        statusView = new TextView(this);
        statusView.setText("아이 안전 확인을 연결하고 있어요.");
        statusView.setTextColor(0xFF6B5F73);
        statusView.setTextSize(14);
        statusView.setGravity(Gravity.CENTER);
        statusView.setPadding(0, dp(10), 0, 0);

        root.addView(title);
        root.addView(statusView);
        setContentView(root);
    }

    private void handleRemoteListenIntent(Intent intent) {
        if (intent == null) {
            finishSoon(1200);
            return;
        }

        pendingIntent = new Intent(intent);
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            updateStatus("마이크 권한을 허용하면 바로 연결됩니다.");
            ActivityCompat.requestPermissions(
                this,
                new String[]{ Manifest.permission.RECORD_AUDIO },
                MICROPHONE_PERMISSION_CODE
            );
            return;
        }

        startAmbientListenFromForeground(pendingIntent);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != MICROPHONE_PERMISSION_CODE) return;

        boolean granted = grantResults.length > 0
            && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (granted) {
            startAmbientListenFromForeground(pendingIntent);
            return;
        }

        updateStatus("마이크 권한이 없어 연결하지 못했어요.");
        openMainAppSoon(900);
    }

    private void startAmbientListenFromForeground(Intent sourceIntent) {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String role = prefs.getString("role", "");
        if (!isBlank(role) && !"child".equalsIgnoreCase(role)) {
            Log.i(TAG, "Remote listen skipped: this device is not child mode");
            updateStatus("아이 모드 기기에서만 연결할 수 있어요.");
            finishSoon(1400);
            return;
        }

        String userId = prefs.getString("userId", "");
        String familyId = firstNonBlank(
            sourceIntent != null ? sourceIntent.getStringExtra("familyId") : null,
            prefs.getString("familyId", "")
        );
        String supabaseUrl = prefs.getString("supabaseUrl", "");
        String supabaseKey = prefs.getString("supabaseKey", "");
        String accessToken = prefs.getString("accessToken", "");

        if (isBlank(userId) || isBlank(familyId) || isBlank(supabaseUrl) || isBlank(supabaseKey)) {
            Log.w(TAG, "Remote listen foreground start skipped: push context missing");
            updateStatus("앱 연결 정보를 확인해야 해요.");
            openMainAppSoon(900);
            return;
        }

        Intent serviceIntent = new Intent(this, AmbientListenService.class);
        serviceIntent.setAction(AmbientListenService.ACTION_START);
        serviceIntent.putExtra(AmbientListenService.EXTRA_USER_ID, userId);
        serviceIntent.putExtra(AmbientListenService.EXTRA_FAMILY_ID, familyId);
        serviceIntent.putExtra(AmbientListenService.EXTRA_SUPABASE_URL, supabaseUrl);
        serviceIntent.putExtra(AmbientListenService.EXTRA_SUPABASE_KEY, supabaseKey);
        serviceIntent.putExtra(AmbientListenService.EXTRA_ACCESS_TOKEN, accessToken);
        serviceIntent.putExtra(AmbientListenService.EXTRA_DURATION_SEC, readDurationSec(sourceIntent));

        String senderUserId = sourceIntent != null ? sourceIntent.getStringExtra("senderUserId") : null;
        if (!isBlank(senderUserId)) {
            serviceIntent.putExtra(AmbientListenService.EXTRA_INITIATOR_USER_ID, senderUserId);
        }
        String requestId = sourceIntent != null ? sourceIntent.getStringExtra("requestId") : null;
        if (!isBlank(requestId)) {
            serviceIntent.putExtra(AmbientListenService.EXTRA_REQUEST_ID, requestId);
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }
            Log.i(TAG, "Remote listen foreground bridge started AmbientListenService");
            updateStatus("주변 소리 연결을 시작했어요.");
            finishSoon(1800);
        } catch (Exception error) {
            Log.w(TAG, "Remote listen foreground bridge failed", error);
            updateStatus("앱을 열어 연결을 이어갈게요.");
            openMainAppSoon(900);
        }
    }

    private void openMainAppSoon(long delayMs) {
        handler.postDelayed(() -> {
            Intent intent = new Intent(this, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            intent.putExtra("fromPush", true);
            intent.putExtra("remoteListen", true);
            copyIfPresent(pendingIntent, intent, "familyId");
            copyIfPresent(pendingIntent, intent, "senderUserId");
            copyIfPresent(pendingIntent, intent, "durationSec");
            copyIfPresent(pendingIntent, intent, "requestId");
            startActivity(intent);
            finish();
        }, delayMs);
    }

    private void finishSoon(long delayMs) {
        handler.postDelayed(this::finish, delayMs);
    }

    private void updateStatus(String message) {
        if (statusView != null) statusView.setText(message);
    }

    private void copyIfPresent(Intent from, Intent to, String key) {
        if (from == null || to == null || !from.hasExtra(key)) return;
        Object value = from.getExtras() != null ? from.getExtras().get(key) : null;
        if (value instanceof Integer) {
            to.putExtra(key, (Integer) value);
        } else if (value != null) {
            to.putExtra(key, String.valueOf(value));
        }
    }

    private int readDurationSec(Intent intent) {
        if (intent == null) return 30;
        int durationSec = 30;
        Object rawDuration = intent.getExtras() != null ? intent.getExtras().get("durationSec") : null;
        if (rawDuration instanceof Number) {
            durationSec = ((Number) rawDuration).intValue();
        } else if (rawDuration != null) {
            try {
                durationSec = Integer.parseInt(String.valueOf(rawDuration));
            } catch (Exception ignored) {
                durationSec = 30;
            }
        }
        if (durationSec < 5) return 30;
        return Math.min(durationSec, 120);
    }

    private String firstNonBlank(String first, String second) {
        return !isBlank(first) ? first.trim() : (!isBlank(second) ? second.trim() : "");
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
