-- FINAL ROBUST SETUP: Deferred Bonus + Constraint Handling
-- This restores the full signup -> password -> bonus flow, but SAFELY.

-- 1. CLEANUP: Wipe all triggers again to be safe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_password_set ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.check_password_update();

-- 2. SAFE BONUS FUNCTION (Handles the 200,000 limit)
CREATE OR REPLACE FUNCTION public.award_bonus_transaction(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  referrer_id uuid;
  already_claimed boolean;
BEGIN
  -- Check status
  SELECT bonuses_claimed, referred_by INTO already_claimed, referrer_id
  FROM public.profiles WHERE id = target_user_id;

  IF already_claimed THEN RETURN; END IF;

  -- A. Award New User (500) - Wrap in block to catch max credit errors
  BEGIN
      UPDATE public.profiles 
      SET app_credits = COALESCE(app_credits, 0) + 500,
          bonuses_claimed = true
      WHERE id = target_user_id;
  EXCEPTION WHEN check_violation THEN
      -- User hit the max credit limit? Rare for new user, but let's be safe.
      NULL;
  END;

  -- B. Award Referrer (500) - SAFETY CRITICAL
  -- If referrer is maxed out (200,000), this would normally CRASH the transaction.
  -- We catch the error so the new user's password creation isn't blocked.
  IF referrer_id IS NOT NULL THEN
      BEGIN
          UPDATE public.profiles 
          SET app_credits = COALESCE(app_credits, 0) + 500
          WHERE id = referrer_id;
      EXCEPTION WHEN check_violation THEN
          -- Referrer has reached max credits. Do nothing.
          NULL;
      END;
  END IF;
END;
$$;

-- 3. SIMPLE INSERT TRIGGER (No bonus logic here)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ref_code text;
  referrer_id uuid;
  new_referral_code text;
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
BEGIN
  -- Generate unique code
  new_referral_code := '';
  FOR i IN 1..8 LOOP
    new_referral_code := new_referral_code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;

  -- Find Referrer (Strictly Case Insensitive)
  ref_code := NULLIF(TRIM(new.raw_user_meta_data->>'referral_code'), '');
  IF ref_code IS NOT NULL THEN
      SELECT id INTO referrer_id 
      FROM public.profiles 
      WHERE UPPER(referral_code) = UPPER(ref_code) 
      LIMIT 1;
      
      IF referrer_id IS NOT NULL THEN
          INSERT INTO public.debug_logs (process_name, message, details)
          VALUES ('handle_new_user', 'REFERRER_LINKED', jsonb_build_object('user_id', new.id, 'referrer_id', referrer_id, 'code', ref_code));
      ELSE
          INSERT INTO public.debug_logs (process_name, message, details)
          VALUES ('handle_new_user', 'REFERRER_NOT_FOUND', jsonb_build_object('user_id', new.id, 'code', ref_code));
      END IF;
  END IF;

  -- Create Profile (app_credits = 0)
  INSERT INTO public.profiles (
      id, business_name, app_credits, referral_code, referred_by, bonuses_claimed
  )
  VALUES (
      new.id, 
      'Ma Nouvelle Boutique', 
      0, 
      new_referral_code, 
      referrer_id, 
      false
  );

  INSERT INTO public.debug_logs (process_name, message, details)
  VALUES ('handle_new_user', 'PROFILE_CREATED', jsonb_build_object('user_id', new.id, 'ref_code', new_referral_code));

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Fallback: Create minimal profile so user isn't locked out
  INSERT INTO public.debug_logs (process_name, message, details)
  VALUES ('handle_new_user', 'CRITICAL_FALLBACK', jsonb_build_object('user_id', new.id, 'error', SQLERRM));
  
  INSERT INTO public.profiles (id, business_name, app_credits, bonuses_claimed)
  VALUES (new.id, 'Erreur Creation', 0, false);
  RETURN new;
END;
$$;

-- 4. PASSWORD UPDATE TRIGGER (Awards bonus ONLY when password is set)
CREATE OR REPLACE FUNCTION public.check_password_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Run ONLY if password is effectively changing from NULL/Different to SET
  IF (old.encrypted_password IS DISTINCT FROM new.encrypted_password) 
     AND new.encrypted_password IS NOT NULL THEN
     
     PERFORM public.award_bonus_transaction(new.id);
     
  END IF;
  RETURN new;
END;
$$;

-- 5. ATTACH TRIGGERS
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_auth_user_password_set
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.check_password_update();
