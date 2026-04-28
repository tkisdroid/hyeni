// src/components/multichild/PairingWizard/ChildDetailsStep.jsx
import { ColorPicker } from "./ColorPicker.jsx";
import { PhotoUpload } from "./PhotoUpload.jsx";

export function ChildDetailsStep({ child, index, onChange, usedColors, familyId }) {
  const update = (patch) => onChange({ ...child, ...patch });
  const order = index + 1;

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 900, color: "#1F2937", marginBottom: 4 }}>
        {order}번째 자녀
      </h2>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>
        이름과 생년월일을 입력해 주세요. 생년월일은 자녀별 구독 식별에 사용돼요.
      </p>

      <div style={{ marginBottom: 20 }}>
        <PhotoUpload
          value={child.photo_url}
          onChange={(url) => update({ photo_url: url })}
          familyId={familyId} childOrder={order}
        />
      </div>

      <label style={{ display: "block", fontSize: 14, fontWeight: 700, marginBottom: 6, color: "#1F2937" }}>
        이름
        <input
          type="text" value={child.name} maxLength={20} placeholder="자녀 이름"
          onChange={(e) => update({ name: e.target.value })}
          style={{
            display: "block", width: "100%", padding: "12px 14px", marginTop: 6,
            borderRadius: 12, border: "1.5px solid #E5E7EB", fontSize: 16,
          }}
        />
      </label>

      <label style={{ display: "block", fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 6, color: "#1F2937" }}>
        생년월일
        <input
          type="date" value={child.birthdate}
          onChange={(e) => update({ birthdate: e.target.value })}
          style={{
            display: "block", width: "100%", padding: "12px 14px", marginTop: 6,
            borderRadius: 12, border: "1.5px solid #E5E7EB", fontSize: 16,
          }}
        />
      </label>

      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: "#1F2937" }}>색</div>
        <ColorPicker
          selected={child.color_hex}
          usedColors={usedColors.filter((c) => c !== child.color_hex)}
          onChange={(c) => update({ color_hex: c })}
        />
      </div>
    </div>
  );
}
