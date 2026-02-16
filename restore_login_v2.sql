
-- EMERGENCY LOGIN FIX
-- The previous trigger was running on EVERY update (including Login), causing the "Database error".
-- This script restricts the trigger to ONLY run when verification/password status actually changes.

-- 1. DROP THE TROUBLESOME TRIGGER FIRST
DROP TRIGGER IF EXISTS on_auth_user_verification ON auth.users;

-- 2. RE-DEFINE THE FUNCTION (With explicit search_path for safety)
CREATE OR REPLACE FUNCTION public.check_user_validation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public -- CRITICAL: Ensure we can find the profiles table and helper functions
AS $$
BEGIN
  -- Double check conditions inside (redundant but safe)
  BEGIN
      IF (new.phone_confirmed_at IS NOT NULL OR new.email_confirmed_at IS NOT NULL) 
         AND (new.encrypted_password IS NOT NULL) THEN
          
          -- Only award if not already claimed (idempotent helper handles this)
          PERFORM public.award_bonus_transaction(new.id);
      END IF;
  EXCEPTION WHEN OTHERS THEN
      -- Swallowing errors here ensures LOGIN NEVER FAILS even if bonus logic crashes
      RAISE WARNING 'Bonus trigger error: %', SQLERRM;
  END;
  
  RETURN new;
END;
$$;

-- 3. RE-CREATE TRIGGER WITH "WHEN" CLAUSE (The Real Fix)
-- This ensures the function is NOT EVEN CALLED during a normal Login (which updates last_sign_in_at only).
CREATE TRIGGER on_auth_user_verification
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (
    -- Only fire if specific validation fields turn from NULL to NOT NULL
    (OLD.phone_confirmed_at IS NULL AND NEW.phone_confirmed_at IS NOT NULL) OR
    (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL) OR
    (OLD.encrypted_password IS NULL AND NEW.encrypted_password IS NOT NULL)
  )
  EXECUTE FUNCTION public.check_user_validation();
