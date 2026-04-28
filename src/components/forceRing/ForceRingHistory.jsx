import React, { useEffect, useState } from 'react';
import { fetchForceRingHistory } from '../../lib/forceRing.js';

const STOP_LABELS = {
  child_ack: '확인됨',
  parent_stop: '부모 정지',
  auto_timeout: '자동 종료',
  delivery_failed: '전달 실패',
};

const STOP_TONE = {
  child_ack: 'success',
  parent_stop: 'neutral',
  auto_timeout: 'neutral',
  delivery_failed: 'error',
};

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function ForceRingHistory({ familyId, limit = 10 }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    if (!familyId) return;
    fetchForceRingHistory(familyId, limit).then(setItems);
  }, [familyId, limit]);

  if (items === null) {
    return <div className="hyeni-tool-empty">불러오는 중…</div>;
  }
  if (!items.length) {
    return <div className="hyeni-tool-empty">사용 내역 없음</div>;
  }

  return (
    <details className="hyeni-tool-history">
      <summary
        style={{
          listStyle: 'none',
          cursor: 'pointer',
          padding: '6px 0',
          color: 'var(--tool-accent-ink, var(--hyeni-ink-500))',
          fontSize: 11,
          fontWeight: 900,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span aria-hidden="true" style={{ display: 'inline-block', fontSize: 10 }}>›</span>
        최근 사용 내역 ({items.length}건)
      </summary>
      <ul className="hyeni-tool-list" aria-label="응급 강제 알람 사용 내역" style={{ marginTop: 8 }}>
        {items.map((item) => {
          const responseSec =
            item.acknowledged_at && item.delivered_at
              ? Math.round(
                  (new Date(item.acknowledged_at) - new Date(item.delivered_at)) / 1000
                )
              : null;
          const tone = STOP_TONE[item.stop_reason] ?? 'neutral';
          const badgeStyle =
            tone === 'success'
              ? { '--badge-bg': 'var(--hyeni-success-tint)', '--badge-ink': 'var(--hyeni-success-ink)' }
              : tone === 'error'
              ? { '--badge-bg': 'var(--hyeni-emergency-tint)', '--badge-ink': 'var(--hyeni-emergency-ink)' }
              : { '--badge-bg': 'var(--hyeni-ink-100)', '--badge-ink': 'var(--hyeni-ink-700)' };
          return (
            <li key={item.id} className="hyeni-tool-list__row">
              <div>
                <div className="hyeni-tool-list__primary">{fmtDate(item.triggered_at)}</div>
                {responseSec !== null && (
                  <div className="hyeni-tool-list__secondary">{responseSec}초 만에 응답</div>
                )}
              </div>
              <span className="hyeni-tool-list__badge" style={badgeStyle}>
                {STOP_LABELS[item.stop_reason] || '진행 중'}
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
