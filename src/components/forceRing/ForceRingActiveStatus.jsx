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
      <div className="hyeni-tool-status hyeni-tool-status--error" role="status">
        <div className="hyeni-tool-status__head">
          <span className="hyeni-tool-status__dot" aria-hidden="true" />
          전달 실패
        </div>
        <div className="hyeni-tool-status__body">
          아이 폰이 오프라인이거나 배터리가 꺼졌을 수 있어요.
          <br />
          <span style={{ opacity: 0.7 }}>오늘 사용 횟수는 차감되지 않았어요.</span>
        </div>
        <div className="hyeni-tool-status__actions">
          <a href="tel:" className="hyeni-tool-tel">📞 직접 통화</a>
          <a href="tel:119" className="hyeni-tool-tel hyeni-tool-tel--emergency">🚨 119</a>
        </div>
      </div>
    );
  }

  if (event.acknowledged_at) {
    const responseSec = event.delivered_at
      ? Math.round((new Date(event.acknowledged_at) - new Date(event.delivered_at)) / 1000)
      : null;
    return (
      <div className="hyeni-tool-status hyeni-tool-status--success" role="status">
        <div className="hyeni-tool-status__head">
          <span className="hyeni-tool-status__dot" aria-hidden="true" />
          아이가 확인했어요
        </div>
        <div className="hyeni-tool-status__body">
          {fmtTime(event.acknowledged_at)}
          {responseSec !== null && ` · ${responseSec}초 만에 응답`}
        </div>
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
      <div className="hyeni-tool-status hyeni-tool-status--success" role="status">
        <div className="hyeni-tool-status__head">
          <span className="hyeni-tool-status__dot" aria-hidden="true" />
          알람 정지됨
        </div>
        <div className="hyeni-tool-status__body">
          {fmtTime(event.stopped_at)} · {reasonText}
        </div>
      </div>
    );
  }

  if (event.delivered_at) {
    return (
      <div className="hyeni-tool-status hyeni-tool-status--info" role="status">
        <div className="hyeni-tool-status__head">
          <span className="hyeni-tool-status__dot hyeni-tool-status__dot--pulse" aria-hidden="true" />
          전달됨 · {fmtTime(event.delivered_at)}
        </div>
        <div className="hyeni-tool-status__body">아이 응답 대기 중</div>
        <button
          type="button"
          onClick={() => {
            stopForceRing(event.id);
            onCleared?.();
          }}
          aria-label="그만 울릴께요"
          className="hyeni-tool-button hyeni-tool-button--small"
          style={{ marginTop: 4 }}
        >
          <span className="hyeni-tool-button__label">그만 울릴께요</span>
        </button>
        <div className="hyeni-tool-status__actions">
          <a href="tel:" className="hyeni-tool-tel">📞 직접 통화</a>
          <a href="tel:119" className="hyeni-tool-tel hyeni-tool-tel--emergency">🚨 119</a>
        </div>
      </div>
    );
  }

  return (
    <div className="hyeni-tool-status hyeni-tool-status--info" role="status">
      <div className="hyeni-tool-status__head">
        <span className="hyeni-tool-status__dot hyeni-tool-status__dot--pulse" aria-hidden="true" />
        전달 시도 중
      </div>
      <div className="hyeni-tool-status__body">10분 후 자동으로 취소돼요.</div>
    </div>
  );
}
