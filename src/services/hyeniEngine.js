import {
  earnAttendance, earnArrival, checkAndEarnStreak,
  earnEventCreate, earnGguk, earnMemo, earnAcademyRegister,
  getWallet,
} from "./hyeniService.js";
import { checkPendingReferrals } from "./referralService.js";

const AMOUNTS = {
  attendance: 1,
  arrival: 3,
  arrival_early: 5,
  event_create: 1,
  gguk: 1,
  memo: 1,
  academy_register: 3,
};

export class HyeniEngine {
  constructor(familyId, memberId) {
    this.familyId = familyId;
    this.memberId = memberId;
  }

  async reward(action, context = {}) {
    try {
      switch (action) {
        case "attendance":
          return await this._earnSimple(earnAttendance, "attendance");

        case "arrival": {
          const { eventId, isEarly = false } = context;
          const arrResult = await earnArrival(this.familyId, this.memberId, eventId, isEarly);
          if (!arrResult?.success) return { earned: 0, category: isEarly ? "arrival_early" : "arrival", toast: false };
          const earned = isEarly ? AMOUNTS.arrival_early : AMOUNTS.arrival;
          const category = isEarly ? "arrival_early" : "arrival";

          let streakBonus = 0;
          let streak = 0;
          try {
            const streakResult = await checkAndEarnStreak(this.familyId, this.memberId);
            streakBonus = streakResult?.bonus || 0;
            streak = streakResult?.streak || 0;
          } catch { /* streak failure is non-critical */ }

          return { earned, category, toast: true, streakBonus, streak };
        }

        case "event_create":
          return await this._earnSimple(earnEventCreate, "event_create");

        case "gguk":
          return await this._earnSimple(earnGguk, "gguk");

        case "memo":
          return await this._earnSimple(earnMemo, "memo");

        case "academy_register":
          return await this._earnSimple(earnAcademyRegister, "academy_register");

        default:
          return { earned: 0, category: action, toast: false };
      }
    } catch (e) {
      console.warn("[HyeniEngine] reward failed:", action, e);
      return { earned: 0, category: action, toast: false, error: e.message || "unknown" };
    }
  }

  async initSession() {
    let attendanceEarned = false;
    let balance = 0;
    let streak = 0;

    try {
      const result = await earnAttendance(this.familyId, this.memberId);
      attendanceEarned = !!result?.success;
    } catch { /* non-critical */ }

    try {
      await checkPendingReferrals(this.familyId);
    } catch { /* non-critical */ }

    try {
      const w = await getWallet(this.familyId);
      balance = w?.balance || 0;
      streak = w?.streak_days || 0;
    } catch { /* non-critical */ }

    return { attendanceEarned, balance, streak };
  }

  async _earnSimple(earnFn, category) {
    const result = await earnFn(this.familyId, this.memberId);
    if (!result?.success) return { earned: 0, category, toast: false };
    return { earned: AMOUNTS[category] || 0, category, toast: true };
  }
}
