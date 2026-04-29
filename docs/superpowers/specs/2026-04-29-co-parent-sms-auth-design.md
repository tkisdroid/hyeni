# Co-Parent and SMS Auth Design

## Goal

Add one limited co-parent account per subscribed family and add parent phone OTP login alongside Kakao login, without weakening the existing parent-child safety controls.

## Scope

This design covers:

- A second parent joining an existing family with the existing `KID-********` pair code.
- Enforcing one co-parent per family, excluding the subscribing primary parent.
- Restricting the co-parent to schedule read-only, praise stickers, and memo sending.
- Sending emergency push notifications to both parent accounts only for SOS.
- Keeping `kkuk` as a love/attention signal, not an emergency signal.
- Adding phone number login as a parent authentication option parallel to Kakao login.
- Running verification on connected Android devices after implementation, with Galaxy 25 as parent mode and Quantum as child mode.

Out of scope:

- Changing subscription pricing.
- Replacing Kakao login.
- Adding multiple co-parents.
- Allowing co-parent control features such as schedule creation, child unpairing, remote listen, location refresh, or subscription management.

## Current Code Findings

The app already has a partial co-parent path:

- `src/lib/auth.js` exports `joinFamilyAsParent()`.
- `src/App.jsx` has `ParentSetupScreen` with an "existing family join" path.
- `supabase/migrations/20260424000000_join_family_as_parent_rpc.sql` defines `join_family_as_parent()`.

The risk is that the current join RPC writes the second parent as `family_members.role = 'parent'`. Many client and RLS checks currently treat any `role='parent'` member as a full parent, so a co-parent could inherit more authority than intended.

The app currently distinguishes broad parent and child mode through `familyInfo.myRole` and `myRole`. It does not yet expose a separate "primary parent" or "co-parent" capability model.

## Recommended Architecture

Keep the existing `family_members.role = 'parent'` shape for compatibility, but derive authority from two facts:

- Primary parent: `families.parent_id = auth.uid()`.
- Co-parent: a `family_members` row with `role='parent'`, where `user_id != families.parent_id`.

This avoids a schema-wide role enum change and keeps existing family membership reads stable. The code should introduce a small explicit capability model so UI, Edge Functions, and RLS use the same intent:

- `isPrimaryParent`: current user owns `families.parent_id`.
- `isCoParent`: current user is a parent member but not primary.
- `canManageFamily`: primary parent only.
- `canWriteSchedule`: primary parent only.
- `canSendMemo`: primary parent, co-parent, child.
- `canGivePraiseSticker`: primary parent and co-parent.
- `canReceiveSos`: primary parent and co-parent.
- `canReceiveKkuk`: primary parent only, unless the sender is targeting their own account through an existing non-emergency local UI path.

## Data Model

No new role value is required.

Add one DB-side helper:

```sql
public.is_primary_parent(p_family_id uuid)
```

It returns true when `public.families.id = p_family_id` and `families.parent_id = auth.uid()`.

Update or add one DB-side helper:

```sql
public.is_family_parent(p_family_id uuid)
```

It continues to return true for any parent member, but it must not be used for primary-only operations.

Update `join_family_as_parent()`:

- Require authenticated caller.
- Require `p_user_id = auth.uid()`.
- Keep pair-code TTL and rate-limit behavior.
- Reject joining the user's own family as a duplicate primary parent.
- Reject when a different co-parent already exists for the family.
- Insert or update only the caller's membership row as `role='parent'`.
- Return the family id.

The one-co-parent invariant will be enforced inside the SECURITY DEFINER `join_family_as_parent()` RPC. This is the recommended implementation for this project because it is tightly scoped, avoids schema churn, and keeps the existing `role='parent'` membership shape stable.

## RLS and Server Authorization

Primary-only write operations must stop using broad family membership checks.

Primary parent only:

- `events` insert/update/delete.
- `events_children` insert/update/delete.
- `academies` insert/update/delete.
- `saved_places` insert/update/delete except existing child/playdate-specific exceptions.
- `danger_zones` insert/update/delete.
- `family_members` delete/unpair.
- `family_subscription` mutation or subscription management flows.
- `force_ring`, remote listen, remote listen stop, request location, request device status.
- Parent phone settings.

Co-parent allowed:

- `events` select.
- `events_children` select.
- `family_members` select.
- `family_subscription` select for current family entitlement display only.
- `memo_replies` insert/select.
- `add_sticker()` for praise stickers only.
- `get_stickers_for_date()` and `get_sticker_summary()`.
- Push token registration for their own device.

The Edge Function `supabase/functions/push-notify/index.ts` must explicitly reject co-parent callers for control actions, even if RLS would block later. This gives deterministic API responses and avoids sending command rows to the child device.

## Notification Semantics

`kkuk` and `sos` must be distinct.

- `kkuk`: love/attention signal. Not emergency. Co-parent does not receive this as an emergency notification.
- `sos`: emergency signal. Primary parent and co-parent receive it.
- `emergency`: existing emergency action remains emergency, but co-parent receipt should only be enabled if it represents SOS semantics. Control actions like `force_ring` are primary-parent-only actions and should not be available to co-parent.

Implementation rule:

- `isEmergencyNotification()` should not classify `kkuk` as emergency.
- Recipient selection for `sos` should load all parent-role members in the family.
- Recipient selection for ordinary parent alerts should target the primary parent only unless a specific existing flow proves it is SOS.

## Client UX

Parent login screen:

- Keep Kakao login.
- Add phone OTP login as a second parent login option.
- After phone verification succeeds, call the same family discovery flow as Kakao.
- If no family exists, show the existing parent setup screen with "new family" and "existing family join".

Co-parent UI:

- Show the parent surface, but hide or disable full-control buttons:
  - Add/edit/delete schedule.
  - Academy/saved-place management.
  - Remote listen.
  - Location refresh.
  - Force-ring/emergency control.
  - Child unpair and pair-code regeneration.
  - Subscription management.
  - Parent phone settings.
- Keep available:
  - Calendar read view.
  - Memo page and memo quick replies.
  - Praise sticker sending.
  - Sticker book viewing.

If a hidden control has a visible legacy entry point, guard the handler as well as the button. UI hiding alone is not sufficient.

## SMS Auth Design

Use Supabase Phone OTP as the auth/session mechanism and NCP SENS as the SMS delivery provider.

Reason:

- Supabase Phone OTP creates normal Supabase Auth sessions, so existing RLS and `auth.uid()` continue to work.
- Supabase Send SMS Auth Hook is designed to replace the built-in SMS sender with a custom regional provider.
- NCP SENS SMS v2 is an HTTPS API that requires Access Key, timestamp, and HMAC-SHA256 signature headers.

Required environment variables:

- `NCP_SENS_ACCESS_KEY`
- `NCP_SENS_SECRET_KEY`
- `NCP_SENS_SERVICE_ID`
- `NCP_SENS_FROM_NUMBER`

Supabase configuration:

- Enable Phone provider.
- Configure Send SMS Auth Hook to call a project-owned function that sends through NCP SENS.
- Keep OTP length and expiry aligned with the existing `supabase/config.toml` settings unless production dashboard config differs.

NCP request design:

- Method: `POST`
- Path: `/sms/v2/services/{serviceId}/messages`
- Host: `https://sens.apigw.ntruss.com`
- Body:

```json
{
  "type": "SMS",
  "contentType": "COMM",
  "countryCode": "82",
  "from": "registered-sender-number",
  "content": "[혜니캘린더] 인증번호는 123456 입니다.",
  "messages": [
    {
      "to": "01012345678"
    }
  ]
}
```

Signature message:

```text
POST /sms/v2/services/{serviceId}/messages
{timestamp}
{accessKey}
```

The implementation must normalize Korean phone numbers safely:

- Accept `01012345678`, `010-1234-5678`, and `+821012345678`.
- Send `countryCode: "82"`.
- Send `to` without `+82`; for Korean mobile numbers use the local leading-zero format if SENS account settings require it.
- Reject empty, too-short, or non-mobile-looking values before calling Supabase OTP.

## Testing Strategy

Unit tests:

- Co-parent capability derivation.
- `kkuk` is not emergency, `sos` is emergency.
- Co-parent cannot write schedules in client guard helpers.
- Phone number normalization.

Database/RLS tests:

- Primary parent can write events.
- Co-parent can read events.
- Co-parent cannot insert/update/delete events.
- Co-parent can insert memo replies.
- Co-parent can add praise sticker.
- Second co-parent join is rejected.
- Primary parent self-join as co-parent is rejected.

Edge Function tests:

- `sos` targets both parent accounts.
- `kkuk` does not target co-parent.
- Co-parent calling `request_location`, `remote_listen`, or `force_ring` receives 403.

E2E tests:

- Parent creates family, child joins, co-parent joins with `KID-********`.
- Co-parent sees schedule but cannot register a schedule.
- Co-parent sends memo and praise sticker.
- Child SOS reaches both parent devices.
- Child kkuk does not reach co-parent as an emergency notification.
- SMS OTP login lands on the parent setup/family screen.

Connected-device verification:

- Galaxy 25: parent mode.
- Quantum: child mode.
- ADB must list both devices before running device E2E.
- Current blocker: `adb devices -l` failed because ADB daemon could not start. Resolve ADB daemon/port 5037 before claiming device E2E completion.

## Source References

- Supabase Send SMS Hook: https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook
- NCP SENS overview: https://guide.ncloud-docs.com/docs/sens-overview
- NCP SENS SMS v2 API: https://api.ncloud-docs.com/docs/ko/ai-application-service-sens-smsv2
- Ncloud API signature guide: https://api.ncloud-docs.com/release-20260122/docs/en/common-ncpapi

## Self-Review

- No placeholder requirements remain.
- `kkuk` and `sos` semantics are explicitly separate.
- Co-parent restrictions are enforced in UI, RLS/RPC, and Edge Function layers.
- SMS auth uses Supabase sessions rather than a parallel custom auth table.
- The actual connected-device E2E dependency is explicit and currently blocked by ADB daemon startup.
