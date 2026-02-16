-- DEEP CLEAN & DIAGNOSE
-- 1. List any users with this phone number to see if they are stuck
SELECT id, phone, created_at FROM auth.users WHERE phone LIKE '%91117708%';

-- 2. Force Drop ANY triggers that might be related (Hardcoded names to be safe)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_v2 ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_password_set ON auth.users;

-- 3. Verify Constraints on Profiles table (This often hides the "Database Error")
-- If there is a 'NOT NULL' column that we are forgetting to set, this will fail.
SELECT 
    conname as constraint_name, 
    pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'public.profiles'::regclass;

-- 4. Insert a DUMMY/TEST trigger that does ABSOLUTELY NOTHING (to verify connectivity)
CREATE OR REPLACE FUNCTION public.handle_new_user_safety_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log that we ran (if debug_logs exists)
  BEGIN
    INSERT INTO public.debug_logs (process_name, message) VALUES ('safety_check', 'Trigger ran successfully');
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignore logging errors
  END;
  
  -- SIMPLY RETURN NEW. Do NOT insert into profiles yet.
  -- Determining if the crash is the Trigger ITSELF or the PROFILE INSERT.
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_safety_check();
