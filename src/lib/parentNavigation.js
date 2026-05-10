/**
 * Parent navigation guards + selectedChildId lifecycle helpers.
 *
 * App.jsx의 inline navigation logic을 단위 테스트 가능한 형태로 추출한
 * pure 함수 모음. 각 함수는 App.jsx의 동일 위치 logic과 1:1 대응한다 — 동작 변경 시
 * 양쪽을 함께 수정해야 한다.
 *
 * 단일 자녀 가정에서도 multichild isolation 코드 흐름이 논리적 문제 없이 동작하도록
 * 명시적으로 검증한다 (`pickInitialActiveView`는 단일 자녀를 calendar로 시작시키고,
 * `shouldAutoPinSingleChild`는 selectedChildId를 자동 pin).
 */

/**
 * 부모/자녀 + 자녀 수에 따른 초기 activeView 결정.
 * App.jsx:617-620 inline logic 대응.
 *
 * - 부모 + multichild(2+) → "home" (자녀 선택 hub로 시작)
 * - 부모 + 단일 자녀 → "calendar" (홈 탭은 hidden, 오늘로 직행)
 * - 자녀 모드 → "calendar"
 *
 * @param {{ isParent: boolean, childCount: number }} args
 * @returns {"home"|"calendar"}
 */
export function pickInitialActiveView({ isParent, childCount }) {
  return (isParent && childCount >= 2) ? "home" : "calendar";
}

/**
 * 단일 자녀 부모에 한해 selectedChildId를 자동으로 pin해야 하는지 판별.
 * App.jsx:676-678 inline logic 대응.
 *
 * 단일 자녀 가정에서 selectedChildId가 비어있으면 모든 per-child 화면이 빈 context로
 * 동작 — fetchMemoReplies/realtime 등 server-side filter가 망가지므로 단일 자녀일 때
 * 첫 자녀로 자동 pin하여 기존 single-child UX와 동등성 유지.
 *
 * @param {{ pairedChildren: Array<{id: string}>, selectedChildId: string|null }} args
 * @returns {boolean}
 */
export function shouldAutoPinSingleChild({ pairedChildren, selectedChildId }) {
  if (!Array.isArray(pairedChildren)) return false;
  return pairedChildren.length === 1 && !selectedChildId;
}

/**
 * 현재 selectedChildId가 family에서 제거되어 stale 인지 판별.
 * App.jsx:672-675 inline logic 대응.
 *
 * 자녀 unpair / 가족 재구성 시 localStorage에 남아있던 ID가 더 이상 유효하지 않을 수
 * 있어 cleanup 트리거.
 *
 * @param {{ pairedChildren: Array<{id: string}>, selectedChildId: string|null }} args
 * @returns {boolean}
 */
export function isSelectedChildIdStale({ pairedChildren, selectedChildId }) {
  if (!selectedChildId) return false;
  if (!Array.isArray(pairedChildren)) return false;
  const validIds = new Set(pairedChildren.map((c) => c?.id));
  return !validIds.has(selectedChildId);
}

/**
 * multichild 부모가 자녀 미선택 상태에서 home 외 view로 이동했을 때 home으로 강제
 * redirect 해야 하는지 판별.
 * App.jsx:682-687 inline logic 대응.
 *
 * 단일 자녀(`isMultiChild === false`)는 항상 false 반환 — selectedChildId가 자동
 * pin되므로 redirect 불필요.
 *
 * @param {{ isParent: boolean, isMultiChild: boolean, selectedChildId: string|null, activeView: string }} args
 * @returns {boolean}
 */
export function shouldRedirectMultichildToHome({ isParent, isMultiChild, selectedChildId, activeView }) {
  if (!isParent) return false;
  if (!isMultiChild) return false;
  if (selectedChildId) return false;
  return activeView !== "home";
}

/**
 * memo push 알림 routing용 targetChildUserId 결정.
 * App.jsx:4838 inline logic 대응.
 *
 * push-notify edge function이 `new_memo` action에서 이 값을 받아 family_members.role='parent'
 * 모두 + 그 user_id 자녀 1명으로 recipientUserIds를 좁힌다. 다른 자녀 device는 알림에서
 * 제외되어 알림음/배지가 울리지 않는다.
 *
 * - 부모: selectedChild.user_id → fallback pairedChildren[0].user_id → null
 * - 자녀: 본인 authUserId (다른 자녀 device 제외)
 *
 * @param {{
 *   isParent: boolean,
 *   selectedChildUserId: string|null,
 *   pairedChildren: Array<{user_id?: string|null}>,
 *   authUserId: string|null,
 * }} args
 * @returns {string|null}
 */
export function pickMemoTargetChildUserId({ isParent, selectedChildUserId, pairedChildren, authUserId }) {
  if (!isParent) return authUserId ?? null;
  if (selectedChildUserId) return selectedChildUserId;
  if (Array.isArray(pairedChildren) && pairedChildren[0]?.user_id) {
    return pairedChildren[0].user_id;
  }
  return null;
}
