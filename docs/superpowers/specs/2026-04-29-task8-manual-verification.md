# Task 8 — Co-Parent SMS Auth: Manual Verification Punch List

Date created: 2026-04-29
Plan source: `docs/superpowers/plans/2026-04-29-co-parent-sms-auth.md` (Task 8, lines 1634–1762)

User instruction governing parallel work (verbatim):
> 병렬로 진행합니다. task 7 에서는 회원가입시 다음의 정보를 필수로 받습니다. 이름 성별(엄마/아빠) 생년월일 전화번호(인증)

## Status of automated portions

| Item | Status | Evidence |
|------|--------|----------|
| Real-services Playwright `coparent-permissions-real.spec.js` | PASS (1/1, 7.6s) | `tmp/task8-coparent-real.log` |
| Live family RLS migration integrity probe | PASS | family_members=2, events=94, `is_primary_parent` returned `false` under service-role (expected — see caveat) |
| ADB device discovery | 1 of 2 attached | `adb devices -l` → `R5CY521CFNZ` (Galaxy S25, SM_S937N) only |
| Hyeni app launch + WebView socket | PASS | PID 24585, `webview_devtools_remote_24585` present, `topResumedActivity = com.hyeni.calendar/.MainActivity` |
| Hyeni JS console errors after launch | NONE observed | filtered logcat: no `chromium.*console.*ERROR` lines |
| Connected-device login automation via CDP | BLOCKED | DevTools HTTP `/json` endpoint accepts TCP but never returns a body on this OEM WebView build; `screencap` after launch returned a black frame because the device was on the Samsung Bouncer (lock screen). MainActivity was nonetheless the resumed activity behind it. |

### Service-role caveat for `is_primary_parent`

The Supabase MCP runs every `execute_sql` call with the **service role**, not as a Postgres role bound to a Supabase auth `user.id`. The function `public.is_primary_parent(p_family_id uuid)` resolves the caller via `auth.uid()`; under service role `auth.uid()` is `NULL`, so the function correctly returns `false` for the live family even though that family has a primary parent.

**What was actually verified:** the function exists, is callable, returns a boolean without exception, and the live family's row counts are intact (family_members=2, events=94, both ≥ 1) — i.e. RLS migration `20260429000017` did not drop or corrupt rows. End-to-end primary-parent identity must be re-checked with a real signed-in JWT (manual step below).

## Manual verification — requires second device + a real human phone number

The plan states (verbatim) the items below. None of these can be executed by an agent:

- **Device requirement:** Galaxy 25 (parent mode) AND Quantum (child mode). Currently only the Galaxy 25 is attached. The Quantum device must be plugged in and authorized via `adb` before this checklist begins.
- **APK requirement:** Task 7 ships the SMS-OTP UI changes (이름 / 성별 (엄마/아빠) / 생년월일 / 전화번호 인증 fields per the user instruction quoted at the top of this file). The Task 7 agent owns the APK rebuild and install. Do not attempt the items below until the Task-7 APK is installed on both devices.
- **Phone-number requirement:** The SMS OTP path requires a real, NCP-SENS-deliverable Korean mobile number. The synthetic test number `+821000000002` will NOT receive an SMS — it was used only for the legacy email-based test account `testacct02 / test1234` (created earlier in this session via the email signup helper, not via OTP).

### Checks (verbatim from plan lines 1721–1745, plus the OTP-specific add-on)

- [ ] Galaxy 25 signs in as primary parent.
- [ ] Quantum signs in as child and stays paired.
- [ ] A second parent account joins with `KID-********`.
- [ ] Co-parent sees schedule.
- [ ] Co-parent cannot add, edit, or delete schedule.
- [ ] Co-parent can send memo.
- [ ] Co-parent can send praise sticker.
- [ ] Child `꾹` does not appear as SOS on co-parent.
- [ ] Child SOS arrives on both primary parent and co-parent.
- [ ] Co-parent cannot trigger remote listen.
- [ ] Co-parent cannot trigger location refresh.
- [ ] Co-parent cannot use force-ring.
- [ ] SMS OTP login succeeds and lands on parent family setup or existing family screen.

### Additional human-only sub-steps surfaced during this run

- [ ] Unlock the Galaxy S25 (PIN/biometric) so the WebView surface is actually visible — every `adb screencap` taken during automated runs returns a black frame while the Bouncer is up.
- [ ] After Task 7 APK is installed, exercise the SMS OTP signup form and confirm the four required fields are mandatory: **이름**, **성별 (엄마/아빠)**, **생년월일**, **전화번호 (인증)**.
- [ ] Verify NCP SENS dashboard shows successful SMS dispatch for the test phone number used.
- [ ] After OTP signup, re-run the live-family integrity probe with the freshly signed-in JWT and confirm `is_primary_parent('4c781fb7-677a-45d9-8fd2-74d0083fe9b4'::uuid)` returns `true` for the primary-parent device and `false` for the co-parent device.
- [ ] Confirm Supabase Dashboard → Authentication → Providers → Phone is enabled and the Send SMS Hook is wired to the `send-sms` Edge Function (per plan line 1762 deployment note).

## Steps deliberately deferred to other agents

- Task 7 owns the APK rebuild (`npm run build && npx cap sync android && ./gradlew assembleDebug && adb install -r ...`). Do not run these from Task 8.
- Migration application and edge-function deployment are out-of-scope per Task 8 hard constraints.

## Artifacts produced by Task 8

- `tmp/task8-coparent-real.log` — Playwright real-services run output
- `tmp/task8-logcat.txt` — filtered logcat after app launch (no JS errors)
- `tmp/shots/task8/01-app-current-state.png` — initial screencap (black, device locked)
- `tmp/shots/task8/02-device-bouncer.png` — second screencap, same locked state
- `docs/superpowers/specs/2026-04-29-task8-manual-verification.md` — this file
