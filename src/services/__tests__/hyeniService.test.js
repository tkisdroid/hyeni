import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockSupabase } from '../../test/mocks/supabase.js'

// Create mock instance at module level for vi.mock factory
const mockInstance = createMockSupabase()

vi.mock('../../lib/supabase.js', () => ({
  supabase: mockInstance.supabase,
}))

// Import after mock setup
const { supabase } = await import('../../lib/supabase.js')
const {
  earnAttendance,
  earnArrival,
  checkAndEarnStreak,
  earnEventCreate,
  earnGguk,
  earnMemo,
  earnAcademyRegister,
  getWallet,
  getTransactions,
  getTodayStats,
} = await import('../hyeniService.js')

const { mockRpc, mockFrom, createQueryBuilder: createQB } = mockInstance

const FAMILY_ID = 'family-001'
const MEMBER_ID = 'member-001'

beforeEach(() => {
  vi.clearAllMocks()
})

// ── earnAttendance ──────────────────────────────────────

describe('earnAttendance', () => {
  it('should call earn_points RPC with category=attendance, amount=1', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, balance: 10, earned: 1 },
      error: null,
    })

    const result = await earnAttendance(FAMILY_ID, MEMBER_ID)

    expect(mockRpc).toHaveBeenCalledWith('earn_points', {
      p_family_id: FAMILY_ID,
      p_member_id: MEMBER_ID,
      p_category: 'attendance',
      p_amount: 1,
      p_description: '출석 체크',
      p_metadata: {},
    })
    expect(result).toEqual({ success: true, balance: 10, earned: 1 })
  })

  it('should return { success: false } when daily limit reached', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: false },
      error: null,
    })

    const result = await earnAttendance(FAMILY_ID, MEMBER_ID)

    expect(result).toEqual({ success: false })
  })

  it('should not crash on RPC error and return { success: false }', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'DB error', code: '50000' },
    })

    const result = await earnAttendance(FAMILY_ID, MEMBER_ID)

    expect(result).toEqual({ success: false })
  })
})

// ── earnArrival ─────────────────────────────────────────

describe('earnArrival', () => {
  it('should use category=arrival and amount=3 when isEarly=false', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, balance: 13, earned: 3 },
      error: null,
    })

    const result = await earnArrival(FAMILY_ID, MEMBER_ID, 'evt-1', false)

    expect(mockRpc).toHaveBeenCalledWith('earn_points', {
      p_family_id: FAMILY_ID,
      p_member_id: MEMBER_ID,
      p_category: 'arrival',
      p_amount: 3,
      p_description: '정시 도착',
      p_metadata: { event_id: 'evt-1' },
    })
    expect(result).toEqual({ success: true, balance: 13, earned: 3 })
  })

  it('should use category=arrival_early and amount=5 when isEarly=true', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, balance: 15, earned: 5 },
      error: null,
    })

    const result = await earnArrival(FAMILY_ID, MEMBER_ID, 'evt-2', true)

    expect(mockRpc).toHaveBeenCalledWith('earn_points', {
      p_family_id: FAMILY_ID,
      p_member_id: MEMBER_ID,
      p_category: 'arrival_early',
      p_amount: 5,
      p_description: '여유 도착',
      p_metadata: { event_id: 'evt-2' },
    })
    expect(result).toEqual({ success: true, balance: 15, earned: 5 })
  })

  it('should pass event_id in metadata', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, balance: 3, earned: 3 },
      error: null,
    })

    await earnArrival(FAMILY_ID, MEMBER_ID, 'evt-99', false)

    const callArgs = mockRpc.mock.calls[0][1]
    expect(callArgs.p_metadata).toEqual({ event_id: 'evt-99' })
  })

  it('should handle daily limit gracefully', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: false },
      error: null,
    })

    const result = await earnArrival(FAMILY_ID, MEMBER_ID, 'evt-1', false)

    expect(result).toEqual({ success: false })
  })

  it('should return { success: false } on RPC error', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'timeout' },
    })

    const result = await earnArrival(FAMILY_ID, MEMBER_ID, 'evt-1', true)

    expect(result).toEqual({ success: false })
  })
})

// ── checkAndEarnStreak ──────────────────────────────────

describe('checkAndEarnStreak', () => {
  it('should call update_streak RPC', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { streak_days: 3 },
      error: null,
    })

    await checkAndEarnStreak(FAMILY_ID, MEMBER_ID)

    expect(mockRpc).toHaveBeenCalledWith('update_streak', {
      p_family_id: FAMILY_ID,
    })
  })

  it('should earn 10 bonus when streak % 7 === 0', async () => {
    // First call: update_streak
    mockRpc.mockResolvedValueOnce({
      data: { streak_days: 14 },
      error: null,
    })
    // Second call: earn_points for bonus
    mockRpc.mockResolvedValueOnce({
      data: { success: true, balance: 30, earned: 10 },
      error: null,
    })

    const result = await checkAndEarnStreak(FAMILY_ID, MEMBER_ID)

    expect(result).toEqual({ streak: 14, bonus: 10 })
    expect(mockRpc).toHaveBeenCalledTimes(2)
    expect(mockRpc).toHaveBeenCalledWith('earn_points', {
      p_family_id: FAMILY_ID,
      p_member_id: MEMBER_ID,
      p_category: 'arrival_streak',
      p_amount: 10,
      p_description: '7일 연속 보너스',
      p_metadata: {},
    })
  })

  it('should earn 100 bonus when streak % 30 === 0', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { streak_days: 30 },
      error: null,
    })
    mockRpc.mockResolvedValueOnce({
      data: { success: true, balance: 200, earned: 100 },
      error: null,
    })

    const result = await checkAndEarnStreak(FAMILY_ID, MEMBER_ID)

    expect(result).toEqual({ streak: 30, bonus: 100 })
    expect(mockRpc).toHaveBeenCalledWith('earn_points', {
      p_family_id: FAMILY_ID,
      p_member_id: MEMBER_ID,
      p_category: 'arrival_streak',
      p_amount: 100,
      p_description: '30일 연속 보너스',
      p_metadata: {},
    })
  })

  it('should give no bonus when streak is not divisible by 7 or 30', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { streak_days: 5 },
      error: null,
    })

    const result = await checkAndEarnStreak(FAMILY_ID, MEMBER_ID)

    expect(result).toEqual({ streak: 5, bonus: 0 })
    // Only update_streak should have been called, no earn_points
    expect(mockRpc).toHaveBeenCalledTimes(1)
  })

  it('should return { success: false } on RPC error', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'streak error' },
    })

    const result = await checkAndEarnStreak(FAMILY_ID, MEMBER_ID)

    expect(result).toEqual({ success: false })
  })

  it('should handle string JSON data from update_streak', async () => {
    mockRpc.mockResolvedValueOnce({
      data: JSON.stringify({ streak_days: 21 }),
      error: null,
    })
    mockRpc.mockResolvedValueOnce({
      data: { success: true, balance: 50, earned: 10 },
      error: null,
    })

    const result = await checkAndEarnStreak(FAMILY_ID, MEMBER_ID)

    expect(result).toEqual({ streak: 21, bonus: 10 })
  })
})

// ── earnEventCreate ─────────────────────────────────────

describe('earnEventCreate', () => {
  it('should call earn_points with category=event_create, amount=1', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, balance: 5, earned: 1 },
      error: null,
    })

    const result = await earnEventCreate(FAMILY_ID, MEMBER_ID)

    expect(mockRpc).toHaveBeenCalledWith('earn_points', {
      p_family_id: FAMILY_ID,
      p_member_id: MEMBER_ID,
      p_category: 'event_create',
      p_amount: 1,
      p_description: '일정 등록',
      p_metadata: {},
    })
    expect(result).toEqual({ success: true, balance: 5, earned: 1 })
  })

  it('should return { success: false } on error', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    })

    const result = await earnEventCreate(FAMILY_ID, MEMBER_ID)

    expect(result).toEqual({ success: false })
  })
})

// ── earnGguk ────────────────────────────────────────────

describe('earnGguk', () => {
  it('should call earn_points with category=gguk, amount=1', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, balance: 6, earned: 1 },
      error: null,
    })

    const result = await earnGguk(FAMILY_ID, MEMBER_ID)

    expect(mockRpc).toHaveBeenCalledWith('earn_points', {
      p_family_id: FAMILY_ID,
      p_member_id: MEMBER_ID,
      p_category: 'gguk',
      p_amount: 1,
      p_description: '꾹!',
      p_metadata: {},
    })
    expect(result).toEqual({ success: true, balance: 6, earned: 1 })
  })

  it('should return { success: false } on error', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    })

    const result = await earnGguk(FAMILY_ID, MEMBER_ID)

    expect(result).toEqual({ success: false })
  })
})

// ── earnMemo ────────────────────────────────────────────

describe('earnMemo', () => {
  it('should call earn_points with category=memo, amount=1', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, balance: 7, earned: 1 },
      error: null,
    })

    const result = await earnMemo(FAMILY_ID, MEMBER_ID)

    expect(mockRpc).toHaveBeenCalledWith('earn_points', {
      p_family_id: FAMILY_ID,
      p_member_id: MEMBER_ID,
      p_category: 'memo',
      p_amount: 1,
      p_description: '메모 작성',
      p_metadata: {},
    })
    expect(result).toEqual({ success: true, balance: 7, earned: 1 })
  })

  it('should return { success: false } on error', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    })

    const result = await earnMemo(FAMILY_ID, MEMBER_ID)

    expect(result).toEqual({ success: false })
  })
})

// ── earnAcademyRegister ─────────────────────────────────

describe('earnAcademyRegister', () => {
  it('should call earn_points with category=academy_register, amount=3', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, balance: 20, earned: 3 },
      error: null,
    })

    const result = await earnAcademyRegister(FAMILY_ID, MEMBER_ID)

    expect(mockRpc).toHaveBeenCalledWith('earn_points', {
      p_family_id: FAMILY_ID,
      p_member_id: MEMBER_ID,
      p_category: 'academy_register',
      p_amount: 3,
      p_description: '학원 등록',
      p_metadata: {},
    })
    expect(result).toEqual({ success: true, balance: 20, earned: 3 })
  })

  it('should return { success: false } on error', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    })

    const result = await earnAcademyRegister(FAMILY_ID, MEMBER_ID)

    expect(result).toEqual({ success: false })
  })
})

// ── getWallet ───────────────────────────────────────────

describe('getWallet', () => {
  it('should return wallet data when exists', async () => {
    const walletData = { balance: 42, total_earned: 100, streak_days: 7 }
    const builder = createQB({ data: walletData, error: null })
    mockFrom.mockReturnValueOnce(builder)

    const result = await getWallet(FAMILY_ID)

    expect(mockFrom).toHaveBeenCalledWith('point_wallets')
    expect(builder.select).toHaveBeenCalledWith('*')
    expect(builder.eq).toHaveBeenCalledWith('family_id', FAMILY_ID)
    expect(result).toEqual(walletData)
  })

  it('should return defaults when wallet not found (PGRST116)', async () => {
    const builder = createQB({
      data: null,
      error: { code: 'PGRST116', message: 'Not found' },
    })
    mockFrom.mockReturnValueOnce(builder)

    const result = await getWallet(FAMILY_ID)

    expect(result).toEqual({ balance: 0, total_earned: 0, streak_days: 0 })
  })

  it('should return defaults on unexpected error', async () => {
    const builder = createQB({
      data: null,
      error: { code: '50000', message: 'Server error' },
    })
    mockFrom.mockReturnValueOnce(builder)

    const result = await getWallet(FAMILY_ID)

    expect(result).toEqual({ balance: 0, total_earned: 0, streak_days: 0 })
  })
})

// ── getTransactions ─────────────────────────────────────

describe('getTransactions', () => {
  it('should pass correct pagination params and return data', async () => {
    const txData = [
      { id: 1, category: 'attendance', amount: 1 },
      { id: 2, category: 'arrival', amount: 3 },
    ]
    const builder = createQB({ data: txData, error: null })
    // Add range method since it's not in the default builder
    builder.range = vi.fn(() => builder)
    mockFrom.mockReturnValueOnce(builder)

    const result = await getTransactions(FAMILY_ID, 10, 5)

    expect(mockFrom).toHaveBeenCalledWith('point_transactions')
    expect(builder.select).toHaveBeenCalledWith('*')
    expect(builder.eq).toHaveBeenCalledWith('family_id', FAMILY_ID)
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(builder.range).toHaveBeenCalledWith(5, 14)
    expect(result).toEqual(txData)
  })

  it('should use default limit=20 and offset=0', async () => {
    const builder = createQB({ data: [], error: null })
    builder.range = vi.fn(() => builder)
    mockFrom.mockReturnValueOnce(builder)

    await getTransactions(FAMILY_ID)

    expect(builder.range).toHaveBeenCalledWith(0, 19)
  })

  it('should return empty array on error', async () => {
    const builder = createQB({
      data: null,
      error: { message: 'fail' },
    })
    builder.range = vi.fn(() => builder)
    mockFrom.mockReturnValueOnce(builder)

    const result = await getTransactions(FAMILY_ID)

    expect(result).toEqual([])
  })
})

// ── getTodayStats ───────────────────────────────────────

describe('getTodayStats', () => {
  it('should return category-grouped stats', async () => {
    const rows = [
      { category: 'attendance', amount: 1 },
      { category: 'arrival', amount: 3 },
      { category: 'attendance', amount: 1 },
      { category: 'gguk', amount: 1 },
    ]
    const builder = createQB({ data: rows, error: null })
    mockFrom.mockReturnValueOnce(builder)

    const result = await getTodayStats(FAMILY_ID)

    expect(mockFrom).toHaveBeenCalledWith('point_transactions')
    expect(result).toEqual({
      attendance: { count: 2, total: 2 },
      arrival: { count: 1, total: 3 },
      gguk: { count: 1, total: 1 },
    })
  })

  it('should handle empty results', async () => {
    const builder = createQB({ data: [], error: null })
    mockFrom.mockReturnValueOnce(builder)

    const result = await getTodayStats(FAMILY_ID)

    expect(result).toEqual({})
  })

  it('should return empty object on error', async () => {
    const builder = createQB({
      data: null,
      error: { message: 'fail' },
    })
    mockFrom.mockReturnValueOnce(builder)

    const result = await getTodayStats(FAMILY_ID)

    expect(result).toEqual({})
  })
})
