// src/components/friendPlaydate/PlaydateHistory.jsx
const REASON_LABEL = {
  child_end: '아이 종료',
  parent_end: '부모 정지',
  auto_geofence_exit: '자동 종료',
};

function formatDuration(start, end) {
  if (!start || !end) return '';
  const ms = new Date(end) - new Date(start);
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}분`;
  return `${Math.floor(min / 60)}시간 ${min % 60}분`;
}

export default function PlaydateHistory({ history }) {
  if (!history || history.length === 0) {
    return <div style={{ padding: 12, color: '#6b7280', fontSize: 13 }}>친구놀이 이력이 없어요</div>;
  }
  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>최근 친구놀이</div>
      {history.map((h) => (
        <div key={h.id} style={{
          padding: 8, borderBottom: '1px solid #f3f4f6', fontSize: 13,
        }}>
          <div>{h.place_name ?? '안전장소'} · {h.friend_child_name ?? '친구'}</div>
          <div style={{ color: '#6b7280', fontSize: 12 }}>
            {formatDuration(h.started_at, h.stopped_at)}
            {h.stop_reason ? ` · ${REASON_LABEL[h.stop_reason] ?? h.stop_reason}` : ''}
          </div>
        </div>
      ))}
    </div>
  );
}
