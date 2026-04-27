import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import PlaydateHistory from '../src/components/friendPlaydate/PlaydateHistory.jsx';

afterEach(() => {
  cleanup();
});

describe('PlaydateHistory', () => {
  const history = [
    { id: 's1', started_at: '2026-04-27T14:00:00Z', stopped_at: '2026-04-27T16:00:00Z',
      stop_reason: 'parent_end', friend_child_name: '지민', place_name: '한강공원' },
    { id: 's2', started_at: '2026-04-26T10:00:00Z', stopped_at: '2026-04-26T12:00:00Z',
      stop_reason: 'auto_geofence_exit', friend_child_name: '예린', place_name: '학교' },
  ];

  it('renders rows with friend + place', () => {
    render(<PlaydateHistory history={history} />);
    expect(screen.getByText(/지민/)).toBeInTheDocument();
    expect(screen.getByText(/한강공원/)).toBeInTheDocument();
    expect(screen.getByText(/예린/)).toBeInTheDocument();
  });

  it('stop_reason 한글 표시', () => {
    render(<PlaydateHistory history={history} />);
    expect(screen.getByText(/부모 정지/)).toBeInTheDocument();
    expect(screen.getByText(/자동 종료/)).toBeInTheDocument();
  });

  it('empty', () => {
    render(<PlaydateHistory history={[]} />);
    expect(screen.getByText(/이력이 없어요/)).toBeInTheDocument();
  });
});
