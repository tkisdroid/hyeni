import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import ActivePlaydateCard from '../src/components/friendPlaydate/ActivePlaydateCard.jsx';

afterEach(() => {
  cleanup();
});

vi.mock('../src/lib/friendPlaydate.js', () => ({ endPlaydate: vi.fn() }));
import { endPlaydate } from '../src/lib/friendPlaydate.js';

describe('ActivePlaydateCard', () => {
  const session = {
    id: 'sess-1',
    place_name: '한강공원',
    friend_child_name: '지민',
    friend_parent_name: '지민이 엄마',
    friend_family_phones: ['010-1111-2222', '010-3333-4444'],
    started_at: '2026-04-27T14:32:00Z',
  };

  it('renders place + friend name + phone buttons', () => {
    render(<ActivePlaydateCard session={session} onEnd={vi.fn()} />);
    expect(screen.getByText(/한강공원/)).toBeInTheDocument();
    expect(screen.getByText(/지민/)).toBeInTheDocument();
    const phoneLinks = screen.getAllByRole('link');
    expect(phoneLinks.length).toBeGreaterThanOrEqual(1);
    expect(phoneLinks[0]).toHaveAttribute('href', expect.stringMatching(/^tel:/));
  });

  it('두 번호 모두 표시', () => {
    render(<ActivePlaydateCard session={session} onEnd={vi.fn()} />);
    expect(screen.getByText(/010-1111-2222/)).toBeInTheDocument();
    expect(screen.getByText(/010-3333-4444/)).toBeInTheDocument();
  });

  it('null phone 자동 필터링', () => {
    const sessionWithNull = { ...session, friend_family_phones: ['010-1111-2222', null, ''] };
    render(<ActivePlaydateCard session={sessionWithNull} onEnd={vi.fn()} />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
  });

  it('정지 버튼 → endPlaydate(parent_end) + onEnd', async () => {
    endPlaydate.mockResolvedValueOnce(undefined);
    const onEnd = vi.fn();
    // MEDIUM-4 fix: vi.spyOn은 vi.restoreAllMocks 시 자동 복원 → 다른 spec leak 방지
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<ActivePlaydateCard session={session} onEnd={onEnd} />);
    fireEvent.click(screen.getByRole('button', { name: /정지/ }));
    await waitFor(() => {
      expect(endPlaydate).toHaveBeenCalledWith('sess-1', 'parent_end');
      expect(onEnd).toHaveBeenCalled();
    });
    vi.restoreAllMocks();
  });
});
