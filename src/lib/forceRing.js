// Parent client helper — Edge Function `push-notify` action wrappers.
// Spec: docs/superpowers/specs/2026-04-27-force-ring-design.md

import { supabase } from './supabase.js';

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_MESSAGE_LENGTH = 80;

function generateRequestHash() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function withTimeout(promise, ms, label = 'timeout') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} after ${ms}ms`)), ms)
    ),
  ]);
}

export async function triggerForceRing({
  familyId,
  targetChildUserId = null,
  message = '',
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (!familyId) throw new Error('familyId required');

  const truncated = String(message || '').slice(0, MAX_MESSAGE_LENGTH);
  const clientRequestHash = generateRequestHash();

  // Phase 3 Case 2: 다자녀 가족에서 정확한 자녀에게만 SOS 보내려면 target_user_id 명시.
  // 미지정 시 Edge Function 이 children[0] 으로 fallback (단일 자녀 가족 호환).
  const body = {
    action: 'force_ring',
    family_id: familyId,
    message: truncated,
    client_request_hash: clientRequestHash,
  };
  if (targetChildUserId) body.target_user_id = targetChildUserId;

  const invocation = supabase.functions.invoke('push-notify', { body });

  const { data, error } = await withTimeout(invocation, timeoutMs, 'force_ring timeout');

  if (error) {
    const status = error?.context?.status;
    if (status === 429) {
      return { error: 'force_ring_quota_exceeded', delivered: false };
    }
    if (status === 423) {
      return { error: 'force_ring_already_active', delivered: false };
    }
    return { error: error.message || 'unknown_error', delivered: false };
  }

  return data;
}

export async function stopForceRing(eventId) {
  if (!eventId) throw new Error('eventId required');

  const { data, error } = await supabase.functions.invoke('push-notify', {
    body: { action: 'force_ring_stop', event_id: eventId },
  });

  if (error) return { stopped: false, error: error.message };
  return data;
}

export function subscribeForceRingStatus(eventId, callback) {
  if (!eventId) throw new Error('eventId required');

  const channel = supabase
    .channel(`force_ring_events:id=eq.${eventId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'force_ring_events',
        filter: `id=eq.${eventId}`,
      },
      (payload) => callback(payload.new)
    )
    .subscribe();

  return channel;
}

export async function fetchActiveForceRing(familyId) {
  if (!familyId) return null;

  const { data, error } = await supabase
    .from('force_ring_events')
    .select(
      'id, initiator_user_id, target_user_id, message, triggered_at, delivered_at, acknowledged_at, stopped_at, stop_reason'
    )
    .eq('family_id', familyId)
    .is('stopped_at', null)
    .order('triggered_at', { ascending: false })
    .limit(1);

  if (error || !data?.length) return null;
  return data[0];
}

export async function fetchForceRingHistory(familyId, limit = 10) {
  if (!familyId) return [];

  const { data, error } = await supabase
    .from('force_ring_events')
    .select(
      'id, initiator_user_id, message, triggered_at, delivered_at, acknowledged_at, stopped_at, stop_reason'
    )
    .eq('family_id', familyId)
    .order('triggered_at', { ascending: false })
    .limit(limit);

  if (error) return [];
  return data || [];
}
