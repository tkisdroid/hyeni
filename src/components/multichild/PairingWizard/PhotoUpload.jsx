// src/components/multichild/PairingWizard/PhotoUpload.jsx
import { useState } from "react";
import { supabase } from "../../../lib/supabase.js";

export function PhotoUpload({ value, onChange, familyId, childOrder }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const ext = file.name.split(".").pop();
      const path = `${familyId}/child-${childOrder}-${Date.now()}.${ext}`;
      const bucket = supabase.storage.from("child-photos");
      const { error: upErr } = await bucket.upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = bucket.getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (err) {
      setError(err.message || "업로드 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label
        htmlFor={`photo-${childOrder}`}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 96, height: 96, borderRadius: "50%",
          background: value ? `url(${value}) center/cover` : "#F3F4F6",
          border: "2px dashed #D1D5DB", cursor: busy ? "wait" : "pointer",
          color: "#6B7280", fontSize: 12,
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
      {error && <div style={{ color: "#EF4444", fontSize: 12, marginTop: 4 }}>{error}</div>}
      {value && <img src={value} alt="자녀 사진" style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }} />}
    </div>
  );
}
