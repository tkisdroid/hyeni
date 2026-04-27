import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockFunctionsInvoke = vi.fn();
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
  unsubscribe: vi.fn(),
};
const mockSupabase = {
  functions: { invoke: mockFunctionsInvoke },
  channel: vi.fn().mockReturnValue(mockChannel),
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
};

vi.mock('../src/lib/supabase.js', () => ({ supabase: mockSupabase }));

describe('forceRing client lib', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFunctionsInvoke.mockReset();
  });

  describe('triggerForceRing', () => {
    it('truncates message to 80 chars', async () => {
      const { triggerForceRing } = await import('../src/lib/forceRing.js');
      mockFunctionsInvoke.mockResolvedValue({
        data: { event_id: 'evt-1', delivered: true },
        error: null,
      });

      const longMsg = 'a'.repeat(120);
      await triggerForceRing({ familyId: 'fam-1', message: longMsg });

      const callBody = mockFunctionsInvoke.mock.calls[0][1].body;
      expect(callBody.message.length).toBe(80);
    });

    it('generates client_request_hash automatically', async () => {
      const { triggerForceRing } = await import('../src/lib/forceRing.js');
      mockFunctionsInvoke.mockResolvedValue({
        data: { event_id: 'evt-1' },
        error: null,
      });

      await triggerForceRing({ familyId: 'fam-1', message: 'help' });

      const callBody = mockFunctionsInvoke.mock.calls[0][1].body;
      expect(callBody.client_request_hash).toBeTruthy();
      expect(callBody.client_request_hash.length).toBeGreaterThan(8);
    });

    it('returns error=force_ring_quota_exceeded on 429', async () => {
      const { triggerForceRing } = await import('../src/lib/forceRing.js');
      mockFunctionsInvoke.mockResolvedValue({
        data: null,
        error: { context: { status: 429 }, message: 'force_ring_quota_exceeded' },
      });

      const result = await triggerForceRing({ familyId: 'fam-1' });
      expect(result.error).toBe('force_ring_quota_exceeded');
      expect(result.delivered).toBe(false);
    });

    it('throws on 5s timeout', async () => {
      const { triggerForceRing } = await import('../src/lib/forceRing.js');
      mockFunctionsInvoke.mockReturnValue(new Promise(() => {}));

      await expect(
        triggerForceRing({ familyId: 'fam-1', timeoutMs: 100 })
      ).rejects.toThrow(/timeout/i);
    });

    it('throws when familyId missing', async () => {
      const { triggerForceRing } = await import('../src/lib/forceRing.js');
      await expect(triggerForceRing({})).rejects.toThrow(/familyId/i);
    });
  });

  describe('stopForceRing', () => {
    it('calls force_ring_stop action with event_id', async () => {
      const { stopForceRing } = await import('../src/lib/forceRing.js');
      mockFunctionsInvoke.mockResolvedValue({ data: { stopped: true }, error: null });

      await stopForceRing('evt-1');

      expect(mockFunctionsInvoke).toHaveBeenCalledWith(
        'push-notify',
        expect.objectContaining({
          body: expect.objectContaining({ action: 'force_ring_stop', event_id: 'evt-1' }),
        })
      );
    });

    it('throws when eventId missing', async () => {
      const { stopForceRing } = await import('../src/lib/forceRing.js');
      await expect(stopForceRing()).rejects.toThrow(/eventId/i);
    });
  });

  describe('subscribeForceRingStatus', () => {
    it('subscribes to force_ring_events:id=eq.<event_id>', async () => {
      const { subscribeForceRingStatus } = await import('../src/lib/forceRing.js');
      const callback = vi.fn();

      const channel = subscribeForceRingStatus('evt-1', callback);

      expect(mockSupabase.channel).toHaveBeenCalledWith(expect.stringContaining('evt-1'));
      expect(channel.subscribe).toBeDefined();
    });
  });
});
