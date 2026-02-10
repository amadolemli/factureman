-- RESTORE IMMEDIATE SIGNUP BONUS
-- Ensures users get 500 credits immediately upon signup
-- Also rewards the referrer immediately if a code is provided
-- (Robust Logic Update: Fixes signal aborted errors on referral)

-- 1. Ensure required columns exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bonuses_claimed boolean DEFAULT false;

-- 2. Helper to generate referral code
CREATE OR REPLACE FUNCTION public.generate_unique_referral_code(user_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  -- 8 chars hex of MD5 of ID
  RETURN upper(substring(md5(user_id::text) from 1 for 8));
END;
$$;

-- 3. UPDATED TRIGGER: Immediate Reward (ROBUST VERSION)
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
  -- Generate Referral Code for the new user
  ref_code := public.generate_unique_referral_code(new.id);
  
  -- Check for Referrer Code (handle empty string as NULL)
  input_code := NULLIF(TRIM(new.raw_user_meta_data->>'referral_code'), '');

  -- Safely Process Referral with Exception Handling
  BEGIN
    IF input_code IS NOT NULL THEN
      -- Attempt to find referrer
      SELECT id INTO referrer_id
      FROM public.profiles
      WHERE referral_code = upper(input_code);

      -- Sanity Check (Prevent self-referral loop just in case)
      IF referrer_id = new.id THEN
        referrer_id := NULL;
      END IF;

      -- IMMEDIATE REWARD 1: Give Referral Bonus to REFERRER (if exists)
      IF referrer_id IS NOT NULL THEN
        UPDATE public.profiles
        SET app_credits = app_credits + 500
        WHERE id = referrer_id;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Swallow error to prevent signup failure
    -- We log a warning so it can be seen in Postgres logs, but we do NOT stop the signup
    RAISE WARNING 'Referral processing error: %', SQLERRM;
    referrer_id := NULL;
  END;

  -- IMMEDIATE REWARD 2: Insert New User Profile with 500 Credits
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
      500,  -- 500 Credits IMMEDIATELY
      ref_code,
      referrer_id,
      true -- Mark as claimed to prevent future double claiming
  );

  RETURN new;
END;
$$;
