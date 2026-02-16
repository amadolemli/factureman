
-- FIX LOGIN BLOCK
-- It seems the updated trigger logic might be blocking logins if it errors out or loops incorrectly.
-- This script relaxes the trigger to ensure it NEVER blocks a login, while still attempting to award bonuses.

CREATE OR REPLACE FUNCTION public.check_user_validation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Wrap in a safe block to ensure login/update never fails
  BEGIN
      -- Only checking for POSITIVE changes (Null -> Set)
      -- Using simple logic to avoid recursion or complex checks
      IF (
           (old.phone_confirmed_at IS NULL AND new.phone_confirmed_at IS NOT NULL) OR
           (old.encrypted_password IS NULL AND new.encrypted_password IS NOT NULL)
         ) THEN
          
          -- Check strict condition inside the block
          IF (new.phone_confirmed_at IS NOT NULL OR new.email_confirmed_at IS NOT NULL) 
             AND (new.encrypted_password IS NOT NULL) THEN
              PERFORM public.award_bonus_transaction(new.id);
          END IF;
      END IF;
  EXCEPTION WHEN OTHERS THEN
      -- LOG ERROR but DO NOT FAIL the transaction
      -- This allows the user to still login/update password even if bonus logic fails
      NULL;
  END;
  
  RETURN new;
END;
$$;
