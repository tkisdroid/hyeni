package com.hyeni.calendar;

import android.app.KeyguardManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.cardview.widget.CardView;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class ForceRingActivity extends AppCompatActivity {

    private BroadcastReceiver stopReceiver;
    private final Handler countdownHandler = new Handler(Looper.getMainLooper());
    private int secondsLeft = 15;
    private TextView countdownText;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().addFlags(
                  WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }

        KeyguardManager km = getSystemService(KeyguardManager.class);
        boolean isLocked = km != null && km.isKeyguardLocked();
        boolean isSecure = km != null && km.isKeyguardSecure();
        if (isLocked && !isSecure && km != null) {
            km.requestDismissKeyguard(this, null);
        }

        WindowManager.LayoutParams lp = getWindow().getAttributes();
        lp.screenBrightness = 1.0f;
        getWindow().setAttributes(lp);

        getWindow().getDecorView().setSystemUiVisibility(
                  View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);

        setContentView(R.layout.activity_force_ring);

        Intent intent = getIntent();
        String eventId = intent.getStringExtra(ForceRingService.EXTRA_EVENT_ID);
        String message = intent.getStringExtra(ForceRingService.EXTRA_MESSAGE);
        String initiator = intent.getStringExtra(ForceRingService.EXTRA_INITIATOR);

        ((TextView) findViewById(R.id.initiator_text)).setText(
                initiator != null ? initiator : "부모님이 지금 너를 찾고 있어요");
        ((TextView) findViewById(R.id.time_text)).setText(
                new SimpleDateFormat("HH:mm:ss", Locale.KOREA).format(new Date()));

        CardView messageCard = findViewById(R.id.message_card);
        if (message != null && !message.trim().isEmpty()) {
            if (isLocked && isSecure) {
                messageCard.setVisibility(View.GONE);
            } else {
                ((TextView) findViewById(R.id.message_text)).setText(message);
                messageCard.setVisibility(View.VISIBLE);
            }
        } else {
            messageCard.setVisibility(View.GONE);
        }

        countdownText = findViewById(R.id.countdown_text);
        startCountdown();

        Button btnAck = findViewById(R.id.btn_ack);
        btnAck.setOnClickListener(v -> {
            Toast.makeText(this, "부모님에게 확인 알림이 갔어요", Toast.LENGTH_SHORT).show();
            stopService(new Intent(this, ForceRingService.class));
            sendAck(eventId);
            new Handler(Looper.getMainLooper()).postDelayed(this::finish, 1500);
        });

        stopReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context ctx, Intent i) {
                Toast.makeText(ForceRingActivity.this,
                        "부모님이 알람을 종료했어요", Toast.LENGTH_SHORT).show();
                new Handler(Looper.getMainLooper()).postDelayed(
                        ForceRingActivity.this::finish, 1500);
            }
        };
        IntentFilter filter = new IntentFilter("com.hyeni.calendar.FORCE_RING_STOP");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(stopReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(stopReceiver, filter);
        }
    }

    private void startCountdown() {
        countdownHandler.post(new Runnable() {
            @Override
            public void run() {
                if (secondsLeft <= 0) return;
                countdownText.setText("알람 자동 종료까지 " + secondsLeft + "초");
                secondsLeft--;
                countdownHandler.postDelayed(this, 1000);
            }
        });
    }

    private void sendAck(String eventId) {
        if (eventId == null) return;
        getSharedPreferences("hyeni_force_ring_acks", MODE_PRIVATE)
                .edit()
                .putLong(eventId, System.currentTimeMillis())
                .apply();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        countdownHandler.removeCallbacksAndMessages(null);
        if (stopReceiver != null) {
            try { unregisterReceiver(stopReceiver); } catch (Exception ignored) {}
        }
    }
}
