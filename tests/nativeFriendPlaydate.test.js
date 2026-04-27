// tests/nativeFriendPlaydate.test.js
import { describe, it, expect } from 'vitest';

describe('Friend Playdate FCM payload contract', () => {
  it('playdate_started payload shape', () => {
    const data = {
      action: 'playdate_started',
      session_id: 'sess-1',
      place_name: '한강공원',
      my_child_name: '혜니',
      friend_child_name: '지민',
      friend_family_phones: JSON.stringify(['010-1111-2222']),
    };
    expect(data.action).toBe('playdate_started');
    expect(data.session_id).toMatch(/^sess-/);
  });

  it('playdate_ended payload shape', () => {
    const data = {
      action: 'playdate_ended',
      session_id: 'sess-1',
      stop_reason: 'auto_geofence_exit',
      place_name: '한강공원',
    };
    expect(['child_end', 'parent_end', 'auto_geofence_exit']).toContain(data.stop_reason);
  });
});
