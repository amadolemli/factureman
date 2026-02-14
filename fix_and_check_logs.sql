-- FIX AND CHECK LOGS
-- It seems the debug_logs table existed from an old version without the 'created_at' column.
-- This script fixes the table schema and then shows the logs.

-- 1. Fix Schema: Add columns if they are missing
ALTER TABLE public.debug_logs ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.debug_logs ADD COLUMN IF NOT EXISTS details jsonb;
ALTER TABLE public.debug_logs ADD COLUMN IF NOT EXISTS process_name text;
ALTER TABLE public.debug_logs ADD COLUMN IF NOT EXISTS message text;

-- 2. Show the logs
SELECT * FROM public.debug_logs ORDER BY created_at DESC LIMIT 50;
