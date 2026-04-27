import React, { useEffect, useState, useCallback } from 'react';
import { ForceRingTriggerButton } from './ForceRingTriggerButton.jsx';
import { ForceRingConfirmModal } from './ForceRingConfirmModal.jsx';
import { ForceRingActiveStatus } from './ForceRingActiveStatus.jsx';
import { ForceRingHistory } from './ForceRingHistory.jsx';
import { triggerForceRing, fetchActiveForceRing } from '../../lib/forceRing.js';
import { supabase } from '../../lib/supabase.js';

export function ForceRingPanel({ familyId, hasChild = true }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState(null);
  const [quotaInfo, setQuotaInfo] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    if (!familyId) return;
    const [active, quotaResult] = await Promise.all([
      fetchActiveForceRing(familyId),
      supabase.rpc('force_ring_check_quota', { p_family_id: familyId }),
    ]);
    setActiveEvent(active);
    setQuotaInfo(quotaResult.data);
  }, [familyId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleConfirm = async (message) => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await triggerForceRing({ familyId, message });
      if (result.error === 'force_ring_quota_exceeded') {
        setError('quota_exceeded');
      } else if (result.error === 'force_ring_already_active') {
        setError('already_active');
        await refresh();
      } else if (result.event_id) {
        setActiveEvent({
          id: result.event_id,
          delivered_at: result.delivered ? new Date().toISOString() : null,
          stopped_at: result.delivered ? null : new Date().toISOString(),
          stop_reason: result.delivered ? null : 'delivery_failed',
        });
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message || 'unknown');
    } finally {
      setSubmitting(false);
      setModalOpen(false);
    }
  };

  if (!hasChild) {
    return (
      <section style={panelStyle}>
        <h2>⚠️ 응급 강제 알람</h2>
        <p style={{ color: '#6B7280' }}>아이 페어링 후 사용 가능합니다.</p>
      </section>
    );
  }

  const quotaRemaining = quotaInfo ? quotaInfo.quota - quotaInfo.used : null;
  const isDisabled =
    submitting ||
    !!activeEvent ||
    (quotaRemaining !== null && quotaRemaining <= 0);

  return (
    <section style={panelStyle}>
      <h2>⚠️ 응급 강제 알람</h2>
      <p>아이 폰이 무음·방해금지여도 풀볼륨 알람을 15초간 강제로 울립니다.</p>
      <p style={{ color: '#DC2626', fontSize: 14 }}>
        ⚠ 진짜 응급 시에만 사용하세요. 평상시 연락은 일반 알림으로.
      </p>

      {quotaInfo && (
        <p>
          오늘 남은 횟수: {quotaInfo.quota - quotaInfo.used} / {quotaInfo.quota}
        </p>
      )}

      {activeEvent ? (
        <ForceRingActiveStatus
          event={activeEvent}
          onCleared={() => {
            setActiveEvent(null);
            refresh();
          }}
        />
      ) : error === 'quota_exceeded' ? (
        <div style={{ background: '#FEF3C7', padding: 16, borderRadius: 8 }}>
          <p>
            ⚠ 오늘 사용 한도 초과 ({quotaInfo?.used}/{quotaInfo?.quota})
          </p>
          {quotaInfo?.tier === 'free' && (
            <p>프리미엄으로 업그레이드 시 일 10회까지 사용 가능</p>
          )}
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <a href="tel:" style={fallbackBtn}>📞 직접 통화하기</a>
            <a href="tel:119" style={emergencyBtn}>🚨 119</a>
          </div>
        </div>
      ) : (
        <ForceRingTriggerButton
          disabled={isDisabled}
          onConfirm={() => setModalOpen(true)}
        />
      )}

      <ForceRingConfirmModal
        isOpen={modalOpen}
        quotaInfo={quotaInfo}
        onCancel={() => setModalOpen(false)}
        onConfirm={handleConfirm}
      />

      <ForceRingHistory familyId={familyId} />
    </section>
  );
}

const panelStyle = {
  border: '1px solid #E5E7EB',
  borderRadius: 12,
  padding: 16,
  marginTop: 16,
};
const fallbackBtn = {
  flex: 1,
  padding: 8,
  background: '#1F2937',
  color: 'white',
  textAlign: 'center',
  borderRadius: 8,
  textDecoration: 'none',
};
const emergencyBtn = {
  flex: 1,
  padding: 8,
  background: '#DC2626',
  color: 'white',
  textAlign: 'center',
  borderRadius: 8,
  textDecoration: 'none',
};
