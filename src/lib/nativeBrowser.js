import { getExternalBrowserPlugin } from "./nativePlugins.js";

function isNative() {
  return typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
}

export async function openNativeBrowser(url) {
  if (!url) throw new Error("URL is required");
  if (!isNative()) {
    window.location.href = url;
    return;
  }

  const browser = await getExternalBrowserPlugin();
  if (!browser?.open) {
    throw new Error("외부 브라우저를 열 수 없어요. 기본 브라우저 앱을 확인해 주세요.");
  }
  await browser.open({ url });
}

export async function closeNativeBrowser() {
  if (!isNative()) return;
  try {
    const browser = await getExternalBrowserPlugin();
    await browser?.close?.();
  } catch {
    // External ACTION_VIEW browsers cannot be programmatically closed.
  }
}
