# Secret Scan Evidence

## Scope

- `dist/` (production build)
- `src/`
- `public/`
- `android/app/src/main/`
- `.env*` files (gitignored verification via `git ls-files`)
- git history (`git log --all --full-history -p -- .env`)

## Findings (masked per agent rules: 6 chars prefix + 4 chars suffix)

### dist/assets/index-DxioK-gY.js — JWT (anon, expected public)
- Pattern: `eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}`
- 1 unique JWT found, masked: `eyJhbG...TiTuw`
- Decoded payload role field: `"role":"anon"` (issuer supabase, expiry 2088)
- Severity: **INFO** — Supabase anon key is public by design

### dist/assets/index-DxioK-gY.js — service_role check
- Pattern: `service_role` literal search → 0 hits in `dist/`
- Pattern: service_role JWT signature substring (taken from `.env` SERVICE_ROLE token signature) → 0 hits in `dist/`
- Severity: **PASS** — no service-role JWT in production bundle

### dist/assets/index-DxioK-gY.js — Kakao keys (hex32)
- Pattern: `[a-f0-9]{32}`
- 2 unique hex-32 strings found:
  - `d99178...439c` — matches `VITE_KAKAO_APP_KEY` in `.env.local`
  - `d50235...9f10` — matches `VITE_KAKAO_REST_KEY` in `.env.local`
- Severity: **P2** — must be domain/package-restricted in Kakao Developers console

### android/app/google-services.json:18 — Firebase API key
- Value masked: `AIzaSy...AF4s`
- Severity: **INFO** — Firebase keys are public by design; verify package + SHA-1 restriction

### .env (gitignored) — SUPABASE_SERVICE_ROLE_KEY
- Value masked: `eyJhbG...VgGa4`
- git ls-files .env → only `.env.example` tracked (no values)
- git log --all --full-history -p -- .env → empty output (no commits ever contained .env)
- Severity: **PASS** (file properly gitignored)

### hyeni-calendar-firebase-adminsdk-fbsvc-da86c8cd8e.json
- Local file present in working tree but matches gitignore pattern `*-firebase-adminsdk-*.json`
- git ls-files | grep -i adminsdk → 0 hits
- Severity: **PASS**

## Commands run

```
git ls-files | grep -iE "\.env"                                                   # → only .env.example
git ls-files | grep -iE "firebase|adminsdk|service|secret|key"                    # → no admin SDK / no service-role files
grep -oE 'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}' dist/... # → 1 anon JWT
grep -oE '[a-f0-9]{32}' dist/...                                                   # → 2 Kakao keys
grep -c '<service_role signature substring>' dist/...                              # → 0
git log --all --full-history -p -- .env                                            # → empty
find dist -name "*.map"                                                            # → none
```

## Per-secret category result

| Secret kind | Where searched | Hits | Severity |
|------------|----------------|------|---------|
| SUPABASE_SERVICE_ROLE_KEY | dist/, src/, public/, android/ | 0 (only in gitignored .env) | PASS |
| FCM private key | dist/, src/, public/, android/ | 0 (only Edge Function env) | PASS |
| OPENAI_API_KEY | dist/, src/, public/, android/ | 0 (only Edge Function env) | PASS |
| RESEND_API_KEY | dist/, src/, public/, android/ | 0 | PASS |
| QONVERSION_API_KEY | dist/, src/, public/, android/ | 0 | PASS |
| NAVER_CLIENT_SECRET | dist/, src/, public/, android/ | 0 | PASS |
| Kakao secret | dist/, src/, public/, android/ | 0 (only REST/APP keys, designed public) | PASS |
| OAuth client_secret (Apple/Google/Facebook) | dist/, src/, public/, android/ | 0 | PASS |
| JWT (eyJ...) | dist/ | 1 anon | INFO/PASS |
| BuildConfig leaks | android/app/src/main/res/values/strings.xml | none beyond app_name | PASS |
| Source maps (*.map) | dist/ | 0 | PASS |
