import { useState, useEffect, useCallback, useRef } from "react";
import { FF } from "../../lib/utils.js";

const CATEGORY_LABELS = {
  attendance: { emoji: "✅", label: "출석 체크" },
  arrival: { emoji: "📍", label: "정시 도착" },
  arrival_early: { emoji: "🏃", label: "여유 도착" },
  arrival_streak: { emoji: "🔥", label: "연속 보너스" },
  event_create: { emoji: "📅", label: "일정 등록" },
  gguk: { emoji: "💕", label: "꾹!" },
  memo: { emoji: "✏️", label: "메모 작성" },
  academy_register: { emoji: "🏫", label: "학원 등록" },
  referral_invite: { emoji: "🎁", label: "추천 보상" },
  referral_welcome: { emoji: "🎉", label: "가입 환영" },
  referral_milestone: { emoji: "🏆", label: "추천 달성" },
};

export { CATEGORY_LABELS };

let globalShowToast = null;

export function showHyeniToast(amount, category) {
  if (globalShowToast) globalShowToast(amount, category);
}

export default function HyeniToast() {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const addToast = useCallback((amount, category) => {
    const id = ++idRef.current;
    const info = CATEGORY_LABELS[category] || { emoji: "💰", label: "" };
    setToasts(prev => [...prev, { id, amount, emoji: info.emoji, label: info.label }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 2500);
  }, []);

  useEffect(() => {
    globalShowToast = addToast;
    return () => { globalShowToast = null; };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div style={{ position: "fixed", top: 12, left: 0, right: 0, zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, pointerEvents: "none" }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: "#FFF0F7",
          border: "1.5px solid #E879A0",
          borderRadius: 16,
          padding: "10px 20px",
          fontFamily: FF,
          display: "flex",
          alignItems: "center",
          gap: 8,
          boxShadow: "0 4px 16px rgba(232,121,160,0.2)",
          animation: "hyeniToastIn 0.3s ease-out",
        }}>
          <span style={{ fontSize: 20 }}>{t.emoji}</span>
          <span style={{ fontSize: 14, fontWeight: 900, color: "#E879A0" }}>+{t.amount}혜니</span>
          {t.label && <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>{t.label}</span>}
        </div>
      ))}
      <style>{`
        @keyframes hyeniToastIn {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
