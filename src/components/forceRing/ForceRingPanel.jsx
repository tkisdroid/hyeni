import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ForceRingTriggerButton } from './ForceRingTriggerButton.jsx';
import { ForceRingConfirmModal } from './ForceRingConfirmModal.jsx';
import { ForceRingActiveStatus } from './ForceRingActiveStatus.jsx';
import { ForceRingHistory } from './ForceRingHistory.jsx';
import { triggerForceRing, fetchActiveForceRing } from '../../lib/forceRing.js';
import { supabase } from '../../lib/supabase.js';
import { ThreeDIcon } from '../icons/ThreeDIcon.jsx';
import { deferEffectStateUpdate } from '../../lib/deferEffectStateUpdate.js';

export function ForceRingPanel({ familyId, hasChild = true, compact = false, childList = [] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState(null);
  const [quotaInfo, setQuotaInfo] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // Phase 3 Case 2: 다자녀 가족에서 SOS 대상 명시 선택. 자녀 1명이면 자동 매칭.
  const childCandidates = useMemo(
    () => (childList || []).filter((c) => c?.user_id),
    [childList],
  );
  const [selectedChildUserId, setSelectedChildUserId] = useState(
    childCandidates.length === 1 ? childCandidates[0].user_id : null
  );

  // childList 가 비동기 갱신될 수 있어 1명 가족은 자동 선택 유지.
  useEffect(() => {
    if (childCandidates.length === 1 && !selectedChildUserId) {
      return deferEffectStateUpdate(() => setSelectedChildUserId(childCandidates[0].user_id));
    }
    return undefined;
  }, [childCandidates, selectedChildUserId]);

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
    return deferEffectStateUpdate(() => {
      void refresh();
    });
  }, [refresh]);

  const handleConfirm = async (message) => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await triggerForceRing({
        familyId,
        targetChildUserId: selectedChildUserId,
        message,
      });
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

  // 다자녀 (2+) 가족 자녀 선택 칩 — confirm 모달 띄우기 전에 명시 선택 강제.
  const renderChildPicker = () => {
    if (childCandidates.length < 2) return null;
    return (
      <div className="hyeni-tool-child-picker" role="group" aria-label="알람 받을 자녀 선택"
           style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginTop: "var(--space-3)" }}>
        {childCandidates.map((c) => {
          const active = selectedChildUserId === c.user_id;
          return (
            <button
              key={c.user_id}
              type="button"
              onClick={() => setSelectedChildUserId(c.user_id)}
              aria-pressed={active}
              style={{
                padding: "8px 14px",
                borderRadius: "var(--radius-pill)",
                border: active ? "2px solid var(--theme-accent)" : "1px solid var(--line-soft)",
                background: active ? "var(--theme-accent-soft)" : "var(--bg-base)",
                color: active ? "var(--theme-accent-text)" : "var(--fg-primary)",
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {c.name || "자녀"}
            </button>
          );
        })}
      </div>
    );
  };

  const triggerDisabled = childCandidates.length >= 2 && !selectedChildUserId;

  if (!hasChild) {
    return (
      <section className="hyeni-tool hyeni-tool--emergency" aria-label="응급 강제 알람">
        <div className="hyeni-tool-empty" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "20px 16px", textAlign: "center" }}>
          <ThreeDIcon name="safety-mascot" size={72} aria-label="" />
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--fg-secondary)" }}>
            아이 페어링 후 사용할 수 있어요.
          </div>
        </div>
      </section>
    );
  }

  const quotaRemaining = quotaInfo ? quotaInfo.quota - quotaInfo.used : null;
  const quotaUsedPct = quotaInfo
    ? Math.min(100, (quotaInfo.used / Math.max(1, quotaInfo.quota)) * 100)
    : 0;
  const isDisabled =
    submitting ||
    !!activeEvent ||
    triggerDisabled ||
    (quotaRemaining !== null && quotaRemaining <= 0);

  if (compact) {
    return (
      <section className="hyeni-tool hyeni-tool--emergency" aria-label="응급 강제 알람">
        <div className="hyeni-tool-tile">
          <div className="hyeni-tool-tile__glyph" aria-hidden="true" style={{ background: "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <ThreeDIcon name="sos-shield" size={32} aria-label="" />
          </div>
          <div className="hyeni-tool-tile__body">
            <div className="hyeni-tool-tile__title">응급 강제 알람</div>
            <div className="hyeni-tool-tile__sub hyeni-tool-tile__sub--accent">
              아이 폰을 15초간 풀볼륨으로 울림
            </div>
            {quotaInfo && (
              <div className="hyeni-tool-tile__sub">
                오늘 남은 횟수 {quotaRemaining} / {quotaInfo.quota}
              </div>
            )}
          </div>
          {!activeEvent && error !== 'quota_exceeded' && (
            <div className="hyeni-tool-tile__cta">
              <ForceRingTriggerButton
                compact
                disabled={isDisabled}
                onConfirm={() => setModalOpen(true)}
              />
            </div>
          )}
        </div>
        {renderChildPicker()}

        {activeEvent ? (
          <ForceRingActiveStatus
            event={activeEvent}
            onCleared={() => {
              setActiveEvent(null);
              refresh();
            }}
          />
        ) : error === 'quota_exceeded' ? (
          <div className="hyeni-tool-status hyeni-tool-status--warn" role="status">
            <div className="hyeni-tool-status__head">
              <span className="hyeni-tool-status__dot" aria-hidden="true" />
              오늘 사용 한도 초과
            </div>
            <div className="hyeni-tool-status__body">
              {quotaInfo?.used} / {quotaInfo?.quota} 사용 · 자정에 초기화됩니다.
            </div>
          </div>
        ) : null}

        <ForceRingHistory familyId={familyId} limit={5} />

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
    <section className="hyeni-tool hyeni-tool--emergency" aria-label="응급 강제 알람">
      <article className="hyeni-tool-card hyeni-tool-card--accent">
        <span className="hyeni-tool-card__rule" aria-hidden="true" />
        <div className="hyeni-tool-card__head">
          <div>
            <span className="hyeni-tool-card__kicker" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <ThreeDIcon name="sos-shield" size={18} aria-label="" />
              진짜 응급 시에만
            </span>
            <h2 className="hyeni-tool-card__title">응급 강제 알람</h2>
            <p className="hyeni-tool-card__sub">
              아이 폰이 무음·방해금지여도 풀볼륨 알람을 15초간 강제로 울려요.
              평상시 연락은 일반 알림을 사용해 주세요.
            </p>
          </div>
          {quotaInfo && (
            <span className="hyeni-tool-card__quota" aria-label="오늘 남은 횟수">
              <strong>{quotaRemaining}</strong>
              <span style={{ opacity: 0.6 }}>/ {quotaInfo.quota}</span>
            </span>
          )}
        </div>
        {quotaInfo && (
          <div className="hyeni-tool-meter">
            <div className="hyeni-tool-meter__track" aria-hidden="true">
              <div className="hyeni-tool-meter__fill" style={{ width: `${quotaUsedPct}%` }} />
            </div>
            <div className="hyeni-tool-meter__caption">
              오늘 남은 횟수: {quotaRemaining} / {quotaInfo.quota}
            </div>
          </div>
        )}
      </article>

      {activeEvent ? (
        <ForceRingActiveStatus
          event={activeEvent}
          onCleared={() => {
            setActiveEvent(null);
            refresh();
          }}
        />
      ) : error === 'quota_exceeded' ? (
        <div className="hyeni-tool-status hyeni-tool-status--warn" role="status">
          <div className="hyeni-tool-status__head">
            <span className="hyeni-tool-status__dot" aria-hidden="true" />
            오늘 사용 한도 초과
          </div>
          <div className="hyeni-tool-status__body">
            {quotaInfo?.used} / {quotaInfo?.quota} 사용했어요. 자정에 초기화됩니다.
            {quotaInfo?.tier === 'free' && (
              <>
                <br />
                프리미엄으로 업그레이드 시 일 10회까지 사용할 수 있어요.
              </>
            )}
          </div>
          <div className="hyeni-tool-status__actions">
            <a href="tel:" className="hyeni-tool-tel" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><ThreeDIcon name="phone-lavender" size={16} aria-label="" /> 직접 통화</a>
            <a href="tel:119" className="hyeni-tool-tel hyeni-tool-tel--emergency" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><ThreeDIcon name="sos-shield" size={16} aria-label="" /> 119</a>
          </div>
        </div>
      ) : (
        <>
          {renderChildPicker()}
          <ForceRingTriggerButton
            disabled={isDisabled}
            onConfirm={() => setModalOpen(true)}
          />
        </>
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
