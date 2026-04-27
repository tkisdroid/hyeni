import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';

const mockFetch = vi.fn();
vi.mock('../src/lib/forceRing.js', () => ({
  fetchForceRingHistory: (...args) => mockFetch(...args),
}));

import { ForceRingHistory } from '../src/components/forceRing/ForceRingHistory.jsx';

describe('ForceRingHistory', () => {
  afterEach(() => {
    cleanup();
    mockFetch.mockReset();
  });

  it('renders 확인됨 label for child_ack events', async () => {
    mockFetch.mockResolvedValue([
      {
        id: '1',
        triggered_at: '2026-04-26T14:32:00Z',
        delivered_at: '2026-04-26T14:32:00Z',
        stopped_at: '2026-04-26T14:32:12Z',
        acknowledged_at: '2026-04-26T14:32:12Z',
        stop_reason: 'child_ack',
      },
    ]);
    const { container } = render(<ForceRingHistory familyId="fam-1" />);
    await waitFor(() => {
      const summary = container.querySelector('summary');
      if (!summary) throw new Error('summary not yet rendered');
    });
    fireEvent.click(container.querySelector('summary'));
    expect(screen.getByText(/확인됨/)).toBeDefined();
  });

  it('renders 자동 종료 label for auto_timeout', async () => {
    mockFetch.mockResolvedValue([
      {
        id: '1',
        triggered_at: '2026-04-25T09:15:00Z',
        stopped_at: '2026-04-25T09:15:15Z',
        stop_reason: 'auto_timeout',
      },
    ]);
    const { container } = render(<ForceRingHistory familyId="fam-1" />);
    await waitFor(() => {
      const summary = container.querySelector('summary');
      if (!summary) throw new Error('summary not yet rendered');
    });
    fireEvent.click(container.querySelector('summary'));
    expect(screen.getByText(/자동 종료/)).toBeDefined();
  });

  it('renders empty state when no history', async () => {
    mockFetch.mockResolvedValue([]);
    render(<ForceRingHistory familyId="fam-1" />);
    await waitFor(() => expect(screen.getByText(/사용 내역 없음/)).toBeDefined());
  });
});
