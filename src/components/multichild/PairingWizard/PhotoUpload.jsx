// src/components/multichild/PairingWizard/PhotoUpload.jsx
import { useState } from "react";
import { supabase } from "../../../lib/supabase.js";

export function PhotoUpload({ value, onChange, familyId, childOrder }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // During the pairing wizard, the family row does not exist yet, so we
  // cannot upload to Supabase Storage — the bucket policy requires the
  // first folder segment to match an existing family_id where the caller
  // is parent. Instead, we capture the file as a DataURL preview and let
  // PairingWizard.submitChildren upload it to Storage right after the
  // family + members are created. Post-family edits (familyId is a real
  // uuid) keep the original direct-upload behavior.
  const isPendingFamily = !familyId || familyId === "pending";

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      if (isPendingFamily) {
        const reader = new FileReader();
        reader.onload = () => {
          onChange(reader.result);
          setBusy(false);
        };
        reader.onerror = () => {
          setError("사진 읽기 실패");
          setBusy(false);
        };
        reader.readAsDataURL(file);
        return;
      }

      const dotIdx = file.name.lastIndexOf(".");
      const ext = dotIdx > 0 && dotIdx < file.name.length - 1
        ? file.name.slice(dotIdx + 1).toLowerCase()
        : "jpg";
      const path = `${familyId}/child-${childOrder}-${Date.now()}.${ext}`;
      const bucket = supabase.storage.from("child-photos");
      const { error: upErr } = await bucket.upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = bucket.getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (err) {
      setError(err.message || "업로드 실패");
    } finally {
      if (!isPendingFamily) setBusy(false);
    }
  }

  return (
    <div>
      <label
        htmlFor={`photo-${childOrder}`}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 96, height: 96, borderRadius: "50%",
          background: value ? `url(${value}) center/cover` : "var(--bg-subtle)",
          border: "2px dashed #D1D5DB", cursor: busy ? "wait" : "pointer",
          color: "var(--fg-secondary)", fontSize: 12,
        }}
      >
        {!value && (busy ? "업로드 중..." : "사진 추가")}
      </label>
      <input
        id={`photo-${childOrder}`}
        type="file" accept="image/*"
        onChange={handleFile} disabled={busy}
        style={{ display: "none" }}
      />
      {error && <div style={{ color: "var(--status-negative)", fontSize: 12, marginTop: 4 }}>{error}</div>}
      {value && <img src={value} alt="자녀 사진" style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }} />}
    </div>
  );
}
