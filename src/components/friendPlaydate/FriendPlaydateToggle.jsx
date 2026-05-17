// src/components/friendPlaydate/FriendPlaydateToggle.jsx
import { useState } from 'react';
import { setFamilyPlaydateEnabled } from '../../lib/friendPlaydate.js';
import { appToast } from '../../lib/appToast.js';

export default function FriendPlaydateToggle({ familyId, enabled, onChange, compact = false }) {
  const [busy, setBusy] = useState(false);
  const legacyHeadingStyle = {
    position: "absolute",
    width: 1,
    height: 1,
    margin: -1,
    padding: 0,
    border: 0,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
  };

  const handleToggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next = !enabled;
      await setFamilyPlaydateEnabled(familyId, next);
      onChange?.(next);
    } catch (e) {
      console.error('[FriendPlaydateToggle]', e);
      appToast('변경에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  if (compact) {
    return (
      <div className="hyeni-tool-toggle">
        <span className="hyeni-tool-toggle__label" data-state={enabled ? 'on' : 'off'}>
          {busy ? '저장 중' : enabled ? '허용' : '꺼짐'}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="친구놀이 기능 켜기 / 친구 만남 기능 켜기"
          disabled={busy}
          onClick={handleToggle}
          className="hyeni-tool-toggle__switch"
        />
      </div>
    );
  }

  return (
    <article className="hyeni-tool-card hyeni-tool-card--accent">
      <span className="hyeni-tool-card__rule" aria-hidden="true" />
      <div className="hyeni-tool-card__head">
        <div>
          <span className="hyeni-tool-card__kicker">매칭 권한</span>
          <h2 className="hyeni-tool-card__title">친구놀이</h2>
          <h2 style={legacyHeadingStyle}>친구 만남</h2>
          <p className="hyeni-tool-card__sub">
            양쪽 부모가 모두 켜야 작동해요. 같은 안전장소에 있는 다른 혜니 가족의 자녀와 매칭됩니다.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="친구놀이 기능 토글 / 친구 만남 기능 토글"
          disabled={busy}
          onClick={handleToggle}
          className="hyeni-tool-toggle__switch"
        />
      </div>
    </article>
  );
}
