import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('../src/lib/friendPlaydate.js', () => ({ endPlaydate: vi.fn() }));

import { endPlaydate } from '../src/lib/friendPlaydate.js';
import ActivePlaydateChildView from '../src/components/friendPlaydate/ActivePlaydateChildView.jsx';

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('ActivePlaydateChildView', () => {
  it('현재 친구 표시', () => {
    render(<ActivePlaydateChildView session={{ id: 's1', friend_child_name: '지민', started_at: '2026-04-27T14:32:00Z' }} onEnd={vi.fn()} />);
    expect(screen.getByText(/지민/)).toBeInTheDocument();
  });

  it('그만 놀래요 → endPlaydate(child_end)', async () => {
    endPlaydate.mockResolvedValueOnce(undefined);
    const onEnd = vi.fn();
    render(<ActivePlaydateChildView session={{ id: 's1', friend_child_name: '지민', started_at: '2026-04-27T14:32:00Z' }} onEnd={onEnd} />);
    fireEvent.click(screen.getByRole('button', { name: /그만 놀래요/ }));
    await waitFor(() => {
      expect(endPlaydate).toHaveBeenCalledWith('s1', 'child_end');
      expect(onEnd).toHaveBeenCalled();
    });
  });
});
