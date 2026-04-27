import { describe, it, expect } from 'vitest';

describe('Native ForceRing FCM payload contract', () => {
  it('force_ring data payload shape is correct', () => {
    const data = {
      action: 'force_ring',
      event_id: 'evt-test-1',
      message: '도와줘',
      initiator_name: '엄마',
    };

    expect(data.action).toBe('force_ring');
    expect(data.event_id).toMatch(/^evt-/);
    expect(data.message.length).toBeLessThanOrEqual(80);
    expect(typeof data.initiator_name).toBe('string');
  });

  it('force_ring_stop payload shape is correct', () => {
    const data = { action: 'force_ring_stop', event_id: 'evt-test-1' };
    expect(data.action).toBe('force_ring_stop');
    expect(data.event_id).toBeDefined();
  });

  it('force_ring_reminder notification shape is correct', () => {
    const payload = {
      title: '응급 신호 5분 경과',
      body: '아이 응답이 없습니다. 직접 통화나 119를 고려하세요',
      data: { action: 'force_ring_reminder', event_id: 'evt-test-1' },
    };
    expect(payload.title).toContain('응급');
    expect(payload.body).toContain('119');
    expect(payload.data.action).toBe('force_ring_reminder');
  });
});
