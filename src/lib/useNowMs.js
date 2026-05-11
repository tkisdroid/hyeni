import { useEffect, useState } from "react";

export function useNowMs(intervalMs = 60_000) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, setNowMs]);

  return nowMs;
}
