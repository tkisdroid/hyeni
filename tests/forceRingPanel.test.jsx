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
import { ForceRingConfirmModal } from '../src/components/forceRing/ForceRingConfirmModal.jsx';

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

describe('ForceRingConfirmModal', () => {
  afterEach(() => {
    cleanup();
  });

  it('truncates input over 80 chars', () => {
    render(
      <ForceRingConfirmModal
        isOpen={true}
        onCancel={() => {}}
        onConfirm={() => {}}
        quotaInfo={{ quota: 1, used: 0 }}
      />
    );

    const ta = screen.getByPlaceholderText(/지금 바로 전화 줘/);
    fireEvent.change(ta, { target: { value: 'a'.repeat(120) } });

    expect(ta.value.length).toBe(80);
  });

  it('shows quota remaining', () => {
    render(
      <ForceRingConfirmModal
        isOpen={true}
        onCancel={() => {}}
        onConfirm={() => {}}
        quotaInfo={{ quota: 10, used: 3 }}
      />
    );
    expect(screen.getByText(/7 \/ 10/)).toBeDefined();
  });

  it('passes message to onConfirm', () => {
    const onConfirm = vi.fn();
    render(
      <ForceRingConfirmModal
        isOpen={true}
        onCancel={() => {}}
        onConfirm={onConfirm}
        quotaInfo={{ quota: 1, used: 0 }}
      />
    );

    const ta = screen.getByPlaceholderText(/지금 바로 전화 줘/);
    fireEvent.change(ta, { target: { value: '도와줘' } });
    fireEvent.click(screen.getByLabelText('응급 신호 보내기'));

    expect(onConfirm).toHaveBeenCalledWith('도와줘');
  });

  it('returns null when isOpen false', () => {
    const { container } = render(
      <ForceRingConfirmModal
        isOpen={false}
        onCancel={() => {}}
        onConfirm={() => {}}
        quotaInfo={null}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
