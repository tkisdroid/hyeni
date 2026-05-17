import { useCallback, useEffect, useState } from "react";
import PlaydateStartButton from "./PlaydateStartButton.jsx";
import FriendCandidateList from "./FriendCandidateList.jsx";
import ActivePlaydateChildView from "./ActivePlaydateChildView.jsx";
import {
  findCandidates,
  startPlaydate,
  fetchActiveSession,
  subscribeActiveSession,
} from "../../lib/friendPlaydate.js";
import { deferEffectStateUpdate } from "../../lib/deferEffectStateUpdate.js";
import { appToast } from "../../lib/appToast.js";

export default function FriendPlaydateChildPanel({ familyId, currentUserId }) {
  const [phase, setPhase] = useState("idle");
  const [inSafePlace, setInSafePlace] = useState(false);
  const [publicPlaceId, setPublicPlaceId] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [activeSession, setActiveSession] = useState(null);

  const reload = useCallback(async () => {
    if (!familyId) return;
    const active = await fetchActiveSession(familyId).catch(() => null);
    if (active) {
      setActiveSession(active);
      setPhase("active");
      return;
    }
    setActiveSession(null);
    const result = await findCandidates(familyId).catch(() => ({
      candidates: [],
      error: "rpc_failed",
    }));
    setInSafePlace(!!result?.public_place_id);
    setPublicPlaceId(result?.public_place_id ?? null);
    setPhase("idle");
  }, [familyId]);

  useEffect(() => {
    if (!familyId) return undefined;
    const cancelInitial = deferEffectStateUpdate(() => {
      void reload();
    });
    const unsub = subscribeActiveSession(familyId, () => {
      void reload();
    });
    return () => {
      cancelInitial();
      unsub?.();
    };
  }, [familyId, reload]);

  const handleDiscover = async () => {
    try {
      const result = await findCandidates(familyId);
      setCandidates(result?.candidates ?? []);
      setPublicPlaceId(result?.public_place_id ?? null);
      setPhase("discover");
    } catch (e) {
      console.error("[FriendPlaydateChildPanel.discover]", e);
      appToast("친구를 찾는 데 실패했어요. 다시 해줘");
    }
  };

  const handleStart = async (candidate) => {
    if (!candidate || !publicPlaceId) return;
    setPhase("starting");
    try {
      await startPlaydate({
        publicPlaceId,
        familyAId: familyId,
        familyBId: candidate.family_id,
        childAId: currentUserId,
        childBId: candidate.child_user_id,
        initiatorUserId: currentUserId,
      });
      await reload();
    } catch (e) {
      console.error("[FriendPlaydateChildPanel.start]", e);
      appToast("시작에 실패했어요. 다시 해줘");
      setPhase("idle");
    }
  };

  if (!familyId) return null;

  if (phase === "active" && activeSession) {
    return <ActivePlaydateChildView session={activeSession} onEnd={reload} />;
  }

  if (phase === "discover") {
    return (
      <FriendCandidateList
        candidates={candidates}
        onStart={handleStart}
        onCancel={() => setPhase("idle")}
      />
    );
  }

  return <PlaydateStartButton inSafePlace={inSafePlace} onClick={handleDiscover} />;
}
