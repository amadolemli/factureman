-- EMERGENCY: DISABLE ALL TRIGGERS ON auth.users
-- This will stop the "Status 500" error by removing the automated logic completely.
-- After running this, try to sign up. If it works, we know the trigger was the problem.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- CHECK FOR OTHER TRIGGERS
-- If there are other triggers on auth.users, they might be the cause.
SELECT trigger_name 
FROM information_schema.triggers 
WHERE event_object_schema = 'auth' 
  AND event_object_table = 'users';

-- CHECK PROFILES SCHEMA (To find hidden NOT NULL columns)
SELECT column_name, is_nullable, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND table_schema = 'public';
