package com.hyeni.calendar;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.atomic.AtomicInteger;

@CapacitorPlugin(name = "NativeNotification")
public class NotificationPlugin extends Plugin {

    private final AtomicInteger notifId = new AtomicInteger(1000);

    @Override
    public void load() {
        NotificationHelper.createChannels(getContext());
    }

    @PluginMethod()
    public void show(PluginCall call) {
        String title = call.getString("title", "혜니캘린더");
        String body = call.getString("body", "");
        String channel = call.getString("channel", "schedule");
        boolean wakeScreen = call.getBoolean("wakeScreen", false);
        boolean fullScreen = call.getBoolean("fullScreen", false);

        NotificationHelper.showNotification(
                getContext(),
                title,
                body,
                channel,
                wakeScreen,
                fullScreen,
                notifId.incrementAndGet()
        );

        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod()
    public void replaceScheduledNotifications(PluginCall call) {
        JSArray notifications = call.getArray("notifications");
        if (notifications == null) {
            notifications = new JSArray();
        }

        NotificationScheduleManager.replaceAll(getContext(), notifications);
        call.resolve(new JSObject().put("scheduled", notifications.length()));
    }

    @PluginMethod()
    public void cancelScheduledNotifications(PluginCall call) {
        NotificationScheduleManager.cancelAll(getContext());
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod()
    public void getDeliveryHealth(PluginCall call) {
        Context ctx = getContext();
        NotificationManager nm = (NotificationManager) ctx
                .getSystemService(Context.NOTIFICATION_SERVICE);
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);

        boolean notificationsEnabled = nm == null || nm.areNotificationsEnabled();
        boolean postPermissionGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
                || ContextCompat.checkSelfPermission(ctx, android.Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
        boolean batteryOptimizationsIgnored = Build.VERSION.SDK_INT < Build.VERSION_CODES.M
                || pm == null
                || pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
        boolean fullScreenIntentAllowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE
                || nm == null
                || nm.canUseFullScreenIntent();
        boolean exactAlarmAllowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.S
                || am == null
                || am.canScheduleExactAlarms();

        boolean channelsEnabled = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
            String[] channels = {
                    NotificationHelper.CHANNEL_SCHEDULE,
                    NotificationHelper.CHANNEL_EMERGENCY,
                    NotificationHelper.CHANNEL_KKUK
            };
            for (String chId : channels) {
                NotificationChannel ch = nm.getNotificationChannel(chId);
                if (ch == null || ch.getImportance() == NotificationManager.IMPORTANCE_NONE) {
                    channelsEnabled = false;
                    break;
                }
            }
        }

        JSObject result = new JSObject();
        result.put("notificationsEnabled", notificationsEnabled);
        result.put("postPermissionGranted", postPermissionGranted);
        result.put("batteryOptimizationsIgnored", batteryOptimizationsIgnored);
        result.put("fullScreenIntentAllowed", fullScreenIntentAllowed);
        result.put("exactAlarmAllowed", exactAlarmAllowed);
        result.put("channelsEnabled", channelsEnabled);
        result.put("ready", notificationsEnabled
                && postPermissionGranted
                && batteryOptimizationsIgnored
                && fullScreenIntentAllowed
                && exactAlarmAllowed
                && channelsEnabled);
        call.resolve(result);
    }

    @PluginMethod()
    public void checkChannelSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.resolve(new JSObject().put("enabled", true));
            return;
        }

        NotificationManager nm = (NotificationManager) getContext()
                .getSystemService(Context.NOTIFICATION_SERVICE);

        boolean allEnabled = true;
        String[] channels = {
                NotificationHelper.CHANNEL_SCHEDULE,
                NotificationHelper.CHANNEL_EMERGENCY,
                NotificationHelper.CHANNEL_KKUK
        };
        for (String chId : channels) {
            NotificationChannel ch = nm.getNotificationChannel(chId);
            if (ch != null && ch.getImportance() == NotificationManager.IMPORTANCE_NONE) {
                allEnabled = false;
                break;
            }
        }

        JSObject result = new JSObject();
        result.put("enabled", allEnabled);
        result.put("areNotificationsEnabled", nm.areNotificationsEnabled());
        call.resolve(result);
    }

    @PluginMethod()
    public void openSettings(PluginCall call) {
        Context ctx = getContext();
        Intent intent = new Intent();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            intent.setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, ctx.getPackageName());
        } else {
            intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + ctx.getPackageName()));
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(intent);
        call.resolve();
    }

    @PluginMethod()
    public void openBatteryOptimizationSettings(PluginCall call) {
        Context ctx = getContext();
        Intent intent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + ctx.getPackageName()));
        } else {
            intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + ctx.getPackageName()));
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(intent);
        call.resolve();
    }

    @PluginMethod()
    public void openFullScreenIntentSettings(PluginCall call) {
        Context ctx = getContext();
        Intent intent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
            intent.setData(Uri.parse("package:" + ctx.getPackageName()));
        } else {
            intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, ctx.getPackageName());
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(intent);
        call.resolve();
    }

    @PluginMethod()
    public void openExactAlarmSettings(PluginCall call) {
        Context ctx = getContext();
        Intent intent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
            intent.setData(Uri.parse("package:" + ctx.getPackageName()));
        } else {
            intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + ctx.getPackageName()));
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(intent);
        call.resolve();
    }
}
