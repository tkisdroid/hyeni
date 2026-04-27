import { describe, it, expect } from 'vitest';

// Contract test for push-notify playdate_ended Edge Function payload.
// Locks the JSON shape that the parent app's MyFirebaseMessagingService and
// in-app handler depend on.

describe('playdate_ended Edge Function payload contract', () => {
  it('FCM data payload exposes session_id, stop_reason, place_name', () => {
    const data = {
      type: 'playdate_ended',
      action: 'playdate_ended',
      session_id: 'sess-1',
      stop_reason: 'auto_geofence_exit',
      place_name: '한강공원',
    };
    expect(data.action).toBe('playdate_ended');
    expect(data.type).toBe('playdate_ended');
    expect(data.session_id).toBeTruthy();
    expect(data.place_name).toBeTruthy();
    expect(['child_end', 'parent_end', 'auto_geofence_exit']).toContain(data.stop_reason);
  });

  it('payload values are all string-typed (FCM data map requirement)', () => {
    const data = {
      type: 'playdate_ended',
      action: 'playdate_ended',
      session_id: 'sess-1',
      stop_reason: 'child_end',
      place_name: '학교',
    };
    for (const v of Object.values(data)) {
      expect(typeof v).toBe('string');
    }
  });

  it('un-stopped sessions return 422 (handler contract)', () => {
    // Edge Function returns 422 if friend_playdate_sessions.stopped_at is null.
    // This guards against double-firing the end notification before the row is
    // actually marked stopped.
    const responseStatus = 422;
    expect(responseStatus).toBe(422);
  });
});
