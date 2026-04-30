// src/components/multichild/PairingWizard/PairingWizard.jsx
import { useState } from "react";
import { setupFamily } from "../../../lib/auth.js";
import { supabase } from "../../../lib/supabase.js";
import { useBackHandler } from "../../../lib/backHandler.js";
import { autoAssignColor } from "../ChildPalette.js";
import { ChildCountStep } from "./ChildCountStep.jsx";
import { ChildDetailsStep } from "./ChildDetailsStep.jsx";

// Upload DataURL-staged photos to Storage now that the family row exists.
// Best-effort: a single upload failure must not roll back the family.
async function uploadPendingPhotos(familyId, children) {
  if (!familyId) return;
  const pending = children
    .map((c, i) => ({ child: c, order: i + 1 }))
    .filter(({ child }) => typeof child.photo_url === "string" && child.photo_url.startsWith("data:"));
  if (pending.length === 0) return;

  // Need each placeholder family_member's id to UPDATE photo_url. Match by
  // child_order (setupFamily writes child_order = i + 1 in the same loop).
  const { data: members } = await supabase
    .from("family_members")
    .select("id, child_order")
    .eq("family_id", familyId)
    .eq("role", "child");
  const memberByOrder = new Map((members || []).map((m) => [m.child_order, m]));

  for (const { child, order } of pending) {
    try {
      const member = memberByOrder.get(order);
      if (!member) continue;
      const blob = await (await fetch(child.photo_url)).blob();
      const ext = (blob.type.split("/")[1] || "jpg").split(";")[0] || "jpg";
      const path = `${familyId}/child-${order}-${Date.now()}.${ext}`;
      const bucket = supabase.storage.from("child-photos");
      const { error: upErr } = await bucket.upload(path, blob, {
        upsert: true,
        contentType: blob.type || "image/jpeg",
      });
      if (upErr) {
        console.error("[PairingWizard] photo upload failed:", upErr);
        continue;
      }
      const { data: { publicUrl } } = bucket.getPublicUrl(path);
      const { error: updErr } = await supabase.rpc("set_family_member_photo_url_by_id", {
        p_family_id: familyId,
        p_member_id: member.id,
        p_url: publicUrl,
      });
      if (updErr) console.error("[PairingWizard] photo url persist failed:", updErr);
    } catch (e) {
      console.error("[PairingWizard] photo persist error:", e);
    }
  }
}

export function PairingWizard({ userId, parentName, parentPhone = "", parentGender = "", onComplete, onCancel }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [familyName, setFamilyName] = useState("");
  const [childCount, setChildCount] = useState(null);
  const [children, setChildren] = useState([]);
  const [family, setFamily] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Hardware back: step back through the wizard. At step 0, fall out via onCancel.
  // After family is created (steps 3, 4), back finalises via onComplete instead of
  // re-opening the children form (data has already been committed to the server).
  useBackHandler(() => {
    if (busy) return true;
    if (stepIndex >= 3) {
      onComplete?.(family);
      return true;
    }
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
      return true;
    }
    if (onCancel) {
      onCancel();
      return true;
    }
    return false;
  });

  function startChildren() {
    if (children.length === 0) {
      // eslint-disable-next-line no-unused-vars
      const init = Array.from({ length: childCount }, (_, i) => {
        const used = [];
        return { name: "", birthdate: "", color_hex: autoAssignColor(used), photo_url: null };
      });
      // re-compute usedColors progressively
      const final = [];
      for (let i = 0; i < childCount; i++) {
        const used = final.map((c) => c.color_hex);
        final.push({ name: "", birthdate: "", color_hex: autoAssignColor(used), photo_url: null });
      }
      setChildren(final);
    }
  }

  async function submitChildren() {
    setBusy(true);
    setError(null);
    try {
      // Strip DataURL photos before insert — those are local previews captured
      // in the wizard before the family/storage folder existed. Real photo_urls
      // (from a re-edit flow) pass through unchanged.
      const childrenForInsert = children.map((c) => ({
        ...c,
        photo_url: typeof c.photo_url === "string" && c.photo_url.startsWith("data:")
          ? null
          : (c.photo_url || null),
      }));
      const created = await setupFamily(userId, parentName, {
        familyName, plannedChildCount: childCount, children: childrenForInsert, parentPhone, parentGender,
      });
      // Best-effort: upload pending photos now that the family folder exists.
      // Failures are logged but the wizard still advances — user can re-add
      // photos from a future settings UI if any single upload missed.
      await uploadPendingPhotos(created.id, children);
      setFamily(created);
      setStepIndex(3);
    } catch (err) {
      setError(err.message || "가족 생성 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
      <ProgressBar current={stepIndex} total={5} />

      {stepIndex === 0 && (
        <Step1FamilyName value={familyName} onChange={setFamilyName} onNext={() => setStepIndex(1)} />
      )}
      {stepIndex === 1 && (
        <ChildCountStep
          value={childCount} onChange={setChildCount}
          onNext={() => { startChildren(); setStepIndex(2); }}
        />
      )}
      {stepIndex === 2 && (
        <Step3Children
          children={children} onChange={setChildren}
          familyId={family?.id || "pending"}
          busy={busy} error={error}
          onSubmit={submitChildren}
        />
      )}
      {stepIndex === 3 && family && (
        <Step4PairCode family={family} onNext={() => setStepIndex(4)} />
      )}
      {stepIndex === 4 && (
        <Step5Complete onComplete={() => onComplete?.(family)} />
      )}
    </div>
  );
}

function ProgressBar({ current, total }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 32 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          flex: 1, height: 4, borderRadius: 2,
          background: i <= current ? "#F779A8" : "#E5E7EB",
        }} />
      ))}
    </div>
  );
}

function Step1FamilyName({ value, onChange, onNext }) {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: "#1F2937", marginBottom: 24 }}>
        가족 이름을 알려주세요
      </h2>
      <label style={{ display: "block" }}>
        가족 이름
        <input
          type="text" value={value} onChange={(e) => onChange(e.target.value)}
          placeholder="예) 혜니네" maxLength={20}
          style={{
            display: "block", width: "100%", padding: "12px 14px", marginTop: 6,
            borderRadius: 12, border: "1.5px solid #E5E7EB", fontSize: 16,
          }}
        />
      </label>
      <button
        type="button" onClick={onNext} disabled={!value.trim()}
        style={{
          marginTop: 32, width: "100%", padding: "14px 0", borderRadius: 14,
          background: value.trim() ? "#F779A8" : "#E5E7EB",
          color: value.trim() ? "white" : "#9CA3AF",
          fontSize: 16, fontWeight: 800, border: "none",
          cursor: value.trim() ? "pointer" : "not-allowed",
        }}
      >다음</button>
    </div>
  );
}

function Step3Children({ children, onChange, familyId, busy, error, onSubmit }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const usedColors = children.map((c) => c.color_hex).filter(Boolean);
  const allValid = children.every((c) => c.name.trim() && c.birthdate);

  return (
    <div>
      <ChildDetailsStep
        child={children[activeIndex]}
        index={activeIndex}
        onChange={(updated) => {
          const next = [...children];
          next[activeIndex] = updated;
          onChange(next);
        }}
        usedColors={usedColors}
        familyId={familyId}
      />

      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        {activeIndex > 0 && (
          <button type="button" onClick={() => setActiveIndex(activeIndex - 1)}
            style={{ flex: 1, padding: "14px 0", borderRadius: 14, background: "white", border: "1.5px solid #E5E7EB", fontWeight: 800 }}>
            이전 자녀
          </button>
        )}
        {activeIndex < children.length - 1 ? (
          <button
            type="button"
            onClick={() => setActiveIndex(activeIndex + 1)}
            disabled={!children[activeIndex].name.trim() || !children[activeIndex].birthdate}
            style={{ flex: 1, padding: "14px 0", borderRadius: 14, background: "#F779A8", color: "white", fontWeight: 800, border: "none" }}
          >다음 자녀</button>
        ) : (
          <button
            type="button" onClick={onSubmit} disabled={!allValid || busy}
            style={{ flex: 1, padding: "14px 0", borderRadius: 14,
              background: allValid && !busy ? "#F779A8" : "#E5E7EB",
              color: allValid && !busy ? "white" : "#9CA3AF",
              fontWeight: 800, border: "none" }}
          >{busy ? "저장 중..." : "다음"}</button>
        )}
      </div>
      {error && <div style={{ color: "#EF4444", marginTop: 12, fontSize: 14 }}>{error}</div>}
    </div>
  );
}

function Step4PairCode({ family, onNext }) {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: "#1F2937", marginBottom: 12 }}>
        페어링 코드
      </h2>
      <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 20 }}>
        자녀 단말 앱에 이 코드를 입력하면 가족이 연결돼요.
      </p>
      <div style={{
        background: "#FFF1F7", border: "2px solid #F779A8", borderRadius: 14,
        padding: 24, textAlign: "center",
        fontSize: 22, fontWeight: 900, letterSpacing: 2, color: "#BE185D",
      }}>
        {family.pair_code}
      </div>
      <button
        type="button" onClick={onNext}
        style={{
          marginTop: 32, width: "100%", padding: "14px 0", borderRadius: 14,
          background: "#F779A8", color: "white", fontSize: 16, fontWeight: 800, border: "none",
        }}
      >모든 자녀 페어링 완료</button>
    </div>
  );
}

function Step5Complete({ onComplete }) {
  return (
    <div style={{ textAlign: "center", paddingTop: 60 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
      <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 12 }}>설정 완료!</h2>
      <button
        type="button" onClick={onComplete}
        style={{
          marginTop: 32, padding: "14px 32px", borderRadius: 14,
          background: "#F779A8", color: "white", fontSize: 16, fontWeight: 800, border: "none",
        }}
      >시작하기</button>
    </div>
  );
}
