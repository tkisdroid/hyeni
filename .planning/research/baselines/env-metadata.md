# Environment Metadata Baseline — 2026-04-21

Captured: Phase 1 — Migration Hygiene & Baseline (per CONTEXT.md D-09).
Scope: **PUBLIC metadata only.** Secrets are deliberately excluded.

**Purpose:** Phase 2 Stream A will redeploy the `push-notify` Edge Function.
If the redeploy breaks FCM / Web Push delivery, rollback requires bit-exact
restoration of the VAPID keypair. This document captures the PUBLIC half
so operators can verify continuity; the PRIVATE half remains in the
production secret store and is NEVER written here.

## Supabase

- **Project ref:** `qzrrscryacxhprnrtpjd` `[PUBLIC — visible in dashboard URL & every API request]`
- **Project URL:** `https://qzrrscryacxhprnrtpjd.supabase.co` `[PUBLIC — bundled in client JS, already appears in supabase/PUSH-SETUP.md line 60]`
- **Organization:** `bgfvgzvsgsvbgauymxlv` `[PUBLIC — visible in dashboard URL]`
- **Anon key (legacy JWT, role=anon):** `[PUBLIC — bundled in every client index.html build]`
  - Prefix: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6cnJzY3J5YWN4aHBybnJ0cGpkIiwicm9sZSI6ImFub24i…`
  - Payload (decoded, public): `{"iss":"supabase","ref":"qzrrscryacxhprnrtpjd","role":"anon","iat":1773233943,"exp":2088809943}`
  - Full value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6cnJzY3J5YWN4aHBybnJ0cGpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMzM5NDMsImV4cCI6MjA4ODgwOTk0M30.TuNq7b8FIx7XZoi4LOCYe5nhVAl6pgOHEYPtVtTiTuw`
- **Publishable key (new-format, role=anon-equivalent):** `sb_publishable_e3ENuEEgfnCzBW3GWmInfA_4yeb3lm1` `[PUBLIC — post-2025 replacement for the legacy anon JWT; still client-bundled by design]`
- **Service-role key (legacy JWT + new sb_secret_*):** `[DO NOT COMMIT — lives in Edge Function secrets & Vercel env only]`

## FCM (Firebase Cloud Messaging)

- **Project ID:** `hyeni-calendar` `[PUBLIC — visible in android/app/google-services.json line 3]`
- **Project number (Sender ID):** `304298309837` `[PUBLIC — same file]`
- **Server key (legacy):** `[DO NOT COMMIT — sunset 2024; HTTP v1 API is mandatory since June 2024]`
- **Service-account JSON (HTTP v1 API auth):** `[DO NOT COMMIT — lives in Supabase Edge Function secrets as FCM_SERVICE_ACCOUNT_JSON]`

## VAPID (Web Push — RFC 8292)

- **Public key (P-256, base64url):** `BAGsx-_DBlJdXJflHv2j8kGsZVSxXYVKiUfE78PpA1I0XtbyLNi2aADFJnVfyWmtCkjW-kRkdHcWtKqQmMNWMus` `[PUBLIC — RFC 8292 §3.2; sent with every browser push-subscription]`
- **Subject (mailto):** `mailto:hyeni-calendar@noreply.com` `[PUBLIC — appears in every VAPID JWT aud/sub header]`
- **Private key (P-256 d component):** `[DO NOT COMMIT — lives in Supabase Edge Function secrets as VAPID_PRIVATE_KEY]`

**Critical constraint:** Per SUMMARY.md Stack Decisions and CLAUDE.md
Instruction Hygiene (“Do NOT rotate VAPID keys during Phase 2 Stream A
redeploy”), **do NOT rotate the VAPID keypair** during Phase 2 Stream A.
Rotation would 403 every existing `push_subscriptions` row (RFC 8292
§2.3 — the browser-registered `applicationServerKey` must remain stable).
The public key above is the SAME value that downstream devices already
trust; it MUST survive Phase 2 Stream A unchanged.

## Kakao (OAuth)

- **REST App key (VITE_KAKAO_REST_KEY):** `[PUBLIC — visible in Kakao Developers console & bundled in client JS]` — not captured here since it's not a rollback anchor for Phase 2 Stream A; refer to the production `.env` if needed.
- **Client secret (used server-side by Supabase Auth):** `[DO NOT COMMIT — lives in Supabase Dashboard → Auth → Providers → Kakao]`

## Qonversion (IAP)

- **Project key (client-facing):** `[PUBLIC — bundled in client JS via VITE_QONVERSION_PROJECT_KEY; see .env.example]` — not captured here (not a Phase 2 Stream A rollback anchor).
- **API key (server-side webhook verification):** `[DO NOT COMMIT — lives in Supabase Edge Function secrets as QONVERSION_API_KEY]`

## Snapshot provenance

- Captured by: gsd-executor (plan 01-04)
- Captured at: 2026-04-21T06:30Z
- Source of truth for Supabase anon key: Supabase Management API (`supabase projects api-keys --project-ref qzrrscryacxhprnrtpjd`)
- Source of truth for VAPID public key: `supabase/PUSH-SETUP.md` line 27 (committed doc) + `supabase/functions/push-notify/index.ts` line 14 (`Deno.env.get("VAPID_PUBLIC_KEY")`)
- Source of truth for VAPID subject: `supabase/functions/push-notify/index.ts` line 52
- Source of truth for FCM project_id: `android/app/google-services.json` (committed `"project_id": "hyeni-calendar"`)
- Git HEAD at capture: `069e376` (pg_policies snapshot commit; this file is captured immediately after)

## What this document does NOT contain (by policy — D-09 exclusion list)

- [DO NOT COMMIT] VAPID private key (only the public half is recorded)
- [DO NOT COMMIT] FCM service-account JSON
- [DO NOT COMMIT] Supabase service-role key (legacy JWT or `sb_secret_*`)
- [DO NOT COMMIT] Kakao client secret, Qonversion API key, or any OAuth / IAP server-side secret
- [DO NOT COMMIT] `PROD_READ_ONLY_DATABASE_URL` or any Postgres connection string with embedded credentials
- [DO NOT COMMIT] Production family IDs, user IDs, or any PII

If Phase 2 Stream A ever rotates any of the above, this file MUST be
updated with the new PUBLIC values AND re-tagged
(`push-notify-baseline-YYYYMMDD`) — old file preserved, new file added
alongside.
