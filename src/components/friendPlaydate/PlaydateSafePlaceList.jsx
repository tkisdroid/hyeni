import { useState } from 'react';
import { setSavedPlacePlaydateSafe, upsertPublicPlace } from '../../lib/friendPlaydate.js';

export default function PlaydateSafePlaceList({ places, onUpdate }) {
  const [busyId, setBusyId] = useState(null);

  if (!places || places.length === 0) {
    return (
      <div style={{ padding: 12, color: '#6b7280', fontSize: 14 }}>
        친구놀이 안전장소를 먼저 등록하세요. 학교·공원·학원 같은 곳을 지정할 수 있습니다.
      </div>
    );
  }

  const handleToggle = async (place) => {
    if (busyId) return;
    setBusyId(place.id);
    try {
      const next = !place.is_playdate_safe;
      let publicPlaceId = place.public_place_id;
      if (next && !publicPlaceId) {
        publicPlaceId = await upsertPublicPlace({
          kakaoPlaceId: place.location?.kakao_place_id ?? null,
          name: place.name,
          lat: place.location?.lat,
          lng: place.location?.lng,
        });
      }
      await setSavedPlacePlaydateSafe(place.id, next, next ? publicPlaceId : null);
      onUpdate?.();
    } catch (e) {
      console.error('[PlaydateSafePlaceList]', e);
      alert('변경에 실패했습니다');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>친구놀이 안전장소</div>
      {places.map((place) => (
        <div key={place.id} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 8, borderBottom: '1px solid #f3f4f6',
        }}>
          <div>{place.name}</div>
          <button
            role="switch"
            aria-checked={place.is_playdate_safe}
            aria-label={`${place.name} 친구놀이 토글`}
            disabled={busyId === place.id}
            onClick={() => handleToggle(place)}
            style={{
              width: 44, height: 24, borderRadius: 12,
              backgroundColor: place.is_playdate_safe ? '#10b981' : '#d1d5db',
              border: 'none', position: 'relative',
              cursor: busyId === place.id ? 'wait' : 'pointer',
            }}
          >
            <span style={{
              position: 'absolute', top: 2,
              left: place.is_playdate_safe ? 22 : 2,
              width: 20, height: 20, borderRadius: 10,
              backgroundColor: '#fff', transition: 'left 0.2s',
            }} />
          </button>
        </div>
      ))}
    </div>
  );
}
