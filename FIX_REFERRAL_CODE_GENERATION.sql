-- CORRECTION COMPLÈTE DES CODES DE PARRAINAGE
-- This fixes the referral code generation issue and adds codes to users who don't have them

-- ============================================
-- STEP 1: Fix the handle_new_user() function
-- ============================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  referrer_id uuid;
  new_referral_code text;
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  input_ref_code text;
  code_exists boolean;
BEGIN
  -- Log start
  BEGIN
    INSERT INTO public.debug_logs (process_name, message, details)
    VALUES ('handle_new_user', 'START', jsonb_build_object('user_id', new.id));
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Generate UNIQUE referral code (ensure it doesn't already exist)
  LOOP
    new_referral_code := '';
    FOR i IN 1..8 LOOP
      new_referral_code := new_referral_code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    
    -- Check if this code already exists
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = new_referral_code) INTO code_exists;
    
    -- Exit loop if code is unique
    EXIT WHEN NOT code_exists;
  END LOOP;

  -- Log generated code
  BEGIN
    INSERT INTO public.debug_logs (process_name, message, details)
    VALUES ('handle_new_user', 'CODE_GENERATED', jsonb_build_object('code', new_referral_code));
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Get referral code from signup metadata
  BEGIN
    input_ref_code := NULLIF(TRIM(new.raw_user_meta_data->>'referral_code'), '');
    
    IF input_ref_code IS NOT NULL THEN
      -- Find the referrer by their code
      SELECT id INTO referrer_id 
      FROM public.profiles 
      WHERE UPPER(referral_code) = UPPER(input_ref_code) 
      LIMIT 1;
      
      -- Log referral lookup result
      BEGIN
        INSERT INTO public.debug_logs (process_name, message, details)
        VALUES ('handle_new_user', 'REFERRAL_LOOKUP', jsonb_build_object(
          'input_code', input_ref_code, 
          'referrer_found', referrer_id IS NOT NULL,
          'referrer_id', referrer_id
        ));
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    referrer_id := NULL;
    BEGIN
      INSERT INTO public.debug_logs (process_name, message, details)
      VALUES ('handle_new_user', 'REFERRAL_ERROR', jsonb_build_object('error', SQLERRM));
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END;

  -- Create profile with the generated referral code
  BEGIN
    INSERT INTO public.profiles (
      id, 
      business_name, 
      app_credits, 
      referral_code,           -- THIS IS CRITICAL - must be set!
      referred_by, 
      bonuses_claimed
    )
    VALUES (
      new.id, 
      'Ma Nouvelle Boutique', 
      0,  -- Start with 0, bonus awarded when password is set
      new_referral_code,        -- Assign the generated code
      referrer_id, 
      false
    );
    
    BEGIN
      INSERT INTO public.debug_logs (process_name, message, details)
      VALUES ('handle_new_user', 'PROFILE_CREATED', jsonb_build_object(
        'user_id', new.id,
        'referral_code', new_referral_code,
        'referred_by', referrer_id
      ));
    EXCEPTION WHEN OTHERS THEN NULL; END;
    
  EXCEPTION WHEN OTHERS THEN
    -- Fallback: minimal profile WITH referral code
    BEGIN
      INSERT INTO public.debug_logs (process_name, message, details)
      VALUES ('handle_new_user', 'PROFILE_ERROR', jsonb_build_object('error', SQLERRM));
      
      -- Try to insert minimal profile with at least a referral code
      INSERT INTO public.profiles (id, business_name, app_credits, referral_code, bonuses_claimed)
      VALUES (new.id, 'Nouvel Utilisateur', 0, new_referral_code, false)
      ON CONFLICT (id) DO UPDATE
      SET referral_code = COALESCE(public.profiles.referral_code, new_referral_code);
      
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END;

  RETURN new;
END;
$$;

-- Reattach trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- STEP 2: Generate referral codes for existing users who don't have one
-- ============================================
DO $$
DECLARE
  user_record RECORD;
  new_code text;
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code_exists boolean;
BEGIN
  -- Loop through all users without a referral code
  FOR user_record IN 
    SELECT id FROM public.profiles WHERE referral_code IS NULL OR referral_code = ''
  LOOP
    -- Generate unique code for each user
    LOOP
      new_code := '';
      FOR i IN 1..8 LOOP
        new_code := new_code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
      END LOOP;
      
      SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    
    -- Update the user with the new code
    UPDATE public.profiles 
    SET referral_code = new_code 
    WHERE id = user_record.id;
    
    RAISE NOTICE 'Generated code % for user %', new_code, user_record.id;
  END LOOP;
END;
$$;

-- ============================================
-- STEP 3: Verify all users now have codes
-- ============================================
SELECT 
  COUNT(*) as total_users,
  COUNT(referral_code) as users_with_codes,
  COUNT(*) - COUNT(referral_code) as users_without_codes
FROM public.profiles;

-- Show the newly created users and their codes
SELECT 
  id,
  business_name,
  referral_code,
  app_credits,
  created_at
FROM public.profiles
ORDER BY created_at DESC
LIMIT 5;
