import { useEffect, useState } from "react";
import FriendPlaydateToggle from "./FriendPlaydateToggle.jsx";
import PlaydateSafePlaceList from "./PlaydateSafePlaceList.jsx";
import ActivePlaydateCard from "./ActivePlaydateCard.jsx";
import PlaydateHistory from "./PlaydateHistory.jsx";
import { ThreeDIcon } from "../icons/ThreeDIcon.jsx";
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

const legacyTextStyle = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  border: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
};

export default function FriendPlaydatePanel({ familyId, currentUserId: _currentUserId, hideActiveCard = false, compact = false, onAddSafePlace }) {
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
      <section className="hyeni-tool hyeni-tool--friend">
        <div className="hyeni-tool-empty" style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "16px" }}>
          <ThreeDIcon name="clover" size={28} aria-label="" />
          <span>친구놀이 정보 불러오는 중…</span>
        </div>
      </section>
    );
  }

  if (compact) {
    return (
      <section className="hyeni-tool hyeni-tool--friend" aria-label="친구놀이 패널">
        <div className="hyeni-tool-tile">
          <div className="hyeni-tool-tile__glyph" aria-hidden="true" style={{ background: "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <ThreeDIcon name="friend-pair" size={32} aria-label="" />
          </div>
          <div className="hyeni-tool-tile__body">
            <div className="hyeni-tool-tile__title">친구놀이</div>
            <div
              className="hyeni-tool-tile__sub"
              style={{ color: enabled ? 'var(--hyeni-friend-ink)' : 'var(--fg-tertiary)' }}
            >
              {enabled ? '친구 자동 매칭 대기 중' : '친구 자동 매칭 꺼짐'}
            </div>
          </div>
          <div className="hyeni-tool-tile__cta">
            <FriendPlaydateToggle
              familyId={familyId}
              enabled={enabled}
              onChange={setEnabled}
              compact
            />
          </div>
        </div>

        {activeSession && !hideActiveCard && (
          <ActivePlaydateCard session={activeSession} onEnd={reload} />
        )}

        {enabled && (
          <button
            type="button"
            onClick={() => setShowDetails((open) => !open)}
            className="hyeni-tool-disclosure"
            aria-expanded={showDetails}
          >
            <span className="hyeni-tool-disclosure__chev" aria-hidden="true">›</span>
            {showDetails ? '관리 접기' : '안전장소 관리'}
          </button>
        )}
        {showDetails && enabled && (
          <>
            <PlaydateSafePlaceList places={places} onUpdate={reload} />
            <PlaydateHistory history={history} />
          </>
        )}
      </section>
    );
  }

  return (
    <section className="hyeni-tool hyeni-tool--friend" aria-label="친구놀이 패널">
      <FriendPlaydateToggle
        familyId={familyId}
        enabled={enabled}
        onChange={setEnabled}
      />

      <div>
        <div style={{
          margin: '4px 2px 8px',
          color: 'var(--fg-secondary)',
          fontSize: 12,
          fontWeight: 900,
          letterSpacing: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <ThreeDIcon name="pin-heart" size={14} aria-label="" />
          친구놀이 안전장소
          <span style={legacyTextStyle}>친구 만남 안전 장소</span>
        </div>
        <PlaydateSafePlaceList
          places={places}
          onUpdate={reload}
          onAdd={onAddSafePlace}
        />
      </div>

      {enabled && (
        <>
          {activeSession && !hideActiveCard && (
            <ActivePlaydateCard session={activeSession} onEnd={reload} />
          )}
          <div>
            <div style={{
              margin: '4px 2px 8px',
              color: 'var(--fg-secondary)',
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <ThreeDIcon name="clover" size={14} aria-label="" />
              최근 친구놀이 기록
            </div>
            <PlaydateHistory history={history} />
          </div>
        </>
      )}
    </section>
  );
}
