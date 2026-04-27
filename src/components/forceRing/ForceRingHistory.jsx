import React, { useEffect, useState } from 'react';
import { fetchForceRingHistory } from '../../lib/forceRing.js';

const STOP_LABELS = {
  child_ack: '확인됨',
  parent_stop: '부모 정지',
  auto_timeout: '자동 종료',
  delivery_failed: '전달 실패',
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

  if (items === null) return <div>불러오는 중...</div>;
  if (!items.length) return <div style={{ color: '#6B7280' }}>사용 내역 없음</div>;

  return (
    <details style={{ marginTop: 16 }}>
      <summary>최근 사용 내역 ({items.length}건)</summary>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {items.map((item) => {
          const responseSec =
            item.acknowledged_at && item.delivered_at
              ? Math.round(
                  (new Date(item.acknowledged_at) - new Date(item.delivered_at)) / 1000
                )
              : null;
          return (
            <li key={item.id} style={{ padding: 8, borderBottom: '1px solid #E5E7EB' }}>
              <span>{fmtDate(item.triggered_at)}</span>
              {' · '}
              <span>{STOP_LABELS[item.stop_reason] || '진행 중'}</span>
              {responseSec !== null && (
                <span style={{ color: '#6B7280', fontSize: 12 }}>
                  {' '}
                  ({responseSec}s 응답)
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
