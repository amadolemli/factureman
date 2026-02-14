-- DELAY BONUS UNTIL PASSWORD CREATION
-- Logic:
-- 1. New users start with 0 credits and `bonuses_claimed = false`.
-- 2. When a password is set (Update on auth.users), we trigger the bonus award.
-- 3. This awards 500 credits to the user AND 500 to the referrer.

-- 1. CORE FUNCTION TO AWARD CREDITS (Reusable)
CREATE OR REPLACE FUNCTION public.award_bonus_transaction(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  referrer_id uuid;
  already_claimed boolean;
BEGIN
  -- Log
  BEGIN INSERT INTO public.debug_logs (process_name, message) VALUES ('award_bonus', 'Checking eligibility for ' || target_user_id::text); EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Check status
  SELECT bonuses_claimed, referred_by INTO already_claimed, referrer_id
  FROM public.profiles WHERE id = target_user_id;

  -- Exit if already claimed or profile doesn't exist yet
  IF already_claimed IS TRUE OR already_claimed IS NULL THEN 
    BEGIN INSERT INTO public.debug_logs (process_name, message) VALUES ('award_bonus', 'Skipping: Already claimed or no profile'); EXCEPTION WHEN OTHERS THEN NULL; END;
    RETURN; 
  END IF;

  -- 1. AWARD NEW USER
  UPDATE public.profiles 
  SET app_credits = COALESCE(app_credits, 0) + 500, 
      bonuses_claimed = true 
  WHERE id = target_user_id;

  BEGIN INSERT INTO public.debug_logs (process_name, message) VALUES ('award_bonus', 'User bonus awarded'); EXCEPTION WHEN OTHERS THEN NULL; END;

  -- 2. AWARD REFERRER (if exists)
  IF referrer_id IS NOT NULL THEN
    UPDATE public.profiles 
    SET app_credits = COALESCE(app_credits, 0) + 500 
    WHERE id = referrer_id;
    
    BEGIN INSERT INTO public.debug_logs (process_name, message) VALUES ('award_bonus', 'Referrer bonus awarded'); EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
END;
$$;


-- 2. UPDATE INSERT TRIGGER (Start with 0 credits)
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
  -- Generate Referral Code
  ref_code := upper(substring(md5(new.id::text) from 1 for 8));
  
  -- Clean Input Code
  input_code := NULLIF(TRIM(new.raw_user_meta_data->>'referral_code'), '');
  
  -- Find Referrer (No credit award here anymore!)
  IF input_code IS NOT NULL THEN
    BEGIN
        SELECT id INTO referrer_id FROM public.profiles WHERE referral_code = upper(input_code);
    EXCEPTION WHEN OTHERS THEN referrer_id := NULL; END;
    
    IF referrer_id IS NOT NULL AND referrer_id::text = new.id::text THEN referrer_id := NULL; END IF;
  END IF;

  -- Create Profile (STARTING WITH 0 CREDITS, CLAIMED = FALSE)
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
      0,  -- Zero credits initially
      ref_code, 
      referrer_id, 
      false -- Not claimed yet
  );

  -- Log
  BEGIN INSERT INTO public.debug_logs (process_name, message) VALUES ('handle_new_user', 'Profile created (pending password)'); EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Edge Case: If password is set IMMEDIATELY (e.g. email signup), award now.
  IF new.encrypted_password IS NOT NULL THEN
     PERFORM public.award_bonus_transaction(new.id);
  END IF;

  RETURN new;
END;
$$;


-- 3. CREATE TRIGGER FOR PASSWORD UPDATES
CREATE OR REPLACE FUNCTION public.check_password_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If password is now present (and wasn't null? or just present is enough check since we check bonuses_claimed)
  IF new.encrypted_password IS NOT NULL THEN
     PERFORM public.award_bonus_transaction(new.id);
  END IF;
  RETURN new;
END;
$$;

-- Safely create trigger
DROP TRIGGER IF EXISTS on_auth_user_password_set ON auth.users;
CREATE TRIGGER on_auth_user_password_set
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.check_password_update();
