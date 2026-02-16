-- FIX TYPE MISMATCH IN REFERRAL BONUS
-- This fixes the "operator does not exist: text = uuid" error

-- Drop and recreate the password update trigger with proper type handling
DROP TRIGGER IF EXISTS on_auth_user_password_set ON auth.users;
DROP FUNCTION IF EXISTS public.check_password_update() CASCADE;

-- Create the fixed password update function
CREATE OR REPLACE FUNCTION public.check_password_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_referrer_id uuid;
  already_claimed boolean;
BEGIN
  -- Log password update attempt
  BEGIN
    INSERT INTO public.debug_logs (process_name, message, details)
    VALUES ('check_password_update', 'PASSWORD_UPDATE_ATTEMPT', jsonb_build_object('user_id', new.id));
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Only proceed if password is being set (not just updated)
  IF (old.encrypted_password IS DISTINCT FROM new.encrypted_password) 
     AND new.encrypted_password IS NOT NULL THEN
    
    BEGIN
      -- Get user's referral info with explicit type casting to prevent type mismatch
      SELECT 
        CASE 
          WHEN referred_by IS NOT NULL THEN referred_by::uuid 
          ELSE NULL 
        END,
        COALESCE(bonuses_claimed, false)
      INTO user_referrer_id, already_claimed 
      FROM public.profiles 
      WHERE id = new.id;

      BEGIN
        INSERT INTO public.debug_logs (process_name, message, details)
        VALUES ('check_password_update', 'USER_INFO', jsonb_build_object(
          'user_id', new.id,
          'referrer', user_referrer_id, 
          'claimed', already_claimed
        ));
      EXCEPTION WHEN OTHERS THEN NULL; END;

      -- Award bonuses if not already claimed
      IF NOT already_claimed THEN
        BEGIN
          -- Give new user their 500 credits
          UPDATE public.profiles 
          SET app_credits = COALESCE(app_credits, 0) + 500,
              bonuses_claimed = true
          WHERE id = new.id;

          BEGIN
            INSERT INTO public.debug_logs (process_name, message, details)
            VALUES ('check_password_update', 'NEW_USER_BONUS_AWARDED', jsonb_build_object('user_id', new.id, 'amount', 500));
          EXCEPTION WHEN OTHERS THEN NULL; END;

          -- Give referrer their 500 credits (if exists)
          IF user_referrer_id IS NOT NULL THEN
            BEGIN
              UPDATE public.profiles 
              SET app_credits = COALESCE(app_credits, 0) + 500
              WHERE id = user_referrer_id;

              BEGIN
                INSERT INTO public.debug_logs (process_name, message, details)
                VALUES ('check_password_update', 'REFERRER_BONUS_AWARDED', jsonb_build_object('referrer_id', user_referrer_id, 'amount', 500));
              EXCEPTION WHEN OTHERS THEN NULL; END;
              
            EXCEPTION WHEN check_violation THEN
              -- Referrer hit max credits limit (200,000)
              BEGIN
                INSERT INTO public.debug_logs (process_name, message, details)
                VALUES ('check_password_update', 'REFERRER_HIT_MAX_CREDITS', jsonb_build_object('referrer_id', user_referrer_id));
              EXCEPTION WHEN OTHERS THEN NULL; END;
            WHEN OTHERS THEN
              -- Other error, log but don't fail
              BEGIN
                INSERT INTO public.debug_logs (process_name, message, details)
                VALUES ('check_password_update', 'REFERRER_BONUS_ERROR', jsonb_build_object('error', SQLERRM, 'referrer_id', user_referrer_id));
              EXCEPTION WHEN OTHERS THEN NULL; END;
            END;
          ELSE
            -- Log that there was no referrer
            BEGIN
              INSERT INTO public.debug_logs (process_name, message)
              VALUES ('check_password_update', 'NO_REFERRER_TO_REWARD');
            EXCEPTION WHEN OTHERS THEN NULL; END;
          END IF;
          
        EXCEPTION WHEN OTHERS THEN
          -- Don't crash password update if bonus fails
          BEGIN
            INSERT INTO public.debug_logs (process_name, message, details)
            VALUES ('check_password_update', 'BONUS_ERROR', jsonb_build_object('error', SQLERRM));
          EXCEPTION WHEN OTHERS THEN NULL; END;
        END;
      ELSE
        -- Log that bonus was already claimed
        BEGIN
          INSERT INTO public.debug_logs (process_name, message)
          VALUES ('check_password_update', 'BONUS_ALREADY_CLAIMED');
        EXCEPTION WHEN OTHERS THEN NULL; END;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      -- Don't crash password update
      BEGIN
        INSERT INTO public.debug_logs (process_name, message, details)
        VALUES ('check_password_update', 'CRITICAL_ERROR', jsonb_build_object('error', SQLERRM));
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END;
  END IF;

  RETURN new;
END;
$$;

-- Reattach the trigger
CREATE TRIGGER on_auth_user_password_set
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.check_password_update();

-- Verify
SELECT 'Password trigger fixed!' as status;
