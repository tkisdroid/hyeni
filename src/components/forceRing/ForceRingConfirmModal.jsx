import React, { useState } from 'react';

export function ForceRingConfirmModal({ isOpen, onCancel, onConfirm, quotaInfo }) {
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const remaining = quotaInfo ? quotaInfo.quota - quotaInfo.used : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'white',
          padding: 24,
          borderRadius: 12,
          maxWidth: 480,
          width: '90%',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <h2 style={{ color: '#DC2626', marginTop: 0 }}>정말 응급 신호를 보낼까요?</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li>아이 폰: 무음·방해금지 우회 풀볼륨</li>
          <li>풀스크린 알람 15초</li>
          <li>잠금 화면 위에 표시됨</li>
        </ul>

        <label style={{ display: 'block', marginTop: 16 }}>
          메시지 (선택, 80자)
          <textarea
            maxLength={80}
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 80))}
            placeholder="예: 지금 바로 전화 줘"
            style={{ width: '100%', minHeight: 60, marginTop: 8, padding: 8 }}
          />
          <div style={{ fontSize: 12, textAlign: 'right' }}>{message.length} / 80</div>
        </label>

        {remaining !== null && (
          <p style={{ marginTop: 16 }}>
            오늘 남은 횟수: {remaining} / {quotaInfo.quota}
          </p>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: 12,
              border: '1px solid #D1D5DB',
              background: 'white',
              borderRadius: 8,
              fontSize: 16,
              cursor: 'pointer',
            }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => onConfirm(message)}
            aria-label="응급 신호 보내기"
            style={{
              flex: 2,
              padding: 12,
              border: 'none',
              background: '#DC2626',
              color: 'white',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            🔴 응급 신호 보내기
          </button>
        </div>
      </div>
    </div>
  );
}
