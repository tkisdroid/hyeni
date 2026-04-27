import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act, screen, cleanup } from '@testing-library/react';
import React from 'react';

vi.mock('../src/lib/forceRing.js', () => ({
  triggerForceRing: vi.fn(),
  stopForceRing: vi.fn(),
  subscribeForceRingStatus: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
  fetchActiveForceRing: vi.fn().mockResolvedValue(null),
  fetchForceRingHistory: vi.fn().mockResolvedValue([]),
}));

import { ForceRingTriggerButton } from '../src/components/forceRing/ForceRingTriggerButton.jsx';

describe('ForceRingTriggerButton', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('does NOT call onConfirm on quick tap (less than 5s)', () => {
    const onConfirm = vi.fn();
    render(<ForceRingTriggerButton onConfirm={onConfirm} disabled={false} />);

    const btn = screen.getByRole('button');
    fireEvent.mouseDown(btn);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    fireEvent.mouseUp(btn);

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onConfirm after 5 second long-press', () => {
    const onConfirm = vi.fn();
    render(<ForceRingTriggerButton onConfirm={onConfirm} disabled={false} />);

    const btn = screen.getByRole('button');
    fireEvent.mouseDown(btn);
    act(() => {
      vi.advanceTimersByTime(5100);
    });

    expect(onConfirm).toHaveBeenCalled();
  });

  it('does not trigger when disabled', () => {
    const onConfirm = vi.fn();
    render(<ForceRingTriggerButton onConfirm={onConfirm} disabled={true} />);

    const btn = screen.getByRole('button');
    fireEvent.mouseDown(btn);
    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(onConfirm).not.toHaveBeenCalled();
  });
});
