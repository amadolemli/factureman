-- FIX REFERRAL BONUS BUG
-- 1. Updates the logic to handle cases where credits might be NULL (NULL + 500 = NULL).
-- 2. Manually applies the missing bonus to the referrer of the most recent user.

-- A. UPDATE THE FUNCTION LOGIC (Handle NULLs)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  ref_code text;
  referrer_id uuid;
  input_code text;
BEGIN
  -- LOG START
  BEGIN
    INSERT INTO public.debug_logs (process_name, message, details)
    VALUES ('handle_new_user', 'START_TRIGGER', jsonb_build_object('user_id', new.id));
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
      -- Generate Code
      ref_code := public.generate_unique_referral_code(new.id);
      
      -- Get Input
      input_code := NULLIF(TRIM(new.raw_user_meta_data->>'referral_code'), '');
      
      -- Referral Check
      IF input_code IS NOT NULL THEN
        -- Link Referrer
        referrer_id := NULL;
        BEGIN
            SELECT id INTO referrer_id FROM public.profiles WHERE referral_code = upper(input_code);
        EXCEPTION WHEN OTHERS THEN NULL; END;

        IF referrer_id = new.id THEN referrer_id := NULL; END IF;

        -- Apply Bonus (FIXED: COALESCE to handle NULLs)
        IF referrer_id IS NOT NULL THEN
            UPDATE public.profiles 
            SET app_credits = COALESCE(app_credits, 0) + 500 
            WHERE id = referrer_id;
            
            BEGIN INSERT INTO public.debug_logs (process_name, message) VALUES ('handle_new_user', 'BONUS_APPLIED_SAFELY'); EXCEPTION WHEN OTHERS THEN NULL; END;
        END IF;
      END IF;

  EXCEPTION WHEN OTHERS THEN
      BEGIN INSERT INTO public.debug_logs (process_name, message, details) VALUES ('handle_new_user', 'LOGIC_ERROR', jsonb_build_object('err', SQLERRM)); EXCEPTION WHEN OTHERS THEN NULL; END;
  END;

  -- PROFILE INSERT
  BEGIN
      INSERT INTO public.profiles (
          id, 
          business_name, 
          app_credits, 
          referral_code, 
          referred_by, 
          bonuses_claimed
      )
      VALUES (
          new.id, 
          'Ma Nouvelle Boutique', 
          500, 
          ref_code, 
          referrer_id, 
          true
      );
  EXCEPTION WHEN OTHERS THEN
      BEGIN INSERT INTO public.debug_logs (process_name, message, details) VALUES ('handle_new_user', 'PROFILE_FAIL', jsonb_build_object('err', SQLERRM)); EXCEPTION WHEN OTHERS THEN NULL; END;
  END;

  RETURN new;
END;
$$;


-- B. MANUAL FIX FOR THE MISSED BONUS (Last User only)
DO $$
DECLARE
  last_referrer_id uuid;
  target_user_id uuid;
BEGIN
  -- Find the referrer of the most recent user
  SELECT referred_by INTO last_referrer_id
  FROM public.profiles 
  ORDER BY created_at DESC 
  LIMIT 1;

  IF last_referrer_id IS NOT NULL THEN
    -- Give them the 500 credits they missed
    UPDATE public.profiles 
    SET app_credits = COALESCE(app_credits, 0) + 500 
    WHERE id = last_referrer_id;
    
    RAISE NOTICE 'Validation: 500 Credits added to Referrer %', last_referrer_id;
  ELSE
    RAISE NOTICE 'No referrer found for the last user - nothing to fix.';
  END IF;
END $$;
