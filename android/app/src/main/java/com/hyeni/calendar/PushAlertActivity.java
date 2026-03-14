package com.hyeni.calendar;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.WindowManager;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

public class PushAlertActivity extends AppCompatActivity {

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable autoClose = this::finish;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        wakeOverLockScreen();
        setContentView(R.layout.activity_push_alert);

        String title = getIntent().getStringExtra("title");
        String body = getIntent().getStringExtra("body");

        TextView titleView = findViewById(R.id.alertTitle);
        TextView bodyView = findViewById(R.id.alertBody);

        titleView.setText(title != null && !title.isEmpty() ? title : getString(R.string.push_alert_default_title));
        bodyView.setText(body != null ? body : "");

        findViewById(R.id.openAppButton).setOnClickListener(v -> openMainApp());
        findViewById(R.id.closeButton).setOnClickListener(v -> finish());
        findViewById(R.id.alertRoot).setOnClickListener(v -> openMainApp());

        handler.postDelayed(autoClose, 15000);
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacks(autoClose);
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

        KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && km != null) {
            km.requestDismissKeyguard(this, null);
        }
    }

    private void openMainApp() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.putExtra("fromPush", true);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(intent);
        finish();
    }
}