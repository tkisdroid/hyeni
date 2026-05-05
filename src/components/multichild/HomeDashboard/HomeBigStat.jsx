// src/components/multichild/HomeDashboard/HomeBigStat.jsx
// Phase 2 spec section 3.1 — 부모 홈 진입 1초 답: "지금 시각 + 다음 일정".
// Pattern: Cron 시계 hero · Sunsama "오늘 무엇" · 부모 mental model "지금 뭐 해야 돼?"

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

function pickNextEvent(events, now = new Date()) {
    if (!Array.isArray(events) || events.length === 0) return null;

    // events는 { time: "HH:MM", endTime?: "HH:MM", title, ... } 모양 가정
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const future = events
        .filter((e) => typeof e?.time === "string" && /^\d{1,2}:\d{2}$/.test(e.time))
        .map((e) => {
            const [h, m] = e.time.split(":").map(Number);
            return { event: e, minutes: h * 60 + m };
        })
        .filter((x) => x.minutes >= nowMinutes)
        .sort((a, b) => a.minutes - b.minutes);

    return future[0]?.event ?? null;
}

function formatTimeLabel(time) {
    const [h, m] = time.split(":").map(Number);
    const period = h < 12 ? "오전" : "오후";
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
    if (m === 0) return `${period} ${display}시`;
    return `${period} ${display}시 ${String(m).padStart(2, "0")}분`;
}

export function HomeBigStat({ events, now = new Date() }) {
    const dayLabel = `${DAYS_KO[now.getDay()]}요일`;
    const dateLabel = `${now.getMonth() + 1}월 ${now.getDate()}일`;
    const next = pickNextEvent(events, now);

    return (
        <header
            style={{
                paddingBottom: "var(--space-6)",
                borderBottom: "1px solid var(--line-soft)",
                marginBottom: "var(--space-screen-gap)",
            }}
        >
            <p className="t-bigstat-eyebrow">{dayLabel}</p>
            <h1 className="t-bigstat-date">{dateLabel}</h1>
            {next ? (
                <p className="t-bigstat-next">
                    다음 일정 ·{" "}
                    <span className="t-bigstat-next-time">
                        {formatTimeLabel(next.time)} {next.title}
                    </span>
                </p>
            ) : (
                <p className="t-bigstat-next">오늘 일정 마무리됐어요</p>
            )}
        </header>
    );
}

export { pickNextEvent, formatTimeLabel };
