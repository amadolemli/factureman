-- REBOOT REFERRAL SYSTEM WITH CLEAN SCHEMA
-- This script safely re-adds the referral/bonus logic step-by-step.

-- 1. Ensure Profiles table has necessary columns (Safe)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bonuses_claimed boolean DEFAULT false;

-- 2. Create/Replace Generator Function
CREATE OR REPLACE FUNCTION public.generate_unique_referral_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- 3. Create/Replace Bonus Award Function (Safe)
CREATE OR REPLACE FUNCTION public.award_bonus_transaction(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  referrer_id uuid;
  already_claimed boolean;
BEGIN
  -- Check if already claimed to prevent double dip
  SELECT bonuses_claimed, referred_by INTO already_claimed, referrer_id
  FROM public.profiles WHERE id = target_user_id;

  IF already_claimed THEN
      RETURN;
  END IF;

  -- Award New User (500)
  UPDATE public.profiles 
  SET app_credits = COALESCE(app_credits, 0) + 500,
      bonuses_claimed = true
  WHERE id = target_user_id;

  -- Award Referrer (500) if exists
  IF referrer_id IS NOT NULL THEN
      UPDATE public.profiles 
      SET app_credits = COALESCE(app_credits, 0) + 500
      WHERE id = referrer_id;
  END IF;
END;
$$;

-- 4. Restore the Trigger (Without Debug Logs to minimize permission issues)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ref_code text;
  referrer_id uuid;
  new_referral_code text;
BEGIN
  -- Generate code for this new user
  new_referral_code := public.generate_unique_referral_code();

  -- Get referral code from metadata (handle empty string)
  ref_code := NULLIF(TRIM(new.raw_user_meta_data->>'referral_code'), '');

  -- Find referrer ID if code exists
  IF ref_code IS NOT NULL THEN
      SELECT id INTO referrer_id FROM public.profiles WHERE referral_code = ref_code LIMIT 1;
  END IF;

  -- Insert Profile
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
      0,  -- 0 credits initially
      new_referral_code, 
      referrer_id, 
      false
  );

  -- Immediate Bonus Award (Edge Case: Password already set)
  IF new.encrypted_password IS NOT NULL THEN
     PERFORM public.award_bonus_transaction(new.id);
  END IF;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Fallback if anything fails: just create the user so they can login
  INSERT INTO public.profiles (id, business_name, app_credits, bonuses_claimed)
  VALUES (new.id, 'Erreur Creation', 0, false);
  RETURN new;
END;
$$;
