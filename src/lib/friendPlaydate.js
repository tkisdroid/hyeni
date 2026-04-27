// 친구놀이(friend_playdate) 클라이언트 wrapper.
// Edge Function `push-notify` (action=playdate_started/playdate_ended) +
// SECURITY DEFINER RPC find_playdate_candidates와 양방향 toggle 정책을
// 한 군데로 모아 App.jsx 호출부를 단순화한다. Spec: FP-D14.

import { supabase } from "./supabase.js";

const VALID_STOP_REASONS = ["child_end", "parent_end", "auto_geofence_exit"];

export async function findCandidates(familyId) {
  if (!familyId) throw new Error("familyId required");
  const { data, error } = await supabase.rpc("find_playdate_candidates", {
    p_family_id: familyId,
  });
  if (error) throw error;
  return data ?? { candidates: [], public_place_id: null };
}

export async function startPlaydate({
  publicPlaceId,
  familyAId,
  familyBId,
  childAId,
  childBId,
  initiatorUserId,
}) {
  if (
    !publicPlaceId ||
    !familyAId ||
    !familyBId ||
    !childAId ||
    !childBId ||
    !initiatorUserId
  ) {
    throw new Error("startPlaydate: missing required field");
  }
  if (familyAId === familyBId) throw new Error("cannot match same family");

  const { data: row, error: insertErr } = await supabase
    .from("friend_playdate_sessions")
    .insert({
      public_place_id: publicPlaceId,
      family_a_id: familyAId,
      family_b_id: familyBId,
      child_a_id: childAId,
      child_b_id: childBId,
      initiator_user_id: initiatorUserId,
    })
    .select()
    .single();

  if (insertErr) throw insertErr;

  const { data: pushResult, error: pushErr } = await supabase.functions.invoke(
    "push-notify",
    {
      body: { action: "playdate_started", session_id: row.id },
    },
  );
  if (pushErr) {
    return { session_id: row.id, delivered: false, error: pushErr.message };
  }
  return { session_id: row.id, delivered: !!pushResult?.delivered };
}

export async function endPlaydate(sessionId, stopReason) {
  if (!sessionId) throw new Error("sessionId required");
  if (!VALID_STOP_REASONS.includes(stopReason)) {
    throw new Error(`invalid stop_reason: ${stopReason}`);
  }

  const { error: updErr } = await supabase
    .from("friend_playdate_sessions")
    .update({ stopped_at: new Date().toISOString(), stop_reason: stopReason })
    .eq("id", sessionId)
    .select();
  if (updErr) throw updErr;

  const { error: pushErr } = await supabase.functions.invoke("push-notify", {
    body: { action: "playdate_ended", session_id: sessionId },
  });
  if (pushErr) console.warn("[endPlaydate] push failed", pushErr);
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
