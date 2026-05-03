// Wheel-style birthdate picker for signup flows. Native <input type="date">
// is awkward on Android for years that are far in the past; this opens a
// bottom-sheet 3-column wheel (year / month / day) instead.
//
// Used only for the parent signup form and the child setup wizard. Event /
// schedule date inputs intentionally keep the native picker.

import { useEffect, useMemo, useState } from "react";
import Picker from "react-mobile-picker";
import { useBackHandler } from "../../lib/backHandler.js";

const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1));

function daysInMonth(year, month) {
  return new Date(Number(year), Number(month), 0).getDate();
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function parseValue(str) {
  if (!str) return null;
  const m = String(str).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { year: m[1], month: String(Number(m[2])), day: String(Number(m[3])) };
}

function formatValue({ year, month, day }) {
  return `${year}-${pad2(Number(month))}-${pad2(Number(day))}`;
}

export function BirthdatePicker({
  value,
  onChange,
  min = "1900-01-01",
  max,
  disabled = false,
  placeholder = "생년월일 선택",
  defaultYearOffset = 30,
  style,
}) {
  const today = new Date();
  const minYear = Number(min.slice(0, 4)) || 1900;
  const maxYear = Number((max || `${today.getFullYear()}-12-31`).slice(0, 4));

  const years = useMemo(() => {
    const arr = [];
    for (let y = maxYear; y >= minYear; y--) arr.push(String(y));
    return arr;
  }, [minYear, maxYear]);

  const fallback = useMemo(() => ({
    year: String(today.getFullYear() - defaultYearOffset),
    month: "1",
    day: "1",
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [defaultYearOffset]);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(parseValue(value) || fallback);

  // Reset draft to current value every time the sheet opens — so the wheel
  // shows what the user has, not the previous draft they may have abandoned.
  useEffect(() => {
    if (open) setDraft(parseValue(value) || fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const days = useMemo(() => {
    const max = daysInMonth(draft.year, draft.month);
    return Array.from({ length: max }, (_, i) => String(i + 1));
  }, [draft.year, draft.month]);

  // If the user picks Feb 30 then switches to Feb, clamp to last valid day.
  useEffect(() => {
    const max = daysInMonth(draft.year, draft.month);
    if (Number(draft.day) > max) {
      setDraft((prev) => ({ ...prev, day: String(max) }));
    }
  }, [draft.year, draft.month, draft.day]);

  // Hardware back closes the sheet (without confirming).
  useBackHandler(() => {
    if (open) { setOpen(false); return true; }
    return false;
  });

  const handleConfirm = () => {
    onChange?.(formatValue(draft));
    setOpen(false);
  };

  const display = parseValue(value);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(true)}
        style={{
          width: "100%",
          minHeight: 48,
          padding: "12px 14px",
          border: "1.5px solid #E5E7EB",
          borderRadius: 14,
          fontSize: 15,
          fontWeight: 700,
          background: "white",
          color: display ? "#111827" : "#9CA3AF",
          textAlign: "left",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          boxSizing: "border-box",
          ...style,
        }}
      >
        {display
          ? `${display.year}년 ${Number(display.month)}월 ${Number(display.day)}일`
          : placeholder}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="생년월일 선택"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(15,23,42,0.45)",
            display: "flex", flexDirection: "column", justifyContent: "flex-end",
          }}
        >
          <div className="card-elevated" style={{
            borderRadius: "16px 16px 0 0",
            padding: "14px 18px 22px",
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 6,
            }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", color: "#6B7280", fontSize: 15, fontWeight: 700, padding: "8px 4px", cursor: "pointer" }}
              >취소</button>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>생년월일 선택</div>
              <button
                type="button"
                onClick={handleConfirm}
                style={{ background: "none", border: "none", color: "#BE185D", fontSize: 15, fontWeight: 900, padding: "8px 4px", cursor: "pointer" }}
              >확인</button>
            </div>
            <Picker value={draft} onChange={setDraft} height={216} itemHeight={36}>
              <Picker.Column name="year">
                {years.map((y) => (
                  <Picker.Item key={y} value={y}>{y}년</Picker.Item>
                ))}
              </Picker.Column>
              <Picker.Column name="month">
                {MONTHS.map((m) => (
                  <Picker.Item key={m} value={m}>{m}월</Picker.Item>
                ))}
              </Picker.Column>
              <Picker.Column name="day">
                {days.map((d) => (
                  <Picker.Item key={d} value={d}>{d}일</Picker.Item>
                ))}
              </Picker.Column>
            </Picker>
          </div>
        </div>
      )}
    </>
  );
}
