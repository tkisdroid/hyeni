/**
 * Memo realtime channel + multichild isolation helpers.
 *
 * memo_replies 테이블에 child_id 컬럼이 없으므로 client-side filter로 isolation 달성.
 * postgres_changes filter는 family_id 단위로만 가능하며, 수신된 row를
 * isMemoForSelectedChild 로 걸러서 선택된 자녀의 thread만 state에 반영한다.
 */

/**
 * selectedChildId 변경 시 useEffect cleanup/resubscribe 트리거용 채널 키 생성.
 * 실제 Supabase 채널 이름이 아닌 React useEffect deps 구별용 key임.
 *
 * @param {string|null} familyId
 * @param {string|null} selectedChildId
 * @returns {string|null}
 */
export function buildMemoChannelKey(familyId, selectedChildId) {
  if (!familyId || !selectedChildId) return null;
  return `family:${familyId}:child:${selectedChildId}`;
}

/**
 * INSERT 수신된 row가 현재 선택된 자녀 context에 속하는지 판별.
 *
 * 로직:
 * - row.user_id === selectedChildUserId  → 자녀 본인이 보낸 메모
 * - row.user_id === parentUserId         → 부모가 보낸 답장 (해당 자녀와의 대화이므로 포함)
 * - 다른 자녀가 보낸 row                 → false (다른 자녀 thread 격리)
 * - row.user_id null (legacy row)        → false (무시)
 *
 * @param {{ user_id: string|null, user_role: string }} row
 * @param {string|null} selectedChildUserId
 * @param {string|null} parentUserId
 * @returns {boolean}
 */
export function isMemoForSelectedChild(row, selectedChildUserId, parentUserId) {
  if (!row || !row.user_id) return false; // legacy null user_id ignored
  if (!selectedChildUserId || !parentUserId) return false;
  return row.user_id === selectedChildUserId || row.user_id === parentUserId;
}
