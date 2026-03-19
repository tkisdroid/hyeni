import { SUPABASE_URL, SUPABASE_KEY } from "./utils.js";

// Native background location (Capacitor plugin)
async function startNativeLocationService(userId, familyId, accessToken, role) {
    try {
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor.isNativePlatform()) {
            const { registerPlugin } = await import("@capacitor/core");
            const BackgroundLocation = registerPlugin("BackgroundLocation");
            await BackgroundLocation.startService({
                userId, familyId,
                supabaseUrl: SUPABASE_URL,
                supabaseKey: SUPABASE_KEY,
                accessToken: accessToken || "",
                role: role || "child"
            });
            console.log("[Native] Background location service started");
            return true;
        }
    } catch (e) {
        console.log("[Native] Not available (web mode):", e.message);
    }
    return false;
}

async function stopNativeLocationService() {
    try {
        const { Capacitor, registerPlugin } = await import("@capacitor/core");
        if (Capacitor.isNativePlatform()) {
            const BackgroundLocation = registerPlugin("BackgroundLocation");
            await BackgroundLocation.stopService();
            console.log("[Native] Background location service stopped");
        }
    } catch { /* web mode */ }
}

export { startNativeLocationService, stopNativeLocationService };
