# 서버사이드 Web Push 설정 가이드

## 1단계: Supabase 테이블 생성

Supabase Dashboard > SQL Editor에서 `supabase/push-tables.sql` 실행:

```sql
-- push_subscriptions + push_sent + fcm_tokens + pending_notifications + RPC 생성
```

## 2단계: Edge Function 배포

### Supabase CLI 설치 (아직 없는 경우)
```bash
npm install -g supabase
supabase login
```

### 프로젝트 연결
```bash
cd kids-app
supabase link --project-ref qzrrscryacxhprnrtpjd
```

### VAPID 키 설정 (Secrets)
```bash
supabase secrets set VAPID_PUBLIC_KEY=BAGsx-_DBlJdXJflHv2j8kGsZVSxXYVKiUfE78PpA1I0XtbyLNi2aADFJnVfyWmtCkjW-kRkdHcWtKqQmMNWMus
supabase secrets set VAPID_PRIVATE_KEY=h9Xu8W6S7Hz_K4RQWn9-3cFFwuTzNhVNCr_sTec-Io4
```

### FCM 서비스 계정 설정 (필수)

`android/app/hyeni-calendar-firebase-adminsdk-*.json` 파일의 값을 Supabase Edge Function secret 으로 등록해야 합니다.

가장 쉬운 방법은 JSON 전체를 1개 secret 으로 넣는 것입니다.

```bash
supabase secrets set FCM_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"..."}'
```

또는 개별 값으로 설정할 수도 있습니다.

```bash
supabase secrets set FCM_PROJECT_ID=your-project-id
supabase secrets set FCM_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
supabase secrets set FCM_PRIVATE_KEY_B64=BASE64_ENCODED_PRIVATE_KEY
```

### 배포
```bash
supabase functions deploy push-notify --no-verify-jwt
```

## 3단계: 크론 설정 (매분 Edge Function 호출)

### 방법 A: 무료 외부 크론 (cron-job.org)

1. https://cron-job.org 가입
2. 새 크론잡 생성:
   - **URL**: `https://qzrrscryacxhprnrtpjd.supabase.co/functions/v1/push-notify`
   - **Method**: POST
   - **Schedule**: 매 1분
   - **Headers**: (불필요 - --no-verify-jwt로 배포했으므로)
3. 저장 후 활성화

### 방법 B: Supabase pg_cron (Pro 플랜)

SQL Editor에서:
```sql
SELECT cron.schedule(
  'push-notify-cron',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://qzrrscryacxhprnrtpjd.supabase.co/functions/v1/push-notify',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

## 동작 확인

Edge Function URL을 직접 호출해서 테스트:
```bash
curl -X POST https://qzrrscryacxhprnrtpjd.supabase.co/functions/v1/push-notify
```

응답 예시:
```json
{"sent": 2, "checked": 5, "dateKey": "2026-2-13", "time": "15:30"}
```

## 꼭 확인할 포인트

1. `fcm_tokens` 테이블에 아이 기기의 토큰이 실제로 저장되는지 확인
2. `pending_notifications` 테이블에 즉시 알림이 적재되는지 확인
3. Edge Function 로그에 `Failed to load fcm_tokens` / `FCM auth error` 가 없는지 확인
4. Android 앱에서 알림 권한, 배터리 최적화 예외, 전체화면 알림 권한이 허용되어 있는지 확인

## 아키텍처

```
[크론 (1분마다)] → [Edge Function: push-notify]
                         ↓
                   [events 테이블에서 오늘 일정 조회]
                         ↓
                   [10분 전 or 시작 시각 해당 일정 필터]
                         ↓
                   [push_subscriptions에서 가족 구독 조회]
                         ↓
                   [Web Push 프로토콜로 브라우저에 전송]
                         ↓
                   [push_sent에 전송 기록 (중복 방지)]
```

브라우저가 닫혀 있어도 OS 알림이 표시됩니다 (Android Chrome, Windows Chrome/Edge).
iOS Safari는 PWA로 홈화면에 추가한 경우에만 지원 (iOS 16.4+).
