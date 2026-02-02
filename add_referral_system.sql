-- 1. Add Referral Columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'referral_code') THEN
        ALTER TABLE public.profiles ADD COLUMN referral_code text UNIQUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'referred_by') THEN
        ALTER TABLE public.profiles ADD COLUMN referred_by uuid REFERENCES public.profiles(id);
    END IF;
END $$;

-- 2. Function to generate referral code
CREATE OR REPLACE FUNCTION public.generate_unique_referral_code(user_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  new_code text;
BEGIN
  -- Simple deterministic but obscure enough code: 8 chars hex of MD5 of ID
  new_code := upper(substring(md5(user_id::text) from 1 for 8));
  RETURN new_code;
END;
$$;

-- 3. Update Existing Users (Backfill)
UPDATE public.profiles
SET referral_code = public.generate_unique_referral_code(id)
WHERE referral_code IS NULL;

-- 4. Update the New User Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  ref_code text;
  referrer_id uuid;
BEGIN
  -- 1. Generate Referral Code for the new user
  ref_code := public.generate_unique_referral_code(new.id);

  -- 2. Check if a valid referral code was passed in metadata
  -- Note: new.raw_user_meta_data is a JSONB column
  IF new.raw_user_meta_data->>'referral_code' IS NOT NULL THEN
    SELECT id INTO referrer_id
    FROM public.profiles
    WHERE referral_code = upper(new.raw_user_meta_data->>'referral_code');
  END IF;

  -- 3. Insert Profile
  INSERT INTO public.profiles (id, business_name, app_credits, referral_code, referred_by)
  VALUES (
    new.id, 
    'Ma Nouvelle Boutique', 
    500, -- Base Welcome Credits
    ref_code,
    referrer_id -- Link to referrer if found
  );

  -- 4. Reward Referrer (if exists)
  IF referrer_id IS NOT NULL THEN
    UPDATE public.profiles
    SET app_credits = app_credits + 500
    WHERE id = referrer_id;
  END IF;

  RETURN new;
END;
$$;
