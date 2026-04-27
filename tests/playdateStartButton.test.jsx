// tests/playdateStartButton.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import PlaydateStartButton from '../src/components/friendPlaydate/PlaydateStartButton.jsx';

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('PlaydateStartButton', () => {
  it('disabled when not in safe place', () => {
    render(<PlaydateStartButton inSafePlace={false} onClick={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /친구랑 놀래요/ });
    expect(btn).toBeDisabled();
  });

  it('enabled when inSafePlace=true', () => {
    render(<PlaydateStartButton inSafePlace={true} onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: /친구랑 놀래요/ })).not.toBeDisabled();
  });

  it('disabled tooltip copy 노출', () => {
    render(<PlaydateStartButton inSafePlace={false} onClick={vi.fn()} />);
    expect(screen.getByText(/등록된 곳에서만/)).toBeInTheDocument();
  });

  it('click triggers onClick', () => {
    const onClick = vi.fn();
    render(<PlaydateStartButton inSafePlace={true} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: /친구랑 놀래요/ }));
    expect(onClick).toHaveBeenCalled();
  });
});
