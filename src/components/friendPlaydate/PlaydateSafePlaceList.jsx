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

  // 카카오 장소 ID가 있어야 친구놀이 매칭이 가능 (RLS WITH CHECK kakao_place_id IS NOT NULL).
  const isPlaydateEligible = (place) =>
    !!(place.location?.kakao_place_id || place.public_place_id);

  const handleToggle = async (place) => {
    if (busyId) return;
    if (!place.is_playdate_safe && !isPlaydateEligible(place)) {
      alert('카카오 장소 검색으로 등록된 곳만 친구놀이 장소로 지정할 수 있어요');
      return;
    }
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
      {places.map((place) => {
        const eligible = isPlaydateEligible(place);
        const lockedOff = !eligible && !place.is_playdate_safe;
        return (
          <div key={place.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: 8, borderBottom: '1px solid #f3f4f6',
          }}>
            <div>
              <div>{place.name}</div>
              {lockedOff && (
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                  카카오 장소 검색으로 등록된 곳만 지정 가능
                </div>
              )}
            </div>
            <button
              role="switch"
              aria-checked={place.is_playdate_safe}
              aria-label={`${place.name} 친구놀이 토글`}
              disabled={busyId === place.id || lockedOff}
              onClick={() => handleToggle(place)}
              style={{
                width: 44, height: 24, borderRadius: 12,
                backgroundColor: place.is_playdate_safe ? '#10b981' : '#d1d5db',
                border: 'none', position: 'relative',
                opacity: lockedOff ? 0.4 : 1,
                cursor: busyId === place.id ? 'wait'
                  : (lockedOff ? 'not-allowed' : 'pointer'),
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
        );
      })}
    </div>
  );
}
