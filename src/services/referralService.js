import { supabase } from "../lib/supabase.js";

/**
 * 내 추천 코드 가져오기/생성
 * @param {string} familyId
 * @returns {Promise<string|null>} "HYENI-XXXX-XXXX" 형식 코드
 */
export async function getMyReferralCode(familyId) {
  try {
    const { data, error } = await supabase.rpc("get_or_create_referral_code", {
      p_family_id: familyId,
    });
    if (error) throw error;
    return data;
  } catch (error) {
    console.warn("[Referral] getMyReferralCode failed:", error);
    return null;
  }
}

/**
 * 추천 코드 적용 (피추천인이 입력)
 * @param {string} refereeFamilyId
 * @param {string} code
 * @returns {Promise<{success: boolean, referrer_family_id?: string, error?: string}>}
 */
export async function applyReferralCode(refereeFamilyId, code) {
  try {
    const { data, error } = await supabase.rpc("apply_referral_code", {
      p_referee_family_id: refereeFamilyId,
      p_code: code,
    });
    if (error) throw error;
    return data;
  } catch (error) {
    console.warn("[Referral] applyReferralCode failed:", error);
    return { success: false, error: error.message };
  }
}

/**
 * 대기중인 추천 보상 확인 + 지급 (앱 실행 시)
 * 3일 retention 체크 후 보상 지급
 * @param {string} familyId
 * @returns {Promise<number|null>} 완료된 추천 수
 */
export async function checkPendingReferrals(familyId) {
  try {
    const threeDaysAgo = new Date(
      Date.now() - 3 * 24 * 60 * 60 * 1000
    ).toISOString();

    // 1. 대기중인 추천 완료 건 조회 (3일 이상 경과)
    const { data: pendingCompletions, error: fetchError } = await supabase
      .from("referral_completions")
      .select("id, referee_family_id")
      .or(
        `referrer_family_id.eq.${familyId},referee_family_id.eq.${familyId}`
      )
      .eq("status", "pending")
      .lt("created_at", threeDaysAgo);

    if (fetchError) throw fetchError;
    if (!pendingCompletions || pendingCompletions.length === 0) return 0;

    let completedCount = 0;

    // 2. 각 건에 대해 피추천인의 최근 3일 혜니 거래 내역 확인 (retention check)
    for (const completion of pendingCompletions) {
      const { count, error: txError } = await supabase
        .from("point_transactions")
        .select("id", { count: "exact", head: true })
        .eq("family_id", completion.referee_family_id)
        .gte("created_at", threeDaysAgo);

      if (txError) {
        console.warn(
          "[Referral] retention check failed for completion",
          completion.id,
          txError
        );
        continue;
      }

      // 3. 거래 내역이 있으면 보상 지급
      if (count > 0) {
        const { error: rewardError } = await supabase.rpc(
          "complete_referral_reward",
          { p_completion_id: completion.id }
        );

        if (rewardError) {
          console.warn(
            "[Referral] complete_referral_reward failed for",
            completion.id,
            rewardError
          );
          continue;
        }
        completedCount += 1;
      }
    }

    return completedCount;
  } catch (error) {
    console.warn("[Referral] checkPendingReferrals failed:", error);
    return null;
  }
}

/**
 * 내 추천 현황
 * @param {string} familyId
 * @returns {Promise<{totalReferrals: number, pendingCount: number, rewardedCount: number, nextMilestone: number, remainingToNext: number}|null>}
 */
export async function getMyReferralStats(familyId) {
  try {
    // 추천 코드의 total_referrals 조회
    const { data: codeData, error: codeError } = await supabase
      .from("referral_codes")
      .select("total_referrals")
      .eq("family_id", familyId)
      .single();

    if (codeError && codeError.code !== "PGRST116") throw codeError;

    const totalReferrals = codeData?.total_referrals ?? 0;

    // 추천 완료 건의 pending/rewarded 카운트
    const { data: completions, error: compError } = await supabase
      .from("referral_completions")
      .select("status")
      .or(
        `referrer_family_id.eq.${familyId},referee_family_id.eq.${familyId}`
      );

    if (compError) throw compError;

    const pendingCount = (completions ?? []).filter(
      (c) => c.status === "pending"
    ).length;
    const rewardedCount = (completions ?? []).filter(
      (c) => c.status === "rewarded"
    ).length;

    // 다음 마일스톤 계산 (5 → 10 → 20)
    const milestones = [5, 10, 20];
    const nextMilestone =
      milestones.find((m) => m > totalReferrals) ??
      milestones[milestones.length - 1];
    const remainingToNext = Math.max(0, nextMilestone - totalReferrals);

    return {
      totalReferrals,
      pendingCount,
      rewardedCount,
      nextMilestone,
      remainingToNext,
    };
  } catch (error) {
    console.warn("[Referral] getMyReferralStats failed:", error);
    return null;
  }
}

/**
 * 추천 링크 공유
 * @param {string} code
 * @returns {Promise<boolean>}
 */
export async function shareReferralLink(code) {
  const text = [
    "우리 아이 일정·도착 관리 앱 혜니캘린더",
    "같이 쓰면 50혜니 받아요!",
    `추천코드: ${code}`,
    "https://play.google.com/store/apps/details?id=com.hyeni.calendar",
  ].join("\n");

  try {
    // Capacitor 네이티브 공유 시도
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (Capacitor.isNativePlatform()) {
        const { registerPlugin } = await import("@capacitor/core");
        const NativeNotification = registerPlugin("NativeNotification");
        await NativeNotification.shareText({
          title: "혜니캘린더 추천",
          text,
          url: "",
        });
        return true;
      }
    } catch {
      /* not native platform */
    }

    // Web Share API 폴백
    if (navigator.share) {
      await navigator.share({ title: "혜니캘린더 추천", text });
      return true;
    }

    // Clipboard 폴백
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.warn("[Referral] shareReferralLink failed:", error);
    return false;
  }
}
