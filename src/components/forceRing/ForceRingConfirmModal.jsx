import React, { useState } from 'react';

export function ForceRingConfirmModal({ isOpen, onCancel, onConfirm, quotaInfo }) {
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const remaining = quotaInfo ? quotaInfo.quota - quotaInfo.used : null;

  return (
    <div role="dialog" aria-modal="true" className="hyeni-tool hyeni-tool--emergency hyeni-tool-modal-backdrop">
      <div className="hyeni-tool-modal">
        <div className="hyeni-tool-modal__head">
          <h2>정말 응급 신호를 보낼까요?</h2>
          <p>아래 동작이 즉시 실행돼요.</p>
        </div>

        <ul className="hyeni-tool-modal__bullets">
          <li>아이 폰의 무음·방해금지 우회 풀볼륨</li>
          <li>풀스크린 알람 15초간 표시</li>
          <li>잠금 화면 위에 강제 노출</li>
        </ul>

        <div className="hyeni-tool-modal__field">
          <label htmlFor="force-ring-message">
            메시지 (선택)
            <span>{message.length} / 80</span>
          </label>
          <textarea
            id="force-ring-message"
            maxLength={80}
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 80))}
            placeholder="예: 지금 바로 전화 줘"
          />
        </div>

        {remaining !== null && (
          <div style={{ color: 'var(--hyeni-ink-500)', fontSize: 12, fontWeight: 700 }}>
            <span style={{ color: 'var(--hyeni-emergency-ink)', fontWeight: 900 }}>
              {`${remaining} / ${quotaInfo.quota}`}
            </span>
            <span style={{ marginLeft: 6 }}>오늘 남은 횟수</span>
          </div>
        )}

        <div className="hyeni-tool-modal__actions">
          <button
            type="button"
            onClick={onCancel}
            className="hyeni-tool-button hyeni-tool-button--ghost hyeni-tool-button--small"
          >
            <span className="hyeni-tool-button__label">취소</span>
          </button>
          <button
            type="button"
            onClick={() => onConfirm(message)}
            aria-label="응급 신호 보내기"
            className="hyeni-tool-button hyeni-tool-button--small"
          >
            <span className="hyeni-tool-button__label">응급 신호 보내기</span>
          </button>
        </div>
      </div>
    </div>
  );
}
