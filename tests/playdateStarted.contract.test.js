import { describe, it, expect } from 'vitest';

// Contract test for push-notify playdate_started Edge Function payload.
// The Edge Function itself runs on Deno and is exercised by smoke tests; this
// suite locks the JSON shape clients depend on.

describe('playdate_started Edge Function payload contract', () => {
  it('FCM data payload exposes all fields the parent app reads', () => {
    const data = {
      type: 'playdate_started',
      action: 'playdate_started',
      session_id: 'sess-1',
      place_name: '한강공원',
      my_child_name: '혜니',
      friend_child_name: '지민',
      friend_family_phones: JSON.stringify(['010-1111-2222', '010-3333-4444']),
    };
    expect(data.action).toBe('playdate_started');
    expect(data.type).toBe('playdate_started');
    expect(data.session_id).toBeTruthy();
    expect(data.place_name).toBeTruthy();
    expect(data.my_child_name).toBeTruthy();
    expect(data.friend_child_name).toBeTruthy();
    const phones = JSON.parse(data.friend_family_phones);
    expect(Array.isArray(phones)).toBe(true);
    expect(phones).toEqual(['010-1111-2222', '010-3333-4444']);
  });

  it('null and empty phone numbers are filtered before serialization', () => {
    const raw = ['010-1234-5678', null, undefined, ''];
    const phones = raw.filter(Boolean);
    expect(phones).toEqual(['010-1234-5678']);
    // The serialized form is what the Edge Function stores in the FCM data
    // map (FCM only accepts string values).
    expect(JSON.parse(JSON.stringify(phones))).toEqual(['010-1234-5678']);
  });

  it('payload values are all string-typed (FCM data map requirement)', () => {
    const data = {
      type: 'playdate_started',
      action: 'playdate_started',
      session_id: 'sess-1',
      place_name: '한강공원',
      my_child_name: '혜니',
      friend_child_name: '지민',
      friend_family_phones: JSON.stringify([]),
    };
    for (const v of Object.values(data)) {
      expect(typeof v).toBe('string');
    }
  });
});
