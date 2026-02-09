-- 1. Ensure column for bonus tracking exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bonuses_claimed boolean DEFAULT false;

-- 2. Helper to generate referral code (idempotent definition)
CREATE OR REPLACE FUNCTION public.generate_unique_referral_code(user_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  -- 8 chars hex of MD5 of ID
  RETURN upper(substring(md5(user_id::text) from 1 for 8));
END;
$$;

-- 3. Modify New User Trigger to NOT give credits immediately
-- This ensures they start with 0 and must set password to claim bonus
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
  
  -- Clean input code (handle empty string as NULL)
  input_code := NULLIF(TRIM(new.raw_user_meta_data->>'referral_code'), '');

  -- Find referrer if code provided
  IF input_code IS NOT NULL THEN
    SELECT id INTO referrer_id
    FROM public.profiles
    WHERE referral_code = upper(input_code);
  END IF;

  -- Insert Profile with 0 credits and NO immediate rewards
  INSERT INTO public.profiles (id, business_name, app_credits, referral_code, referred_by, bonuses_claimed)
  VALUES (
    new.id, 
    'Ma Nouvelle Boutique', 
    0, -- Start with 0
    ref_code,
    referrer_id,
    false -- Not claimed yet
  );

  RETURN new;
END;
$$;

-- 4. Create/Update RPC function to Claim Bonuses
-- This is called AFTER password creation
CREATE OR REPLACE FUNCTION public.claim_welcome_bonus()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile_record record;
  result json;
BEGIN
  -- Get current user profile
  SELECT * INTO profile_record FROM public.profiles WHERE id = auth.uid();
  
  IF profile_record IS NULL THEN
      RETURN json_build_object('success', false, 'message', 'Profil introuvable');
  END IF;

  -- Prevent double dipping
  IF COALESCE(profile_record.bonuses_claimed, false) THEN
    RETURN json_build_object('success', false, 'message', 'Bonus déjà réclamé');
  END IF;

  -- 1. Give Welcome Bonus to User (500 Credits)
  UPDATE public.profiles
  SET app_credits = app_credits + 500,
      bonuses_claimed = true
  WHERE id = auth.uid();

  -- 2. Give Referral Bonus to Referrer (if exists) (500 Credits)
  IF profile_record.referred_by IS NOT NULL THEN
    UPDATE public.profiles
    SET app_credits = app_credits + 500
    WHERE id = profile_record.referred_by;
  END IF;

  RETURN json_build_object('success', true, 'message', 'Bonus activé');
END;
$$;
