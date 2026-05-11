export function deferEffectStateUpdate(callback) {
  let cancelled = false;
  let timeoutId = null;

  const run = () => {
    if (!cancelled) callback();
  };

  if (typeof globalThis.queueMicrotask === "function") {
    globalThis.queueMicrotask(run);
  } else {
    timeoutId = globalThis.setTimeout?.(run, 0) ?? null;
  }

  return () => {
    cancelled = true;
    if (timeoutId != null) globalThis.clearTimeout?.(timeoutId);
  };
}
