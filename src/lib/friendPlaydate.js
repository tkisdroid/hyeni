// 친구놀이(friend_playdate) 클라이언트 wrapper.
// Edge Function `push-notify` (action=playdate_started/playdate_ended) +
// SECURITY DEFINER RPC find_playdate_candidates와 양방향 toggle 정책을
// 한 군데로 모아 App.jsx 호출부를 단순화한다. Spec: FP-D14.

import { supabase } from "./supabase.js";

export async function findCandidates(_familyId) {
  throw new Error("not_implemented");
}

export async function startPlaydate(_opts) {
  throw new Error("not_implemented");
}

export async function endPlaydate(_sessionId, _stopReason) {
  throw new Error("not_implemented");
}

export async function upsertPublicPlace(_opts) {
  throw new Error("not_implemented");
}

export async function setFamilyPlaydateEnabled(_familyId, _enabled) {
  throw new Error("not_implemented");
}

export async function setSavedPlacePlaydateSafe(_savedPlaceId, _isSafe, _publicPlaceId) {
  throw new Error("not_implemented");
}

export function subscribeActiveSession(_familyId, _onChange) {
  throw new Error("not_implemented");
}

export async function fetchActiveSession(_familyId) {
  throw new Error("not_implemented");
}

export async function fetchHistory(_familyId, _limit = 10) {
  throw new Error("not_implemented");
}
