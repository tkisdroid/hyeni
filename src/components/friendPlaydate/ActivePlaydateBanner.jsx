// 활성 친구놀이 알림 (hero 바로 아래). FriendPlaydatePanel 안의 ActivePlaydateCard와
// 다르게 condensed 형태로 페이지 상단에 항상 보이도록 한다.
// 부모/아이 모드 공용. 활성 세션 없으면 null.
import { useEffect, useState } from "react";
import {
  fetchActiveSession,
  subscribeActiveSession,
  endPlaydate,
} from "../../lib/friendPlaydate.js";

function formatPhoneTel(p) {
  return `tel:${p.replace(/[^\d+]/g, "")}`;
}

export default function ActivePlaydateBanner({ familyId, isParent }) {
  const [session, setSession] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!familyId) return;
    let alive = true;
    const load = async () => {
      const s = await fetchActiveSession(familyId).catch(() => null);
      if (alive) setSession(s);
    };
    load();
    const unsub = subscribeActiveSession(familyId, load);
    return () => {
      alive = false;
      unsub?.();
    };
  }, [familyId]);

  if (!session) return null;

  const phones = (session.friend_family_phones ?? []).filter(Boolean);
  const friendChild = session.friend_child_name ?? "친구";
  const placeName = session.place_name ?? "안전장소";

  const handleStop = async () => {
    if (busy) return;
    if (!confirm(`${friendChild}와의 친구놀이를 정지하시겠어요?`)) return;
    setBusy(true);
    try {
      await endPlaydate(session.id, "parent_end");
      setSession(null);
    } catch (e) {
      console.error("[ActivePlaydateBanner.stop]", e);
      alert("정지에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="status"
      aria-label="친구놀이 진행 중"
      style={{
        width: "100%",
        marginTop: 12,
        padding: "12px 14px",
        borderRadius: 18,
        background: "linear-gradient(135deg,#ECFDF5,#D1FAE5)",
        border: "1.5px solid #6EE7B7",
        boxShadow: "0 6px 16px rgba(16,185,129,0.18)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 900,
            color: "#065F46",
            lineHeight: 1.35,
          }}
        >
          🎈 {placeName}에서 {friendChild}와 놀고 있어요
        </div>
        {isParent && (
          <button
            type="button"
            onClick={handleStop}
            disabled={busy}
            aria-label="친구놀이 정지"
            style={{
              flexShrink: 0,
              padding: "7px 12px",
              borderRadius: 10,
              border: "none",
              background: "#DC2626",
              color: "#fff",
              fontWeight: 800,
              fontSize: 12,
              cursor: busy ? "wait" : "pointer",
            }}
          >
            🛑 정지
          </button>
        )}
      </div>

      {isParent && phones.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {phones.map((p) => (
            <a
              key={p}
              href={formatPhoneTel(p)}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                border: "1px solid #10B981",
                background: "#fff",
                color: "#065F46",
                textDecoration: "none",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              📞 {p}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
