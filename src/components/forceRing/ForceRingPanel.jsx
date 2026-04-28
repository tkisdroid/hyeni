import React, { useEffect, useState, useCallback } from 'react';
import { ForceRingTriggerButton } from './ForceRingTriggerButton.jsx';
import { ForceRingConfirmModal } from './ForceRingConfirmModal.jsx';
import { ForceRingActiveStatus } from './ForceRingActiveStatus.jsx';
import { ForceRingHistory } from './ForceRingHistory.jsx';
import { triggerForceRing, fetchActiveForceRing } from '../../lib/forceRing.js';
import { supabase } from '../../lib/supabase.js';

export function ForceRingPanel({ familyId, hasChild = true, compact = false }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState(null);
  const [quotaInfo, setQuotaInfo] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

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
      <section style={compact ? compactPanelStyle : panelStyle}>
        <h2 style={compact ? compactTitleStyle : undefined}>⚠️ 응급 강제 알람</h2>
        <p style={{ color: '#6B7280', margin: compact ? 0 : undefined }}>아이 페어링 후 사용 가능합니다.</p>
      </section>
    );
  }

  const quotaRemaining = quotaInfo ? quotaInfo.quota - quotaInfo.used : null;
  const isDisabled =
    submitting ||
    !!activeEvent ||
    (quotaRemaining !== null && quotaRemaining <= 0);

  if (compact) {
    return (
      <section style={compactPanelStyle} aria-label="응급 강제 알람">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={compactIconStyle}>!</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={compactTitleStyle}>응급 강제 알람</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#991B1B', marginTop: 2 }}>
              아이 폰을 15초간 풀볼륨으로 울림
            </div>
            {quotaInfo && (
              <div style={{ fontSize: 10, fontWeight: 800, color: '#B45309', marginTop: 4 }}>
                오늘 남은 횟수 {quotaRemaining} / {quotaInfo.quota}
              </div>
            )}
          </div>
          {!activeEvent && error !== 'quota_exceeded' && (
            <ForceRingTriggerButton
              compact
              disabled={isDisabled}
              onConfirm={() => setModalOpen(true)}
            />
          )}
        </div>

        {activeEvent ? (
          <div style={{ marginTop: 10 }}>
            <ForceRingActiveStatus
              event={activeEvent}
              onCleared={() => {
                setActiveEvent(null);
                refresh();
              }}
            />
          </div>
        ) : error === 'quota_exceeded' ? (
          <div style={{ background: '#FEF3C7', padding: 12, borderRadius: 14, marginTop: 10, color: '#92400E', fontSize: 12, fontWeight: 800 }}>
            오늘 사용 한도 초과 ({quotaInfo?.used}/{quotaInfo?.quota})
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setShowHistory((open) => !open)}
          style={{
            marginTop: 8,
            border: 'none',
            background: 'transparent',
            color: '#991B1B',
            fontSize: 11,
            fontWeight: 900,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {showHistory ? '이력 접기' : '이력 보기'}
        </button>

        {showHistory && (
          <div style={{ marginTop: 8 }}>
            <ForceRingHistory familyId={familyId} limit={5} />
          </div>
        )}

        <ForceRingConfirmModal
          isOpen={modalOpen}
          quotaInfo={quotaInfo}
          onCancel={() => setModalOpen(false)}
          onConfirm={handleConfirm}
        />
      </section>
    );
  }

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
const compactPanelStyle = {
  border: '1.5px solid #FECACA',
  borderRadius: 18,
  padding: '12px 14px',
  margin: '12px 0',
  background: 'linear-gradient(135deg,#FFF7F7,#FEF2F2)',
  boxShadow: '0 8px 20px rgba(220,38,38,0.08)',
};
const compactIconStyle = {
  width: 34,
  height: 34,
  borderRadius: 12,
  background: '#DC2626',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 20,
  fontWeight: 900,
  flexShrink: 0,
};
const compactTitleStyle = {
  margin: 0,
  color: '#7F1D1D',
  fontSize: 15,
  fontWeight: 950,
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
