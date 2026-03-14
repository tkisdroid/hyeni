package com.hyeni.calendar;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import java.util.concurrent.TimeUnit;

/**
 * WorkManager periodic worker that ensures LocationService stays alive.
 * Runs every 15 minutes (minimum WorkManager interval).
 * If the service was killed by the OS, battery optimizer, or OEM cleanup,
 * this worker will restart it.
 */
public class ServiceKeepAlive extends Worker {

    private static final String TAG = "ServiceKeepAlive";
    private static final String WORK_NAME = "hyeni_service_keepalive";
    private static final String PREFS_NAME = "hyeni_location_prefs";

    public ServiceKeepAlive(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean enabled = prefs.getBoolean("serviceEnabled", false);
        String userId = prefs.getString("userId", null);

        if (!enabled || userId == null) {
            Log.d(TAG, "Service not enabled or no userId, skipping restart");
            return Result.success();
        }

        // Restart the foreground service
        try {
            Intent intent = new Intent(ctx, LocationService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent);
            } else {
                ctx.startService(intent);
            }
            Log.i(TAG, "LocationService restarted by WorkManager keepalive");
        } catch (Exception e) {
            Log.e(TAG, "Failed to restart LocationService: " + e.getMessage());
        }

        return Result.success();
    }

    /**
     * Schedule the keepalive worker. Call this when LocationService starts.
     */
    public static void schedule(Context context) {
        Constraints constraints = new Constraints.Builder()
            .setRequiredNetworkType(NetworkType.NOT_REQUIRED)
            .build();

        PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(
                ServiceKeepAlive.class, 15, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .setInitialDelay(15, TimeUnit.MINUTES)
            .build();

        WorkManager.getInstance(context)
            .enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            );

        Log.i(TAG, "WorkManager keepalive scheduled (every 15min)");
    }

    /**
     * Cancel the keepalive worker. Call this when service is explicitly stopped.
     */
    public static void cancel(Context context) {
        WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME);
        Log.i(TAG, "WorkManager keepalive cancelled");
    }
}
