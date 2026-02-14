-- FIX TRIGGER OVERHEAD
-- The previous trigger ran on EVERY update (including logins), potentially blocking sign-in.
-- This update restricts it to run ONLY when the password actually changes.

CREATE OR REPLACE FUNCTION public.check_password_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only run if the password has CHANGED (and is not null)
  -- This prevents it from running on every login (when last_sign_in_at updates)
  IF (old.encrypted_password IS DISTINCT FROM new.encrypted_password) 
     AND new.encrypted_password IS NOT NULL THEN
     
     PERFORM public.award_bonus_transaction(new.id);
     
  END IF;
  return new;
END;
$$;
