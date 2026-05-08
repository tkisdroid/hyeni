// src/components/multichild/PairingWizard/ChildDetailsStep.jsx
// 헤더(h2/p)는 PairingWizard의 WizardMascotIntro가 담당.
import { BirthdatePicker } from "../../birthdate/BirthdatePicker.jsx";
import { ColorPicker } from "./ColorPicker.jsx";
import { PhotoUpload } from "./PhotoUpload.jsx";

export function ChildDetailsStep({ child, index, onChange, usedColors, familyId }) {
  const update = (patch) => onChange({ ...child, ...patch });
  const order = index + 1;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <PhotoUpload
          value={child.photo_url}
          onChange={(url) => update({ photo_url: url })}
          familyId={familyId} childOrder={order}
        />
      </div>

      <label style={{ display: "block", fontSize: 14, fontWeight: 700, marginBottom: 6, color: "var(--fg-primary)" }}>
        이름
        <input
          type="text" value={child.name} maxLength={20} placeholder="자녀 이름"
          onChange={(e) => update({ name: e.target.value })}
          className="input"
          style={{ marginTop: 6 }}
        />
      </label>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, color: "var(--fg-primary)" }}>생년월일</div>
        <BirthdatePicker
          value={child.birthdate}
          onChange={(yyyymmdd) => update({ birthdate: yyyymmdd })}
          max={`${new Date().getFullYear()}-12-31`}
          min="2005-01-01"
          placeholder="생년월일 선택"
          defaultYearOffset={8}
        />
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, color: "var(--fg-primary)" }}>앱 테마 색상</div>
        <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: "var(--fg-tertiary)", lineHeight: 1.45 }}>
          선택한 색은 자녀 표시와 앱 전체에 반영돼요.
        </p>
        <ColorPicker
          selected={child.color_hex}
          usedColors={usedColors.filter((c) => c !== child.color_hex)}
          onChange={(c) => update({ color_hex: c })}
        />
      </div>
    </div>
  );
}
