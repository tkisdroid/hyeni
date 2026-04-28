import { useState } from 'react';
import { setSavedPlacePlaydateSafe, upsertPublicPlace } from '../../lib/friendPlaydate.js';

export default function PlaydateSafePlaceList({ places, onUpdate }) {
  const [busyId, setBusyId] = useState(null);

  if (!places || places.length === 0) {
    return (
      <div className="hyeni-tool-empty">
        친구놀이 안전장소를 먼저 등록하세요.
        <br />
        학교·공원·학원 같은 곳을 지정할 수 있어요.
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
    <ul className="hyeni-tool-list" aria-label="친구놀이 안전장소">
      {places.map((place) => {
        const eligible = isPlaydateEligible(place);
        const lockedOff = !eligible && !place.is_playdate_safe;
        return (
          <li key={place.id} className="hyeni-tool-list__row">
            <div>
              <div className="hyeni-tool-list__primary">{place.name}</div>
              {lockedOff && (
                <div className="hyeni-tool-list__secondary">
                  카카오 장소 검색으로 등록된 곳만 지정 가능
                </div>
              )}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={place.is_playdate_safe}
              aria-label={`${place.name} 친구놀이 토글`}
              disabled={busyId === place.id || lockedOff}
              onClick={() => handleToggle(place)}
              className="hyeni-tool-toggle__switch"
              style={lockedOff ? { opacity: 0.4 } : undefined}
            />
          </li>
        );
      })}
    </ul>
  );
}
