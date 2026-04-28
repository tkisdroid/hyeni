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
    return <div className="hyeni-tool-empty">친구놀이 이력이 없어요.</div>;
  }
  return (
    <ul className="hyeni-tool-list" aria-label="친구놀이 이력">
      {history.map((h) => (
        <li key={h.id} className="hyeni-tool-list__row">
          <div>
            <div className="hyeni-tool-list__primary">
              {h.place_name ?? '안전장소'} · {h.friend_child_name ?? '친구'}
            </div>
            <div className="hyeni-tool-list__secondary">
              {formatDuration(h.started_at, h.stopped_at)}
              {h.stop_reason ? ` · ${REASON_LABEL[h.stop_reason] ?? h.stop_reason}` : ''}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
