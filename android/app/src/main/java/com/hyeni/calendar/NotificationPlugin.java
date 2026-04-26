package com.hyeni.calendar;

import android.Manifest;
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

    private static final String PREFS_NAME = "hyeni_location_prefs";
    private static final String REMOTE_LISTEN_CHANNEL_ID = "hyeni_remote_listen";

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
        String stableId = call.getString("id", call.getString("tag", null));
        int notificationId = stableId != null && !stableId.trim().isEmpty()
                ? NotificationHelper.stableRequestCode(stableId)
                : notifId.incrementAndGet();

        NotificationHelper.showNotification(
                getContext(),
                title,
                body,
                channel,
                wakeScreen,
                fullScreen,
                notificationId
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
        boolean recordAudioGranted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO)
                == PackageManager.PERMISSION_GRANTED;
        boolean locationServiceRunning = ctx
                .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getBoolean("serviceEnabled", false);
        boolean remoteListenChannelEnabled = isChannelEnabled(nm, REMOTE_LISTEN_CHANNEL_ID);

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
        result.put("recordAudioGranted", recordAudioGranted);
        result.put("remoteListenChannelEnabled", remoteListenChannelEnabled);
        result.put("locationServiceRunning", locationServiceRunning);
        result.put("sdkInt", Build.VERSION.SDK_INT);
        result.put("manufacturer", Build.MANUFACTURER);
        result.put("model", Build.MODEL);
        result.put("ready", notificationsEnabled
                && postPermissionGranted
                && batteryOptimizationsIgnored
                && fullScreenIntentAllowed
                && exactAlarmAllowed
                && channelsEnabled
                && recordAudioGranted
                && remoteListenChannelEnabled
                && locationServiceRunning);
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

    @PluginMethod()
    public void openAppDetailsSettings(PluginCall call) {
        Context ctx = getContext();
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.parse("package:" + ctx.getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(intent);
        call.resolve();
    }

    @PluginMethod()
    public void openNotificationChannelSettings(PluginCall call) {
        Context ctx = getContext();
        String channelId = call.getString("channelId", REMOTE_LISTEN_CHANNEL_ID);
        Intent intent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            intent = new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS);
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, ctx.getPackageName());
            intent.putExtra(Settings.EXTRA_CHANNEL_ID, channelId);
        } else {
            intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + ctx.getPackageName()));
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(intent);
        call.resolve();
    }

    private boolean isChannelEnabled(NotificationManager nm, String channelId) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || nm == null) {
            return true;
        }
        NotificationChannel channel = nm.getNotificationChannel(channelId);
        return channel == null || channel.getImportance() != NotificationManager.IMPORTANCE_NONE;
    }
}
