-- COMPLETE TRIGGER FIX - Password Storage Issue Resolution
-- This fixes both the signup AND password storage triggers

-- ============================================
-- STEP 1: COMPLETE CLEANUP
-- ============================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_password_set ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.check_password_update() CASCADE;
DROP FUNCTION IF EXISTS public.award_bonus_transaction(uuid) CASCADE;

-- ============================================
-- STEP 2: CREATE DEBUG LOGS TABLE (if needed)
-- ============================================
CREATE TABLE IF NOT EXISTS public.debug_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    process_name text,
    message text,
    details jsonb,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.debug_logs DISABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 3: ENSURE PROFILE COLUMNS EXIST
-- ============================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bonuses_claimed boolean DEFAULT false;

-- ============================================
-- STEP 4: CREATE USER SIGNUP TRIGGER
-- ============================================
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
  input_ref_code text;
BEGIN
  -- Log start
  BEGIN
    INSERT INTO public.debug_logs (process_name, message, details)
    VALUES ('handle_new_user', 'START', jsonb_build_object('user_id', new.id));
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Generate unique referral code
  new_referral_code := '';
  FOR i IN 1..8 LOOP
    new_referral_code := new_referral_code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;

  -- Get referral code from metadata
  BEGIN
    input_ref_code := NULLIF(TRIM(new.raw_user_meta_data->>'referral_code'), '');
    IF input_ref_code IS NOT NULL THEN
      SELECT id INTO referrer_id FROM public.profiles WHERE referral_code = input_ref_code LIMIT 1;
      
      -- Log referral lookup result
      BEGIN
        INSERT INTO public.debug_logs (process_name, message, details)
        VALUES ('handle_new_user', 'REFERRAL_LOOKUP', jsonb_build_object('input', input_ref_code, 'found', referrer_id IS NOT NULL));
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    referrer_id := NULL;
    BEGIN
      INSERT INTO public.debug_logs (process_name, message, details)
      VALUES ('handle_new_user', 'REFERRAL_ERROR', jsonb_build_object('error', SQLERRM));
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END;

  -- Create profile with initial 0 credits (bonus awarded on password set)
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
      0,  -- Start with 0, bonus awarded when password is set
      new_referral_code, 
      referrer_id, 
      false
    );
    
    BEGIN
      INSERT INTO public.debug_logs (process_name, message)
      VALUES ('handle_new_user', 'PROFILE_CREATED_OK');
    EXCEPTION WHEN OTHERS THEN NULL; END;
    
  EXCEPTION WHEN OTHERS THEN
    -- Fallback: minimal profile
    BEGIN
      INSERT INTO public.debug_logs (process_name, message, details)
      VALUES ('handle_new_user', 'PROFILE_ERROR', jsonb_build_object('error', SQLERRM));
      
      INSERT INTO public.profiles (id, business_name, app_credits, bonuses_claimed)
      VALUES (new.id, 'Nouvel Utilisateur', 0, false)
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END;

  RETURN new;
END;
$$;

-- ============================================
-- STEP 5: CREATE PASSWORD UPDATE TRIGGER
-- ============================================
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
      -- Get user's referral info
      SELECT referred_by, bonuses_claimed 
      INTO user_referrer_id, already_claimed 
      FROM public.profiles 
      WHERE id = new.id;

      BEGIN
        INSERT INTO public.debug_logs (process_name, message, details)
        VALUES ('check_password_update', 'USER_INFO', jsonb_build_object('referrer', user_referrer_id, 'claimed', already_claimed));
      EXCEPTION WHEN OTHERS THEN NULL; END;

      -- Award bonuses if not already claimed
      IF NOT COALESCE(already_claimed, false) THEN
        BEGIN
          -- Give new user their 500 credits
          UPDATE public.profiles 
          SET app_credits = COALESCE(app_credits, 0) + 500,
              bonuses_claimed = true
          WHERE id = new.id;

          BEGIN
            INSERT INTO public.debug_logs (process_name, message)
            VALUES ('check_password_update', 'NEW_USER_BONUS_AWARDED');
          EXCEPTION WHEN OTHERS THEN NULL; END;

          -- Give referrer their 500 credits (if exists)
          IF user_referrer_id IS NOT NULL THEN
            BEGIN
              UPDATE public.profiles 
              SET app_credits = COALESCE(app_credits, 0) + 500
              WHERE id = user_referrer_id;

              BEGIN
                INSERT INTO public.debug_logs (process_name, message)
                VALUES ('check_password_update', 'REFERRER_BONUS_AWARDED');
              EXCEPTION WHEN OTHERS THEN NULL; END;
              
            EXCEPTION WHEN check_violation THEN
              -- Referrer hit max credits limit
              BEGIN
                INSERT INTO public.debug_logs (process_name, message)
                VALUES ('check_password_update', 'REFERRER_HIT_MAX_CREDITS');
              EXCEPTION WHEN OTHERS THEN NULL; END;
            WHEN OTHERS THEN
              -- Other error, log but don't fail
              BEGIN
                INSERT INTO public.debug_logs (process_name, message, details)
                VALUES ('check_password_update', 'REFERRER_BONUS_ERROR', jsonb_build_object('error', SQLERRM));
              EXCEPTION WHEN OTHERS THEN NULL; END;
            END;
          END IF;
          
        EXCEPTION WHEN OTHERS THEN
          -- Don't crash password update if bonus fails
          BEGIN
            INSERT INTO public.debug_logs (process_name, message, details)
            VALUES ('check_password_update', 'BONUS_ERROR', jsonb_build_object('error', SQLERRM));
          EXCEPTION WHEN OTHERS THEN NULL; END;
        END;
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

-- ============================================
-- STEP 6: ATTACH TRIGGERS
-- ============================================
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_auth_user_password_set
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.check_password_update();

-- ============================================
-- STEP 7: VERIFY SETUP
-- ============================================
SELECT 
  'SETUP COMPLETE!' as status,
  COUNT(*) FILTER (WHERE tgname = 'on_auth_user_created') as signup_trigger_count,
  COUNT(*) FILTER (WHERE tgname = 'on_auth_user_password_set') as password_trigger_count
FROM pg_trigger 
WHERE tgname IN ('on_auth_user_created', 'on_auth_user_password_set');

-- Show recent logs to confirm logging works
SELECT * FROM public.debug_logs ORDER BY created_at DESC LIMIT 5;
