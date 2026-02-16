-- DIAGNOSTIC TOOL: Inspect Schema and Triggers
-- This will help us identify if there are hidden constraints or other triggers causing the crash.

-- 1. List all triggers on auth.users
SELECT 
    event_object_schema as schema,
    event_object_table as table,
    trigger_name,
    action_timing,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users' 
  AND event_object_schema = 'auth';

-- 2. List columns and constraints of the profiles table
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns
WHERE table_name = 'profiles' AND table_schema = 'public';
