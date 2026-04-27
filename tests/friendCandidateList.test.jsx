// tests/friendCandidateList.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import FriendCandidateList from '../src/components/friendPlaydate/FriendCandidateList.jsx';

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('FriendCandidateList', () => {
  const candidates = [
    { family_id: 'fam-2', child_user_id: 'u-2', child_name: '지민', public_place_id: 'p-1' },
    { family_id: 'fam-3', child_user_id: 'u-3', child_name: '예린', public_place_id: 'p-1' },
  ];

  it('렌더링 — 각 후보 Radio', () => {
    render(<FriendCandidateList candidates={candidates} onStart={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText(/지민/)).toBeInTheDocument();
    expect(screen.getByLabelText(/예린/)).toBeInTheDocument();
  });

  it('empty state copy', () => {
    render(<FriendCandidateList candidates={[]} onStart={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/같은 곳에 친구가 없어요/)).toBeInTheDocument();
  });

  it('선택 후 시작 버튼 → onStart(candidate)', () => {
    const onStart = vi.fn();
    render(<FriendCandidateList candidates={candidates} onStart={onStart} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByLabelText(/지민/));
    fireEvent.click(screen.getByRole('button', { name: /친구랑 놀래요 시작/ }));
    expect(onStart).toHaveBeenCalledWith(candidates[0]);
  });

  it('선택 안 했으면 시작 disabled', () => {
    render(<FriendCandidateList candidates={candidates} onStart={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /친구랑 놀래요 시작/ })).toBeDisabled();
  });
});
