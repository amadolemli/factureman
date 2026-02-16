-- FIX_REFERRAL_BONUS_V3.sql
-- Comprehensive fix for referral bonuses not being awarded.

-- 1. Ensure debug logging exists
CREATE TABLE IF NOT EXISTS public.debug_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    process_name text,
    message text,
    details jsonb,
    created_at timestamptz DEFAULT now()
);

-- 2. IMPROVED BONUS AWARDING FUNCTION
CREATE OR REPLACE FUNCTION public.award_bonus_transaction(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referrer_id uuid;
  already_claimed boolean;
  user_current_credits int;
BEGIN
  -- A. Fetch Profile Info (Casting id to text for comparison)
  SELECT bonuses_claimed, referred_by::uuid, app_credits 
  INTO already_claimed, referrer_id, user_current_credits
  FROM public.profiles 
  WHERE id = target_user_id::text;

  -- B. Log Attempt
  INSERT INTO public.debug_logs (process_name, message, details)
  VALUES ('award_bonus', 'ATTEMPT', jsonb_build_object(
      'user_id', target_user_id, 
      'already_claimed', already_claimed, 
      'referrer_id', referrer_id,
      'current_credits', user_current_credits
  ));

  -- C. Safety Checks
  IF COALESCE(already_claimed, false) = true THEN 
      INSERT INTO public.debug_logs (process_name, message, details)
      VALUES ('award_bonus', 'SKIPPED_ALREADY_CLAIMED', jsonb_build_object('user_id', target_user_id));
      RETURN; 
  END IF;

  -- D. Award New User (500)
  BEGIN
      UPDATE public.profiles 
      SET app_credits = COALESCE(app_credits, 0) + 500,
          bonuses_claimed = true
      WHERE id = target_user_id::text;
      
      INSERT INTO public.debug_logs (process_name, message, details)
      VALUES ('award_bonus', 'USER_AWARDED', jsonb_build_object('user_id', target_user_id, 'amount', 500));
  EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.debug_logs (process_name, message, details)
      VALUES ('award_bonus', 'USER_AWARD_ERROR', jsonb_build_object('user_id', target_user_id, 'error', SQLERRM));
  END;

  -- E. Award Referrer (500)
  IF referrer_id IS NOT NULL THEN
      BEGIN
          UPDATE public.profiles 
          SET app_credits = COALESCE(app_credits, 0) + 500
          WHERE id = referrer_id::text;
          
          INSERT INTO public.debug_logs (process_name, message, details)
          VALUES ('award_bonus', 'REFERRER_AWARDED', jsonb_build_object('referrer_id', referrer_id, 'amount', 500));
      EXCEPTION WHEN OTHERS THEN
          INSERT INTO public.debug_logs (process_name, message, details)
          VALUES ('award_bonus', 'REFERRER_AWARD_ERROR', jsonb_build_object('referrer_id', referrer_id, 'error', SQLERRM));
      END;
  END IF;
END;
$$;

-- 3. REPAIR: Trigger bonus for any validated user who hasn't claimed it yet
-- This picks up anyone who was missed by the trigger during signup.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT u.id 
        FROM auth.users u
        JOIN public.profiles p ON u.id::text = p.id
        WHERE (u.phone_confirmed_at IS NOT NULL OR u.email_confirmed_at IS NOT NULL)
          AND u.encrypted_password IS NOT NULL
          AND COALESCE(p.bonuses_claimed, false) = false
    LOOP
        PERFORM public.award_bonus_transaction(r.id);
    END LOOP;
END $$;

-- 4. VERIFY TRIGGER ON AUTH.USERS
-- No changes needed to the trigger if restore_login_v2.sql was run, 
-- but we make sure the function it calls is the updated one.
-- (The trigger already calls check_user_validation which calls award_bonus_transaction)
