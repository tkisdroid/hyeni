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

  const buttonLabel = compact ? '5초 길게 누르기' : '🔴 5초 누르고 있기 (응급 신호 발송)';

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
      style={{
        background: disabled ? '#9CA3AF' : holding ? '#991B1B' : '#DC2626',
        color: 'white',
        padding: compact ? '12px 14px' : '20px',
        border: 'none',
        borderRadius: compact ? '14px' : '12px',
        width: compact ? 'auto' : '100%',
        minWidth: compact ? '132px' : undefined,
        minHeight: compact ? '48px' : '56px',
        fontSize: compact ? '13px' : '18px',
        fontWeight: 'bold',
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: disabled ? 'none' : '0 8px 20px rgba(220,38,38,0.22)',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          width: `${progress}%`,
          background: 'rgba(255,255,255,0.2)',
          transition: 'width 50ms linear',
          pointerEvents: 'none',
        }}
      />
      <span style={{ position: 'relative', display: 'block' }}>
        {buttonLabel}
        {holding && (
          <div style={{ fontSize: compact ? '11px' : '14px', marginTop: compact ? '4px' : '8px' }}>
            계속 누르세요 ({remaining}초)
          </div>
        )}
      </span>
    </button>
  );
}
