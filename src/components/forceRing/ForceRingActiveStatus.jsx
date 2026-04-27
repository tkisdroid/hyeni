import React, { useEffect, useState } from 'react';
import { subscribeForceRingStatus, stopForceRing } from '../../lib/forceRing.js';

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('ko-KR', { hour12: false });
}

export function ForceRingActiveStatus({ event: initialEvent, onCleared }) {
  const [event, setEvent] = useState(initialEvent);

  useEffect(() => {
    if (!initialEvent?.id) return;
    const ch = subscribeForceRingStatus(initialEvent.id, (updated) => {
      setEvent((prev) => ({ ...prev, ...updated }));
    });
    return () => ch?.unsubscribe?.();
  }, [initialEvent?.id]);

  if (!event) return null;

  if (event.stop_reason === 'delivery_failed') {
    return (
      <div style={errorBox}>
        <h3>✗ 전달 실패</h3>
        <p>아이 폰이 오프라인이거나 배터리가 꺼졌을 수 있습니다.</p>
        <p style={{ fontSize: 12, color: '#6B7280' }}>(오늘 사용 횟수 차감되지 않음)</p>
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <a href="tel:" style={btnFallback}>📞 직접 통화하기</a>
          <a href="tel:119" style={btnEmergency}>🚨 119</a>
        </div>
      </div>
    );
  }

  if (event.acknowledged_at) {
    const responseSec = event.delivered_at
      ? Math.round((new Date(event.acknowledged_at) - new Date(event.delivered_at)) / 1000)
      : null;
    return (
      <div style={successBox}>
        <h3>✓ 아이가 확인했어요</h3>
        <p>
          {fmtTime(event.acknowledged_at)}
          {responseSec !== null && ` (${responseSec}초 응답)`}
        </p>
      </div>
    );
  }

  if (event.stopped_at && event.stop_reason !== 'delivery_failed') {
    const reasonText = {
      parent_stop: '부모 정지',
      auto_timeout: '15초 자동 종료',
      child_ack: '확인됨',
    }[event.stop_reason] || '종료됨';
    return (
      <div style={successBox}>
        <h3>✓ 알람 정지됨</h3>
        <p>{fmtTime(event.stopped_at)} — {reasonText}</p>
      </div>
    );
  }

  if (event.delivered_at) {
    return (
      <div style={infoBox}>
        <h3>✓ 전달됨 {fmtTime(event.delivered_at)}</h3>
        <p>아이 응답 대기 중...</p>
        <button
          type="button"
          onClick={() => {
            stopForceRing(event.id);
            onCleared?.();
          }}
          aria-label="그만 울릴께요"
          style={btnStop}
        >
          🛑 그만 울릴께요
        </button>
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <a href="tel:" style={btnFallbackSmall}>📞 직접 통화하기</a>
          <a href="tel:119" style={btnEmergencySmall}>🚨 119</a>
        </div>
      </div>
    );
  }

  return (
    <div style={infoBox}>
      <h3>전달 시도 중...</h3>
      <p style={{ fontSize: 12 }}>10분 후 자동 취소</p>
    </div>
  );
}

const errorBox = { background: '#FEE2E2', border: '2px solid #DC2626', padding: 16, borderRadius: 8 };
const successBox = { background: '#D1FAE5', border: '2px solid #059669', padding: 16, borderRadius: 8 };
const infoBox = { background: '#DBEAFE', border: '2px solid #2563EB', padding: 16, borderRadius: 8 };
const btnFallback = { flex: 1, padding: 12, background: '#1F2937', color: 'white', borderRadius: 8, textAlign: 'center', textDecoration: 'none' };
const btnEmergency = { flex: 1, padding: 12, background: '#DC2626', color: 'white', borderRadius: 8, textAlign: 'center', textDecoration: 'none' };
const btnFallbackSmall = { ...btnFallback, padding: 8, fontSize: 14 };
const btnEmergencySmall = { ...btnEmergency, padding: 8, fontSize: 14 };
const btnStop = { width: '100%', padding: 12, background: '#DC2626', color: 'white', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 'bold', cursor: 'pointer', marginTop: 12 };
