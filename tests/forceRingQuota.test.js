import { describe, it, expect, afterEach, vi } from 'vitest';

const mockRpc = vi.fn();

vi.mock('../src/lib/supabase.js', () => ({
  supabase: {
    rpc: (...args) => mockRpc(...args)
  }
}));

describe('force_ring_check_quota RPC contract', () => {
  afterEach(() => mockRpc.mockReset());

  it('returns allowed=true with quota=1 for free tier', async () => {
    mockRpc.mockResolvedValue({
      data: { allowed: true, quota: 1, used: 0, tier: 'free' },
      error: null
    });

    const { supabase } = await import('../src/lib/supabase.js');
    const { data } = await supabase.rpc('force_ring_check_quota', {
      p_family_id: '00000000-0000-0000-0000-000000000001'
    });

    expect(data).toEqual({ allowed: true, quota: 1, used: 0, tier: 'free' });
  });

  it('returns quota=10 for trial/active/grace tier', async () => {
    mockRpc.mockResolvedValue({
      data: { allowed: true, quota: 10, used: 3, tier: 'active' },
      error: null
    });

    const { supabase } = await import('../src/lib/supabase.js');
    const { data } = await supabase.rpc('force_ring_check_quota', {
      p_family_id: '00000000-0000-0000-0000-000000000001'
    });

    expect(data.quota).toBe(10);
    expect(data.tier).toBe('active');
  });

  it('returns allowed=false when used >= quota', async () => {
    mockRpc.mockResolvedValue({
      data: { allowed: false, quota: 1, used: 1, tier: 'free' },
      error: null
    });

    const { supabase } = await import('../src/lib/supabase.js');
    const { data } = await supabase.rpc('force_ring_check_quota', {
      p_family_id: '00000000-0000-0000-0000-000000000001'
    });

    expect(data.allowed).toBe(false);
  });

  it('falls back to free tier when family_subscription absent', async () => {
    mockRpc.mockResolvedValue({
      data: { allowed: true, quota: 1, used: 0, tier: 'free' },
      error: null
    });

    const { supabase } = await import('../src/lib/supabase.js');
    const { data } = await supabase.rpc('force_ring_check_quota', {
      p_family_id: '00000000-0000-0000-0000-000000000001'
    });

    expect(data.tier).toBe('free');
    expect(data.quota).toBe(1);
  });
});
