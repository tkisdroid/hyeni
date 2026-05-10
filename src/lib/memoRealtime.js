/**
 * Memo realtime channel + multichild isolation helpers.
 *
 * memo_replies.child_id (family_members.id) 기반 server-side filter + realtime INSERT 검증.
 * postgres_changes filter는 family_id 단위로만 가능하므로 수신된 row를
 * isMemoForSelectedChild 로 2차 검증하여 선택된 자녀의 thread만 state에 반영한다.
 *
 * child_id 컬럼이 채워진 row: child_id 일치 여부로 판별.
 * legacy NULL row (single-child backfill 전 또는 backfill 누락): 표시 허용.
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
 * child_id 기반 로직 (DB schema 변경 후):
 * - row.child_id === selectedChildId  → 해당 자녀 thread row
 * - row.child_id === null             → legacy single-child row (backfill 전) → 표시 허용
 * - row.child_id !== selectedChildId  → 다른 자녀 thread → false
 * - selectedChildId 없으면            → false (context 미설정)
 *
 * @param {{ child_id: string|null }} row
 * @param {string|null} selectedChildId  family_members.id (UUID)
 * @returns {boolean}
 */
export function isMemoForSelectedChild(row, selectedChildId) {
  if (!row) return false;
  if (!selectedChildId) return false;
  // legacy NULL은 single-child 가족 row이므로 표시 허용
  if (row.child_id == null) return true;
  return row.child_id === selectedChildId;
}
