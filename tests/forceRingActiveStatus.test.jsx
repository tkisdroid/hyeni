import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';

vi.mock('../src/lib/forceRing.js', () => ({
  subscribeForceRingStatus: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
  stopForceRing: vi.fn(),
}));

import { ForceRingActiveStatus } from '../src/components/forceRing/ForceRingActiveStatus.jsx';

describe('ForceRingActiveStatus', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders 전송중 when delivered_at null and no stop', () => {
    const event = {
      id: 'evt-1',
      delivered_at: null,
      acknowledged_at: null,
      stopped_at: null,
    };
    render(<ForceRingActiveStatus event={event} />);
    expect(screen.getByText(/전달 시도 중/)).toBeDefined();
  });

  it('renders 전달됨 + 응답 대기 when delivered, not acked', () => {
    const event = {
      id: 'evt-1',
      delivered_at: '2026-04-27T14:32:15Z',
      acknowledged_at: null,
      stopped_at: null,
    };
    render(<ForceRingActiveStatus event={event} />);
    expect(screen.getByText(/전달됨/)).toBeDefined();
    expect(screen.getByText(/아이 응답 대기 중/)).toBeDefined();
  });

  it('renders 확인됨 when acknowledged_at set', () => {
    const event = {
      id: 'evt-1',
      delivered_at: '2026-04-27T14:32:15Z',
      acknowledged_at: '2026-04-27T14:32:27Z',
      stopped_at: '2026-04-27T14:32:27Z',
      stop_reason: 'child_ack',
    };
    render(<ForceRingActiveStatus event={event} />);
    expect(screen.getByText(/아이가 확인했어요/)).toBeDefined();
  });

  it('renders "그만 울릴께요" button when active and not acked', () => {
    const event = {
      id: 'evt-1',
      delivered_at: '2026-04-27T14:32:15Z',
      acknowledged_at: null,
      stopped_at: null,
    };
    render(<ForceRingActiveStatus event={event} />);
    expect(screen.getByLabelText(/그만 울릴께요/)).toBeDefined();
  });

  it('renders 전달 실패 with 119 fallback when stop_reason=delivery_failed', () => {
    const event = {
      id: 'evt-1',
      delivered_at: null,
      stopped_at: '2026-04-27T14:32:25Z',
      stop_reason: 'delivery_failed',
    };
    render(<ForceRingActiveStatus event={event} />);
    expect(screen.getByText(/전달 실패/)).toBeDefined();
    expect(screen.getByText(/119/)).toBeDefined();
  });
});
