package com.hyeni.calendar;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.annotation.Nullable;

import java.util.concurrent.TimeUnit;

final class ForceRingRequestStore {

    private static final String PREFS_NAME = "hyeni_force_ring_requests";
    private static final long RECENT_WINDOW_MS = TimeUnit.MINUTES.toMillis(5);

    private ForceRingRequestStore() {}

    static void markLauncherShown(Context context, @Nullable String eventId) {
        if (context == null || isBlank(eventId)) return;
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putLong(keyFor(eventId), System.currentTimeMillis()).apply();
    }

    static boolean wasLauncherRecentlyShown(Context context, @Nullable String eventId) {
        if (context == null || isBlank(eventId)) return false;
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        long shownAt = prefs.getLong(keyFor(eventId), 0L);
        if (shownAt <= 0L) return false;
        long ageMs = System.currentTimeMillis() - shownAt;
        return ageMs >= 0L && ageMs <= RECENT_WINDOW_MS;
    }

    private static String keyFor(String eventId) {
        return "force_ring_launcher_" + eventId;
    }

    private static boolean isBlank(@Nullable String value) {
        return value == null || value.trim().isEmpty();
    }
}
