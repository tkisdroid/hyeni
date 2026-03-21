import { vi, describe, it, expect, beforeEach } from 'vitest';

const {
  mockEarnAttendance, mockEarnArrival, mockCheckAndEarnStreak,
  mockEarnEventCreate, mockEarnGguk, mockEarnMemo, mockEarnAcademyRegister,
  mockGetWallet, mockCheckPendingReferrals,
} = vi.hoisted(() => ({
  mockEarnAttendance: vi.fn(),
  mockEarnArrival: vi.fn(),
  mockCheckAndEarnStreak: vi.fn(),
  mockEarnEventCreate: vi.fn(),
  mockEarnGguk: vi.fn(),
  mockEarnMemo: vi.fn(),
  mockEarnAcademyRegister: vi.fn(),
  mockGetWallet: vi.fn(),
  mockCheckPendingReferrals: vi.fn(),
}));

vi.mock('../hyeniService.js', () => ({
  earnAttendance: mockEarnAttendance,
  earnArrival: mockEarnArrival,
  checkAndEarnStreak: mockCheckAndEarnStreak,
  earnEventCreate: mockEarnEventCreate,
  earnGguk: mockEarnGguk,
  earnMemo: mockEarnMemo,
  earnAcademyRegister: mockEarnAcademyRegister,
  getWallet: mockGetWallet,
}));

vi.mock('../referralService.js', () => ({
  checkPendingReferrals: mockCheckPendingReferrals,
}));

import { HyeniEngine } from '../hyeniEngine.js';

describe('HyeniEngine', () => {
  let engine;
  const familyId = 'fam-123';
  const memberId = 'mem-456';

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new HyeniEngine(familyId, memberId);
  });

  describe('reward(action, context)', () => {
    it('attendance — should earn 1혜니 and return toast info', async () => {
      mockEarnAttendance.mockResolvedValue({ success: true, balance: 10, earned: 1 });
      mockCheckPendingReferrals.mockResolvedValue(0);
      mockGetWallet.mockResolvedValue({ balance: 10 });

      const result = await engine.reward('attendance');

      expect(mockEarnAttendance).toHaveBeenCalledWith(familyId, memberId);
      expect(result.earned).toBe(1);
      expect(result.category).toBe('attendance');
      expect(result.toast).toBeTruthy();
    });

    it('arrival — normal: 3혜니, early: 5혜니', async () => {
      mockEarnArrival.mockResolvedValue({ success: true });
      mockCheckAndEarnStreak.mockResolvedValue({ streak: 3, bonus: 0 });

      const normal = await engine.reward('arrival', { eventId: 'e1', isEarly: false });
      expect(mockEarnArrival).toHaveBeenCalledWith(familyId, memberId, 'e1', false);
      expect(normal.earned).toBe(3);

      const early = await engine.reward('arrival', { eventId: 'e2', isEarly: true });
      expect(mockEarnArrival).toHaveBeenCalledWith(familyId, memberId, 'e2', true);
      expect(early.earned).toBe(5);
    });

    it('arrival — should also check streak and return bonus', async () => {
      mockEarnArrival.mockResolvedValue({ success: true });
      mockCheckAndEarnStreak.mockResolvedValue({ streak: 7, bonus: 10 });

      const result = await engine.reward('arrival', { eventId: 'e1', isEarly: false });

      expect(mockCheckAndEarnStreak).toHaveBeenCalledWith(familyId, memberId);
      expect(result.streakBonus).toBe(10);
      expect(result.streak).toBe(7);
    });

    it('event_create — 1혜니', async () => {
      mockEarnEventCreate.mockResolvedValue({ success: true });
      const result = await engine.reward('event_create');
      expect(result.earned).toBe(1);
      expect(result.category).toBe('event_create');
    });

    it('gguk — 1혜니', async () => {
      mockEarnGguk.mockResolvedValue({ success: true });
      const result = await engine.reward('gguk');
      expect(result.earned).toBe(1);
    });

    it('memo — 1혜니', async () => {
      mockEarnMemo.mockResolvedValue({ success: true });
      const result = await engine.reward('memo');
      expect(result.earned).toBe(1);
    });

    it('academy_register — 3혜니', async () => {
      mockEarnAcademyRegister.mockResolvedValue({ success: true });
      const result = await engine.reward('academy_register');
      expect(result.earned).toBe(3);
    });

    it('daily limit reached — should return earned=0, no toast', async () => {
      mockEarnGguk.mockResolvedValue({ success: false, error: 'daily_limit_reached' });
      const result = await engine.reward('gguk');
      expect(result.earned).toBe(0);
      expect(result.toast).toBeFalsy();
    });

    it('error — should not throw, return earned=0', async () => {
      mockEarnMemo.mockRejectedValue(new Error('network'));
      const result = await engine.reward('memo');
      expect(result.earned).toBe(0);
      expect(result.error).toBeTruthy();
    });

    it('unknown action — should return earned=0', async () => {
      const result = await engine.reward('unknown_action');
      expect(result.earned).toBe(0);
    });
  });

  describe('initSession()', () => {
    it('should earn attendance + check referrals + load wallet', async () => {
      mockEarnAttendance.mockResolvedValue({ success: true });
      mockCheckPendingReferrals.mockResolvedValue(0);
      mockGetWallet.mockResolvedValue({ balance: 50, streak_days: 3 });

      const result = await engine.initSession();

      expect(mockEarnAttendance).toHaveBeenCalled();
      expect(mockCheckPendingReferrals).toHaveBeenCalledWith(familyId);
      expect(mockGetWallet).toHaveBeenCalledWith(familyId);
      expect(result.balance).toBe(50);
      expect(result.streak).toBe(3);
      expect(result.attendanceEarned).toBe(true);
    });

    it('should not crash if any sub-call fails', async () => {
      mockEarnAttendance.mockRejectedValue(new Error('fail'));
      mockCheckPendingReferrals.mockRejectedValue(new Error('fail'));
      mockGetWallet.mockRejectedValue(new Error('fail'));

      const result = await engine.initSession();
      expect(result.balance).toBe(0);
      expect(result.attendanceEarned).toBe(false);
    });
  });
});
