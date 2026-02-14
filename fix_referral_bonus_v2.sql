-- FIX TYPE MISMATCH ERROR (text vs uuid)
-- It seems 'id' or 'referred_by' has a type mismatch in the database. 
-- We cast everything to TEXT to be safe and ensure the comparison works.

-- 1. UPDATE FUNCTION WITH CASTING FIX
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
  -- 1. Generate local Referral Code
  ref_code := upper(substring(md5(new.id::text) from 1 for 8));
  
  -- 2. Clean Input Code
  input_code := NULLIF(TRIM(new.raw_user_meta_data->>'referral_code'), '');
  
  -- 3. Find Referrer
  IF input_code IS NOT NULL THEN
    BEGIN
        SELECT id INTO referrer_id 
        FROM public.profiles 
        WHERE referral_code = upper(input_code);
    EXCEPTION WHEN OTHERS THEN 
        referrer_id := NULL;
    END;

    -- Prevent Check
    IF referrer_id IS NOT NULL AND referrer_id::text = new.id::text THEN
        referrer_id := NULL;
    END IF;

    -- Apply Bonus to Referrer (CASTING ID TO TEXT TO FIX ERROR)
    IF referrer_id IS NOT NULL THEN
        UPDATE public.profiles 
        SET app_credits = COALESCE(app_credits, 0) + 500 
        WHERE id::text = referrer_id::text;
    END IF;
  END IF;

  -- 4. Create Profile
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

  RETURN new;
END;
$$;


-- 2. APPLY MANUAL FIX TO LATEST USER (With Casting)
DO $$
DECLARE
  last_referrer_id text; -- Use TEXT to avoid cast errors
BEGIN
  -- Get the ID as text directly
  SELECT referred_by::text INTO last_referrer_id
  FROM public.profiles 
  ORDER BY created_at DESC 
  LIMIT 1;

  IF last_referrer_id IS NOT NULL THEN
    UPDATE public.profiles 
    SET app_credits = COALESCE(app_credits, 0) + 500 
    WHERE id::text = last_referrer_id;
    
    RAISE NOTICE 'SUCCESS: Bonus added to Referrer %', last_referrer_id;
  ELSE
    RAISE NOTICE 'No referrer found to compensate.';
  END IF;
END $$;
