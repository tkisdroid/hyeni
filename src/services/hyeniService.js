import { supabase } from '../lib/supabase.js'

/**
 * 혜니 적립/조회 서비스
 * - 모든 적립은 earn_points RPC를 통해 처리
 * - 스트릭은 update_streak RPC로 관리
 */

// ── 내부 헬퍼 ──────────────────────────────────────────

function parseRpcResult(data) {
  if (typeof data === 'string') {
    return JSON.parse(data)
  }
  return data
}

async function callEarnPoints({
  familyId,
  memberId,
  category,
  amount,
  description,
  metadata = {},
}) {
  const { data, error } = await supabase.rpc('earn_points', {
    p_family_id: familyId,
    p_member_id: memberId,
    p_category: category,
    p_amount: amount,
    p_description: description,
    p_metadata: metadata,
  })

  if (error) {
    throw error
  }

  return parseRpcResult(data)
}

// ── 적립 함수 ──────────────────────────────────────────

/** 출석 체크 (앱 실행 시 1회, 1혜니) */
export async function earnAttendance(familyId, memberId) {
  try {
    const result = await callEarnPoints({
      familyId,
      memberId,
      category: 'attendance',
      amount: 1,
      description: '출석 체크',
    })
    return result
  } catch (error) {
    console.warn('[Hyeni] earnAttendance failed:', error)
    return { success: false }
  }
}

/** 정시/여유 도착 (정시: 3혜니, 여유(10분+ 일찍): 5혜니) */
export async function earnArrival(familyId, memberId, eventId, isEarly) {
  try {
    const category = isEarly ? 'arrival_early' : 'arrival'
    const amount = isEarly ? 5 : 3
    const description = isEarly ? '여유 도착' : '정시 도착'

    const result = await callEarnPoints({
      familyId,
      memberId,
      category,
      amount,
      description,
      metadata: { event_id: eventId },
    })
    return result
  } catch (error) {
    console.warn('[Hyeni] earnArrival failed:', error)
    return { success: false }
  }
}

/** 스트릭 체크 + 보너스 (도착 후 호출) */
export async function checkAndEarnStreak(familyId, memberId) {
  try {
    const { data, error } = await supabase.rpc('update_streak', {
      p_family_id: familyId,
    })

    if (error) {
      throw error
    }

    const streakResult = parseRpcResult(data)
    const streak = streakResult.streak_days ?? streakResult

    let bonus = 0

    if (streak > 0 && streak % 30 === 0) {
      bonus = 100
      await callEarnPoints({
        familyId,
        memberId,
        category: 'arrival_streak',
        amount: 100,
        description: '30일 연속 보너스',
      })
    } else if (streak > 0 && streak % 7 === 0) {
      bonus = 10
      await callEarnPoints({
        familyId,
        memberId,
        category: 'arrival_streak',
        amount: 10,
        description: '7일 연속 보너스',
      })
    }

    return { streak, bonus }
  } catch (error) {
    console.warn('[Hyeni] checkAndEarnStreak failed:', error)
    return { success: false }
  }
}

/** 일정 등록 (1혜니) */
export async function earnEventCreate(familyId, memberId) {
  try {
    const result = await callEarnPoints({
      familyId,
      memberId,
      category: 'event_create',
      amount: 1,
      description: '일정 등록',
    })
    return result
  } catch (error) {
    console.warn('[Hyeni] earnEventCreate failed:', error)
    return { success: false }
  }
}

/** 꾹! (1혜니) */
export async function earnGguk(familyId, memberId) {
  try {
    const result = await callEarnPoints({
      familyId,
      memberId,
      category: 'gguk',
      amount: 1,
      description: '꾹!',
    })
    return result
  } catch (error) {
    console.warn('[Hyeni] earnGguk failed:', error)
    return { success: false }
  }
}

/** 메모 작성 (1혜니) */
export async function earnMemo(familyId, memberId) {
  try {
    const result = await callEarnPoints({
      familyId,
      memberId,
      category: 'memo',
      amount: 1,
      description: '메모 작성',
    })
    return result
  } catch (error) {
    console.warn('[Hyeni] earnMemo failed:', error)
    return { success: false }
  }
}

/** 학원 등록 (3혜니) */
export async function earnAcademyRegister(familyId, memberId) {
  try {
    const result = await callEarnPoints({
      familyId,
      memberId,
      category: 'academy_register',
      amount: 3,
      description: '학원 등록',
    })
    return result
  } catch (error) {
    console.warn('[Hyeni] earnAcademyRegister failed:', error)
    return { success: false }
  }
}

// ── 조회 함수 ──────────────────────────────────────────

/** 지갑 조회 */
export async function getWallet(familyId) {
  try {
    const { data, error } = await supabase
      .from('point_wallets')
      .select('*')
      .eq('family_id', familyId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return { balance: 0, total_earned: 0, streak_days: 0 }
      }
      throw error
    }

    return data
  } catch (error) {
    console.warn('[Hyeni] getWallet failed:', error)
    return { balance: 0, total_earned: 0, streak_days: 0 }
  }
}

/** 거래 내역 조회 */
export async function getTransactions(familyId, limit = 20, offset = 0) {
  try {
    const { data, error } = await supabase
      .from('point_transactions')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      throw error
    }

    return data ?? []
  } catch (error) {
    console.warn('[Hyeni] getTransactions failed:', error)
    return []
  }
}

/** 오늘 적립 현황 (카테고리별 횟수) */
export async function getTodayStats(familyId) {
  try {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data, error } = await supabase
      .from('point_transactions')
      .select('category, amount')
      .eq('family_id', familyId)
      .eq('type', 'earn')
      .gte('created_at', todayStart.toISOString())

    if (error) {
      throw error
    }

    const stats = {}

    for (const row of data ?? []) {
      const existing = stats[row.category] ?? { count: 0, total: 0 }
      stats[row.category] = {
        count: existing.count + 1,
        total: existing.total + row.amount,
      }
    }

    return stats
  } catch (error) {
    console.warn('[Hyeni] getTodayStats failed:', error)
    return {}
  }
}
