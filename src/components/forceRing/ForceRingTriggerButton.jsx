import React, { useRef, useState, useCallback, useEffect } from 'react';

const HOLD_MS = 5000;

export function ForceRingTriggerButton({ onConfirm, disabled, compact = false }) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const timerRef = useRef(null);
  const intervalRef = useRef(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setHolding(false);
    setProgress(0);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(() => {
    if (disabled) return;
    setHolding(true);
    setProgress(0);

    const startedAt = Date.now();
    intervalRef.current = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - startedAt) / HOLD_MS) * 100);
      setProgress(pct);
    }, 50);

    timerRef.current = setTimeout(() => {
      cleanup();
      onConfirm?.();
    }, HOLD_MS);
  }, [disabled, onConfirm, cleanup]);

  const cancel = useCallback(() => {
    if (timerRef.current) cleanup();
  }, [cleanup]);

  const remaining = Math.max(0, Math.ceil((HOLD_MS - (HOLD_MS * progress) / 100) / 1000));
  const className = `hyeni-tool-button${compact ? ' hyeni-tool-button--compact' : ''}`;

  return (
    <button
      type="button"
      aria-label="5초 누르고 있기 (응급 신호 발송)"
      disabled={disabled}
      onMouseDown={start}
      onMouseUp={cancel}
      onMouseLeave={cancel}
      onTouchStart={start}
      onTouchEnd={cancel}
      onTouchCancel={cancel}
      className={className}
    >
      <span
        className="hyeni-tool-button__progress"
        style={{ width: `${progress}%` }}
        aria-hidden="true"
      />
      <span className="hyeni-tool-button__label">
        {compact ? '5초 길게 누르기' : '5초 누르고 있기 — 응급 신호 발송'}
      </span>
      {holding && (
        <span className="hyeni-tool-button__hint">계속 누르세요 · {remaining}초</span>
      )}
    </button>
  );
}
