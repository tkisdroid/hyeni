import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Supabase mock (vi.hoisted runs before vi.mock hoisting) ───
const { mockRpc, mockFrom, mockQueryBuilder } = vi.hoisted(() => {
  const mockRpc = vi.fn();
  const mockFrom = vi.fn();
  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    single: vi.fn(),
    lt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
  };
  mockFrom.mockReturnValue(mockQueryBuilder);
  return { mockRpc, mockFrom, mockQueryBuilder };
});

vi.mock('../../lib/supabase.js', () => ({
  supabase: { rpc: mockRpc, from: mockFrom },
}));

import {
  getMyReferralCode,
  applyReferralCode,
  getMyReferralStats,
  checkPendingReferrals,
  shareReferralLink,
} from '../referralService.js';

// ── Helpers ────────────────────────────────────────────────────
const VALID_UUID = '11111111-1111-1111-1111-111111111111';
const VALID_UUID_2 = '22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  vi.restoreAllMocks();
  mockRpc.mockReset();
  mockFrom.mockReset().mockReturnValue(mockQueryBuilder);
  Object.values(mockQueryBuilder).forEach((fn) => {
    fn.mockReset();
    if (fn !== mockQueryBuilder.single) {
      fn.mockReturnThis();
    }
  });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

// ================================================================
// getMyReferralCode
// ================================================================
describe('getMyReferralCode', () => {
  it('should call get_or_create_referral_code RPC with familyId', async () => {
    mockRpc.mockResolvedValue({ data: 'HYENI-ABCD-1234', error: null });

    const result = await getMyReferralCode(VALID_UUID);

    expect(mockRpc).toHaveBeenCalledWith('get_or_create_referral_code', {
      p_family_id: VALID_UUID,
    });
    expect(result).toBe('HYENI-ABCD-1234');
  });

  it('should return the code string on success', async () => {
    mockRpc.mockResolvedValue({ data: 'HYENI-ZZZZ-9999', error: null });

    const result = await getMyReferralCode(VALID_UUID);

    expect(result).toBe('HYENI-ZZZZ-9999');
  });

  it('should return null on RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'db error' } });

    const result = await getMyReferralCode(VALID_UUID);

    expect(result).toBeNull();
  });
});

// ================================================================
// applyReferralCode
// ================================================================
describe('applyReferralCode', () => {
  it('should call apply_referral_code RPC with correct params', async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, referrer_family_id: VALID_UUID_2 },
      error: null,
    });

    await applyReferralCode(VALID_UUID, 'HYENI-ABCD-1234');

    expect(mockRpc).toHaveBeenCalledWith('apply_referral_code', {
      p_referee_family_id: VALID_UUID,
      p_code: 'HYENI-ABCD-1234',
    });
  });

  it('should return { success: true } on success', async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, referrer_family_id: VALID_UUID_2 },
      error: null,
    });

    const result = await applyReferralCode(VALID_UUID, 'HYENI-ABCD-1234');

    expect(result).toEqual({
      success: true,
      referrer_family_id: VALID_UUID_2,
    });
  });

  it('should return error for invalid_code', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'invalid_code' },
    });

    const result = await applyReferralCode(VALID_UUID, 'BAD-CODE');

    expect(result).toEqual({ success: false, error: 'invalid_code' });
  });

  it('should return error for self_referral', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'self_referral' },
    });

    const result = await applyReferralCode(VALID_UUID, 'MY-OWN-CODE');

    expect(result).toEqual({ success: false, error: 'self_referral' });
  });

  it('should return error for already_referred', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'already_referred' },
    });

    const result = await applyReferralCode(VALID_UUID, 'HYENI-ABCD-1234');

    expect(result).toEqual({ success: false, error: 'already_referred' });
  });
});

// ================================================================
// getMyReferralStats
// ================================================================
describe('getMyReferralStats', () => {
  /**
   * Helper: set up the two chained queries inside getMyReferralStats.
   * 1st call to from("referral_codes") → .select().eq().single()
   * 2nd call to from("referral_completions") → .select().or()
   */
  function setupStatsMocks({ codeData, codeError, completions, compError }) {
    // We need two distinct builder chains for the two from() calls.
    const codeBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: codeData, error: codeError }),
    };
    const compBuilder = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({ data: completions, error: compError }),
    };

    mockFrom
      .mockReturnValueOnce(codeBuilder)
      .mockReturnValueOnce(compBuilder);
  }

  it('should return correct stats with pending and rewarded counts', async () => {
    setupStatsMocks({
      codeData: { total_referrals: 7 },
      codeError: null,
      completions: [
        { status: 'pending' },
        { status: 'pending' },
        { status: 'rewarded' },
        { status: 'rewarded' },
        { status: 'rewarded' },
      ],
      compError: null,
    });

    const result = await getMyReferralStats(VALID_UUID);

    expect(result).toEqual({
      totalReferrals: 7,
      pendingCount: 2,
      rewardedCount: 3,
      nextMilestone: 10,
      remainingToNext: 3,
    });
  });

  it('should handle new user with no referral code (PGRST116)', async () => {
    setupStatsMocks({
      codeData: null,
      codeError: { code: 'PGRST116', message: 'no rows' },
      completions: [],
      compError: null,
    });

    const result = await getMyReferralStats(VALID_UUID);

    expect(result).toEqual({
      totalReferrals: 0,
      pendingCount: 0,
      rewardedCount: 0,
      nextMilestone: 5,
      remainingToNext: 5,
    });
  });

  it('should calculate nextMilestone = 5 when totalReferrals < 5', async () => {
    setupStatsMocks({
      codeData: { total_referrals: 3 },
      codeError: null,
      completions: [],
      compError: null,
    });

    const result = await getMyReferralStats(VALID_UUID);

    expect(result.nextMilestone).toBe(5);
    expect(result.remainingToNext).toBe(2);
  });

  it('should calculate nextMilestone = 10 when totalReferrals is 5-9', async () => {
    setupStatsMocks({
      codeData: { total_referrals: 5 },
      codeError: null,
      completions: [],
      compError: null,
    });

    const result = await getMyReferralStats(VALID_UUID);

    expect(result.nextMilestone).toBe(10);
    expect(result.remainingToNext).toBe(5);
  });

  it('should calculate nextMilestone = 20 when totalReferrals is 10-19', async () => {
    setupStatsMocks({
      codeData: { total_referrals: 14 },
      codeError: null,
      completions: [],
      compError: null,
    });

    const result = await getMyReferralStats(VALID_UUID);

    expect(result.nextMilestone).toBe(20);
    expect(result.remainingToNext).toBe(6);
  });

  it('should cap nextMilestone at 20 when totalReferrals >= 20', async () => {
    setupStatsMocks({
      codeData: { total_referrals: 25 },
      codeError: null,
      completions: [],
      compError: null,
    });

    const result = await getMyReferralStats(VALID_UUID);

    expect(result.nextMilestone).toBe(20);
    expect(result.remainingToNext).toBe(0);
  });

  it('should return null on non-PGRST116 error', async () => {
    setupStatsMocks({
      codeData: null,
      codeError: { code: '42P01', message: 'table not found' },
      completions: [],
      compError: null,
    });

    const result = await getMyReferralStats(VALID_UUID);

    expect(result).toBeNull();
  });

  it('should return null on completions query error', async () => {
    setupStatsMocks({
      codeData: { total_referrals: 3 },
      codeError: null,
      completions: null,
      compError: { message: 'timeout' },
    });

    const result = await getMyReferralStats(VALID_UUID);

    expect(result).toBeNull();
  });
});

// ================================================================
// UUID validation
// ================================================================
describe('UUID validation', () => {
  it('should reject invalid UUID in checkPendingReferrals', async () => {
    const result = await checkPendingReferrals('not-a-uuid');

    expect(result).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('should reject empty string in checkPendingReferrals', async () => {
    const result = await checkPendingReferrals('');

    expect(result).toBeNull();
  });

  it('should reject null in checkPendingReferrals', async () => {
    const result = await checkPendingReferrals(null);

    expect(result).toBeNull();
  });

  it('should reject invalid UUID in getMyReferralStats', async () => {
    const result = await getMyReferralStats('bad-uuid');

    expect(result).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('should reject empty string in getMyReferralStats', async () => {
    const result = await getMyReferralStats('');

    expect(result).toBeNull();
  });

  it('should reject null in getMyReferralStats', async () => {
    const result = await getMyReferralStats(null);

    expect(result).toBeNull();
  });
});

// ================================================================
// checkPendingReferrals
// ================================================================
describe('checkPendingReferrals', () => {
  it('should return 0 when no pending completions exist', async () => {
    // from("referral_completions").select().or().eq().lt() resolves via the builder chain
    // The final call in the chain (lt) must be awaitable
    const pendingBuilder = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    mockFrom.mockReturnValueOnce(pendingBuilder);

    const result = await checkPendingReferrals(VALID_UUID);

    expect(result).toBe(0);
  });

  it('should return 0 when pendingCompletions is null', async () => {
    const pendingBuilder = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    mockFrom.mockReturnValueOnce(pendingBuilder);

    const result = await checkPendingReferrals(VALID_UUID);

    expect(result).toBe(0);
  });

  it('should return null on fetch error', async () => {
    const pendingBuilder = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({ data: null, error: { message: 'fetch fail' } }),
    };
    mockFrom.mockReturnValueOnce(pendingBuilder);

    const result = await checkPendingReferrals(VALID_UUID);

    expect(result).toBeNull();
  });

  it('should complete referrals with retention activity', async () => {
    const completionId = 'comp-id-1';
    const refereeFamilyId = VALID_UUID_2;
    const createdAt = '2026-03-10T00:00:00Z';

    // 1st from() → referral_completions query
    const pendingBuilder = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({
        data: [{ id: completionId, referee_family_id: refereeFamilyId, created_at: createdAt }],
        error: null,
      }),
    };

    // 2nd from() → point_transactions retention check
    const txBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockResolvedValue({ count: 3, error: null }),
    };

    mockFrom
      .mockReturnValueOnce(pendingBuilder)
      .mockReturnValueOnce(txBuilder);

    // RPC for complete_referral_reward
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const result = await checkPendingReferrals(VALID_UUID);

    expect(result).toBe(1);
    expect(mockRpc).toHaveBeenCalledWith('complete_referral_reward', {
      p_completion_id: completionId,
    });
  });

  it('should skip completions without retention activity', async () => {
    const pendingBuilder = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({
        data: [{ id: 'c1', referee_family_id: VALID_UUID_2, created_at: '2026-03-10T00:00:00Z' }],
        error: null,
      }),
    };

    const txBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockResolvedValue({ count: 0, error: null }),
    };

    mockFrom
      .mockReturnValueOnce(pendingBuilder)
      .mockReturnValueOnce(txBuilder);

    const result = await checkPendingReferrals(VALID_UUID);

    expect(result).toBe(0);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

// ================================================================
// shareReferralLink
// ================================================================
describe('shareReferralLink', () => {
  beforeEach(() => {
    // Reset navigator mocks
    delete globalThis.navigator;
    globalThis.navigator = {};
  });

  it('should call navigator.share when available', async () => {
    const mockShare = vi.fn().mockResolvedValue(undefined);
    globalThis.navigator.share = mockShare;

    const result = await shareReferralLink('HYENI-ABCD-1234');

    expect(result).toBe(true);
    expect(mockShare).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '혜니캘린더 추천',
        text: expect.stringContaining('HYENI-ABCD-1234'),
      })
    );
  });

  it('should fallback to clipboard when share is not available', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    globalThis.navigator.clipboard = { writeText: mockWriteText };

    const result = await shareReferralLink('HYENI-XXXX-0000');

    expect(result).toBe(true);
    expect(mockWriteText).toHaveBeenCalledWith(
      expect.stringContaining('HYENI-XXXX-0000')
    );
  });

  it('should include play store link in share text', async () => {
    const mockShare = vi.fn().mockResolvedValue(undefined);
    globalThis.navigator.share = mockShare;

    await shareReferralLink('HYENI-TEST-CODE');

    const shareCall = mockShare.mock.calls[0][0];
    expect(shareCall.text).toContain('play.google.com');
  });

  it('should return false when all share methods fail', async () => {
    // No share, no clipboard
    const result = await shareReferralLink('HYENI-FAIL-0000');

    expect(result).toBe(false);
  });
});
