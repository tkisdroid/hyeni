// 활성 친구놀이 알림 (hero 바로 아래). FriendPlaydatePanel 안의 ActivePlaydateCard와
// 다르게 condensed 형태로 페이지 상단에 항상 보이도록 한다.
// 부모/아이 모드 공용. 활성 세션 없으면 null.
import { useEffect, useState } from "react";
import {
  fetchActiveSession,
  subscribeActiveSession,
  endPlaydate,
} from "../../lib/friendPlaydate.js";
import { withParticle } from "../../lib/koreanParticle.js";

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
    if (!confirm(`${withParticle(friendChild, "과", "와")}의 친구 만남을 정지하시겠어요?`)) return;
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
      aria-label="친구 만남 진행 중"
      className="hyeni-tool hyeni-tool--friend"
      style={{ width: "100%", marginTop: 12, gap: 10 }}
    >
      <article
        className="hyeni-tool-card hyeni-tool-card--accent"
        style={{ padding: "12px 14px" }}
      >
        <span className="hyeni-tool-card__rule" aria-hidden="true" />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <span className="hyeni-tool-card__kicker">진행 중</span>
            <div
              style={{
                fontSize: 14,
                fontWeight: 900,
                color: "var(--hyeni-friend-ink)",
                lineHeight: 1.35,
                marginTop: 2,
              }}
            >
              {placeName}에서 {friendChild}와 놀고 있어요
            </div>
          </div>
          {isParent && (
            <button
              type="button"
              onClick={handleStop}
              disabled={busy}
              aria-label="친구 만남 종료"
              className="hyeni-tool-button hyeni-tool-button--accent-soft"
              style={{
                padding: "8px 14px",
                minHeight: 36,
                width: "auto",
                fontSize: 12,
                background: "var(--hyeni-emergency)",
                color: "#fff",
                border: 0,
                cursor: busy ? "wait" : "pointer",
              }}
            >
              <span className="hyeni-tool-button__label">정지</span>
            </button>
          )}
        </div>

        {isParent && phones.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {phones.map((p) => (
              <a
                key={p}
                href={formatPhoneTel(p)}
                className="hyeni-tool-tel"
                style={{ minHeight: 32, padding: "6px 12px", fontSize: 12 }}
              >
                📞 {p}
              </a>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}
