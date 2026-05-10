/**
 * Memo realtime channel + multichild isolation helpers.
 *
 * memo_replies.child_id (family_members.id) 기반 server-side filter + realtime INSERT 검증.
 * postgres_changes filter는 family_id 단위로만 가능하므로 수신된 row를
 * isMemoForSelectedChild 로 2차 검증하여 선택된 자녀의 thread만 state에 반영한다.
 *
 * 정책 B (multichild 정확 분리):
 * child_id 컬럼이 채워진 row: child_id 일치 여부로만 판별.
 * legacy NULL row: 모든 자녀 탭에서 무시 (과거 메시지 유실 허용).
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
 * child_id 기반 로직 — 정책 B (multichild 정확 분리):
 * - row.child_id === selectedChildId  → 해당 자녀 thread row → true
 * - row.child_id === null             → legacy row → 무시 (false)
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
  // 정책 B: legacy NULL row는 무시
  if (row.child_id == null) return false;
  return row.child_id === selectedChildId;
}
