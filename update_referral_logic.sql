-- 1. Add column to track if bonuses were claimed
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bonuses_claimed boolean DEFAULT false;

-- 2. Modify Trigger to STOP giving immediate credits
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  ref_code text;
  referrer_id uuid;
BEGIN
  -- Generate Referral Code
  ref_code := public.generate_unique_referral_code(new.id);

  -- Find referrer
  IF new.raw_user_meta_data->>'referral_code' IS NOT NULL THEN
    SELECT id INTO referrer_id
    FROM public.profiles
    WHERE referral_code = upper(new.raw_user_meta_data->>'referral_code');
  END IF;

  -- Insert Profile with 0 credits and NO immediate rewards
  INSERT INTO public.profiles (id, business_name, app_credits, referral_code, referred_by, bonuses_claimed)
  VALUES (
    new.id, 
    'Ma Nouvelle Boutique', 
    0, -- 0 Credits initially!
    ref_code,
    referrer_id,
    false -- Not claimed yet
  );

  RETURN new;
END;
$$;

-- 3. Create RPC function to Claim Bonuses
CREATE OR REPLACE FUNCTION public.claim_welcome_bonus()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile_record record;
  referrer_id uuid;
  result json;
BEGIN
  -- Get current user profile
  SELECT * INTO profile_record FROM public.profiles WHERE id = auth.uid();
  
  IF profile_record IS NULL THEN
      RETURN json_build_object('success', false, 'message', 'Profil introuvable');
  END IF;

  IF profile_record.bonuses_claimed THEN
    RETURN json_build_object('success', false, 'message', 'Bonus déjà réclamé');
  END IF;

  -- 1. Give Welcome Bonus to User
  UPDATE public.profiles
  SET app_credits = app_credits + 500,
      bonuses_claimed = true
  WHERE id = auth.uid();

  -- 2. Give Referral Bonus to Referrer (if exists)
  IF profile_record.referred_by IS NOT NULL THEN
    UPDATE public.profiles
    SET app_credits = app_credits + 500
    WHERE id = profile_record.referred_by;
  END IF;

  RETURN json_build_object('success', true, 'message', 'Bonus activé');
END;
$$;
