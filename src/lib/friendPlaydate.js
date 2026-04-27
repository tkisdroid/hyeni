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

export async function upsertPublicPlace({ kakaoPlaceId, name, lat, lng }) {
  if (!name || lat == null || lng == null) {
    throw new Error("upsertPublicPlace: name + lat + lng required");
  }

  // public_places는 INSERT-only RLS(WITH CHECK kakao_place_id IS NOT NULL)이고
  // UPDATE policy가 없다. UPSERT를 쓰면 conflict 시 UPDATE 분기로 빠져 RLS에
  // 거부되므로, kakao_place_id가 있을 때는 SELECT-then-INSERT 패턴으로 처리한다.
  if (kakaoPlaceId) {
    const { data: existing, error: selectErr } = await supabase
      .from("public_places")
      .select("id")
      .eq("kakao_place_id", kakaoPlaceId)
      .maybeSingle();
    if (selectErr) throw selectErr;
    if (existing) return existing.id;

    const { data, error } = await supabase
      .from("public_places")
      .insert({ kakao_place_id: kakaoPlaceId, name, lat, lng })
      .select()
      .single();
    if (error) throw error;
    return data.id;
  }

  const { data, error } = await supabase
    .from("public_places")
    .insert({ name, lat, lng })
    .select()
    .single();
  if (error) throw error;
  return data.id;
}

export async function setFamilyPlaydateEnabled(familyId, enabled) {
  if (!familyId) throw new Error("familyId required");
  const { error } = await supabase
    .from("families")
    .update({ playdate_enabled: !!enabled })
    .eq("id", familyId);
  if (error) throw error;
}

export async function setSavedPlacePlaydateSafe(
  savedPlaceId,
  isSafe,
  publicPlaceId = null,
) {
  if (!savedPlaceId) throw new Error("savedPlaceId required");
  const update = { is_playdate_safe: !!isSafe };
  if (publicPlaceId) update.public_place_id = publicPlaceId;

  const { error } = await supabase
    .from("saved_places")
    .update(update)
    .eq("id", savedPlaceId);
  if (error) throw error;
}

// PIPA: 명시적 컬럼 projection으로 타가족 child auth UUID 노출 차단.
// place_name / friend_child_name / friend_family_phones는 FCM payload 또는
// SECURITY DEFINER RPC `get_active_playdate_session`에서 enrich.
const SESSION_DISPLAY_COLS =
  "id, public_place_id, family_a_id, family_b_id, started_at, stopped_at, stop_reason";

export async function fetchActiveSession(familyId) {
  if (!familyId) throw new Error("familyId required");
  // 패널을 직접 열 때 (FCM 미수신 상태) friend_family_phones / friend_child_name /
  // place_name이 비어 표시되는 문제 → SECURITY DEFINER RPC로 perspective-aware
  // enrich. families RLS는 자가족만 read 허용해서 client-side JOIN 불가.
  const { data, error } = await supabase.rpc("get_active_playdate_session", {
    p_family_id: familyId,
  });
  if (error) throw error;
  return data ?? null;
}

export async function fetchHistory(familyId, limit = 10) {
  if (!familyId) throw new Error("familyId required");
  const { data, error } = await supabase
    .from("friend_playdate_sessions")
    .select(SESSION_DISPLAY_COLS)
    .or(`family_a_id.eq.${familyId},family_b_id.eq.${familyId}`)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export function subscribeActiveSession(familyId, onChange) {
  if (!familyId) throw new Error("familyId required");
  const channel = supabase
    .channel(`friend_playdate-${familyId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "friend_playdate_sessions",
        filter: `family_a_id=eq.${familyId}`,
      },
      (payload) => onChange(payload),
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "friend_playdate_sessions",
        filter: `family_b_id=eq.${familyId}`,
      },
      (payload) => onChange(payload),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
