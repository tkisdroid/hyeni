const pluginCache = new Map();

async function getCapacitorCore() {
  if (typeof window === "undefined") return null;
  try {
    return await import("@capacitor/core");
  } catch {
    return null;
  }
}

function asNonThenablePlugin(plugin) {
  if (!plugin || typeof plugin !== "object") return plugin;
  return new Proxy(plugin, {
    get(target, prop, receiver) {
      if (prop === "then") return undefined;
      return Reflect.get(target, prop, receiver);
    },
  });
}

export async function getNativePlugin(name) {
  if (!name || typeof window === "undefined") return null;
  if (pluginCache.has(name)) return pluginCache.get(name);

  const core = await getCapacitorCore();
  const isNative = typeof core?.Capacitor?.isNativePlatform === "function"
    ? core.Capacitor.isNativePlatform()
    : !!window.Capacitor?.isNativePlatform?.();

  if (!isNative || typeof core?.registerPlugin !== "function") return null;

  const plugin = asNonThenablePlugin(core.registerPlugin(name));
  pluginCache.set(name, plugin);
  return plugin;
}

export function clearNativePluginCacheForTests() {
  pluginCache.clear();
}

export const getBackgroundLocationPlugin = () => getNativePlugin("BackgroundLocation");
export const getAmbientListenPlugin = () => getNativePlugin("AmbientListen");
export const getCameraPermissionPlugin = () => getNativePlugin("CameraPermission");
export const getExternalBrowserPlugin = () => getNativePlugin("ExternalBrowser");
export const getSpeechRecognitionPlugin = () => getNativePlugin("SpeechRecognition");
