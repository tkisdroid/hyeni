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
  const { data, error } = await supabase
    .from("families")
    .select("id, playdate_enabled")
    .eq("id", familyId)
    .maybeSingle();
  if (error) throw error;
  return data?.playdate_enabled ?? true;
}

export default function FriendPlaydatePanel({ familyId, currentUserId, hideActiveCard = false, compact = false }) {
  const [enabled, setEnabled] = useState(true);
  const [places, setPlaces] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  const reload = async () => {
    if (!familyId) return;
    try {
      const [enabledFlag, sp, active, hist] = await Promise.all([
        fetchFamilyEnabled(familyId).catch(() => true),
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
      <div style={{ padding: compact ? 8 : 12, color: "#6B7280", fontSize: compact ? 12 : 14 }}>친구놀이 정보 불러오는 중...</div>
    );
  }

  if (compact) {
    return (
      <section aria-label="친구놀이 패널" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 12, background: "#DCFCE7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🤝</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 950, color: "#064E3B" }}>친구놀이</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: enabled ? "#059669" : "#9CA3AF", marginTop: 2 }}>
              {enabled ? "안전장소 매칭 대기" : "매칭 꺼짐"}
            </div>
          </div>
          <div style={{ width: 128, flexShrink: 0 }}>
            <FriendPlaydateToggle
              familyId={familyId}
              enabled={enabled}
              onChange={setEnabled}
              compact
            />
          </div>
        </div>
        {activeSession && !hideActiveCard && <ActivePlaydateCard session={activeSession} onEnd={reload} />}
        {enabled && (
          <button
            type="button"
            onClick={() => setShowDetails((open) => !open)}
            style={{
              alignSelf: "flex-start",
              border: "none",
              background: "transparent",
              color: "#047857",
              fontSize: 11,
              fontWeight: 900,
              cursor: "pointer",
              padding: 0,
            }}
          >
            {showDetails ? "관리 접기" : "안전장소 관리"}
          </button>
        )}
        {showDetails && enabled && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <PlaydateSafePlaceList places={places} onUpdate={reload} />
            <PlaydateHistory history={history} />
          </div>
        )}
      </section>
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
      <PlaydateSafePlaceList places={places} onUpdate={reload} />
      {enabled && (
        <>
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
