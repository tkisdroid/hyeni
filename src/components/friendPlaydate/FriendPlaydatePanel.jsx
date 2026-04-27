import { useEffect, useState } from "react";
import FriendPlaydateToggle from "./FriendPlaydateToggle.jsx";
import PlaydateSafePlaceList from "./PlaydateSafePlaceList.jsx";
import ActivePlaydateCard from "./ActivePlaydateCard.jsx";
import PlaydateHistory from "./PlaydateHistory.jsx";
import {
  fetchActiveSession,
  fetchHistory,
  subscribeActiveSession,
} from "../../lib/friendPlaydate.js";
import { fetchSavedPlaces } from "../../lib/sync.js";
import { supabase } from "../../lib/supabase.js";

async function fetchFamilyEnabled(familyId) {
  const { data } = await supabase
    .from("families")
    .select("id, playdate_enabled")
    .eq("id", familyId)
    .maybeSingle();
  return !!data?.playdate_enabled;
}

export default function FriendPlaydatePanel({ familyId, currentUserId, hideActiveCard = false }) {
  const [enabled, setEnabled] = useState(false);
  const [places, setPlaces] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    if (!familyId) return;
    try {
      const [enabledFlag, sp, active, hist] = await Promise.all([
        fetchFamilyEnabled(familyId).catch(() => false),
        fetchSavedPlaces(familyId).catch(() => []),
        fetchActiveSession(familyId).catch(() => null),
        fetchHistory(familyId, 10).catch(() => []),
      ]);
      setEnabled(enabledFlag);
      setPlaces(sp ?? []);
      setActiveSession(active);
      setHistory(hist ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!familyId) return;
    reload();
    const unsub = subscribeActiveSession(familyId, () => {
      reload();
    });
    return () => {
      unsub?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId]);

  if (!familyId) return null;
  if (loading) {
    return (
      <div style={{ padding: 12 }}>친구놀이 정보 불러오는 중...</div>
    );
  }

  return (
    <section aria-label="친구놀이 패널" style={{ marginTop: 16 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
        친구놀이
      </h3>
      <FriendPlaydateToggle
        familyId={familyId}
        enabled={enabled}
        onChange={setEnabled}
      />
      {enabled && (
        <>
          <PlaydateSafePlaceList places={places} onUpdate={reload} />
          {activeSession && !hideActiveCard && (
            <div style={{ marginTop: 12 }}>
              <ActivePlaydateCard session={activeSession} onEnd={reload} />
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <PlaydateHistory history={history} />
          </div>
        </>
      )}
    </section>
  );
}
