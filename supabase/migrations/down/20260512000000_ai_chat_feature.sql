-- Down: supabase/migrations/20260512000000_ai_chat_feature.sql
BEGIN;

DROP TABLE IF EXISTS public.ai_chat_messages;
DROP TABLE IF EXISTS public.ai_chat_usage;
DROP TABLE IF EXISTS public.ai_chat_settings;

COMMIT;
