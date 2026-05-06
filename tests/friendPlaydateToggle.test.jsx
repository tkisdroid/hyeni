// tests/friendPlaydateToggle.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import FriendPlaydateToggle from '../src/components/friendPlaydate/FriendPlaydateToggle.jsx';

vi.mock('../src/lib/friendPlaydate.js', () => ({
  setFamilyPlaydateEnabled: vi.fn(),
}));
import { setFamilyPlaydateEnabled } from '../src/lib/friendPlaydate.js';

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('FriendPlaydateToggle (isolated)', () => {
  it('renders OFF state with helper copy', () => {
    render(<FriendPlaydateToggle familyId="fam-1" enabled={false} onChange={vi.fn()} />);
    expect(screen.getByRole('switch', { name: /친구 만남 기능/ })).toBeInTheDocument();
    expect(screen.getByText(/양쪽 부모가 모두 켜야/)).toBeInTheDocument();
  });

  it('renders ON state', () => {
    render(<FriendPlaydateToggle familyId="fam-1" enabled={true} onChange={vi.fn()} />);
    const sw = screen.getByRole('switch');
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });

  it('toggles to ON: calls setFamilyPlaydateEnabled + onChange(true)', async () => {
    setFamilyPlaydateEnabled.mockResolvedValueOnce(undefined);
    const onChange = vi.fn();
    render(<FriendPlaydateToggle familyId="fam-1" enabled={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => {
      expect(setFamilyPlaydateEnabled).toHaveBeenCalledWith('fam-1', true);
      expect(onChange).toHaveBeenCalledWith(true);
    });
  });
});
