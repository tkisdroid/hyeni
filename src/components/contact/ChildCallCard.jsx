// src/components/contact/ChildCallCard.jsx
// 자녀 화면용 빠른 전화연결 카드 — 엄마/아빠 번호 tel: 링크.
// Extracted from App.jsx (Phase 5 #4 / B20).

import { FF } from "../../lib/styleHelpers.js";
import { ThreeDIcon } from "../icons/ThreeDIcon.jsx";

export function ChildCallCard({ phones = {} }) {
    const cleanNumber = (num) => (num || "").replace(/[^0-9+]/g, "");
    // gender 미상 부모(Kakao/OAuth 가입자, 공동 보호자)는 이름 라벨 + 중립 아이콘.
    const others = Array.isArray(phones.others) ? phones.others : [];
    const targets = [
        phones.mom && phones.mom.length >= 8 ? { key: "mom", label: "엄마", iconName: "parent-mom", number: cleanNumber(phones.mom), color: "var(--theme-accent-text)", bg: "var(--theme-accent-soft)" } : null,
        phones.dad && phones.dad.length >= 8 ? { key: "dad", label: "아빠", iconName: "parent-dad", number: cleanNumber(phones.dad), color: "var(--theme-accent-text)", bg: "var(--theme-accent-soft)" } : null,
        ...others
            .filter((o) => typeof o?.phone === "string" && o.phone.length >= 8)
            .map((o, i) => ({ key: `parent-${i}`, label: o.name || "부모님", iconName: "parent-guardian", number: cleanNumber(o.phone), color: "var(--theme-accent-text)", bg: "var(--theme-accent-soft)" })),
    ].filter(Boolean);
    const hasTargets = targets.length > 0;

    return (
        <div
            className="child-call-card"
            data-has-targets={hasTargets ? "true" : "false"}
            aria-label={hasTargets ? "부모님께 전화하기" : "등록된 전화번호 없음"}
            style={{
                fontFamily: FF,
            }}
        >
            <div className="child-call-card__header">
                <div className="child-call-card__intro">
                    <span className="child-call-card__icon">
                        <ThreeDIcon name="phone-lavender" size={28} aria-label="전화" />
                    </span>
                    <span className="child-call-card__copy">
                        <span className="child-call-card__title">부모님께 전화하기</span>
                        <span className="child-call-card__meta">
                            {hasTargets ? targets.map((t) => t.label).join(" · ") : "연락처 없음"}
                        </span>
                    </span>
                </div>
                {hasTargets && (
                    <span className="child-call-card__badge">
                        바로 연결
                    </span>
                )}
            </div>
            {hasTargets ? (
                <div className="child-call-card__targets" data-count={targets.length}>
                    {targets.map(target => (
                        <a
                            key={target.key}
                            href={`tel:${target.number}`}
                            aria-label={`${target.label}에게 전화`}
                            className="child-call-card__target"
                            style={{ background: target.bg, color: target.color }}
                        >
                            <ThreeDIcon name={target.iconName} size={32} aria-label="" />
                            <span>{target.label}</span>
                        </a>
                    ))}
                </div>
            ) : (
                <div className="child-call-card__empty">
                    연락처 없음
                </div>
            )}
        </div>
    );
}
