-- FIX REFERRAL CRASH
-- This script updates the handle_new_user trigger to safely handle referral codes
-- It wraps the referral logic in an exception block so signup never fails even if referral processing errors

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
  -- 1. Generate Referral Code for the new user (Safe operation)
  ref_code := public.generate_unique_referral_code(new.id);
  
  -- 2. Check for Referrer Code (handle empty string as NULL)
  input_code := NULLIF(TRIM(new.raw_user_meta_data->>'referral_code'), '');

  -- 3. Safely Process Referral
  BEGIN
      IF input_code IS NOT NULL THEN
        -- Attempt to find referrer
        SELECT id INTO referrer_id
        FROM public.profiles
        WHERE referral_code = upper(input_code);

        -- If found, Verify it's not self-referral (sanity check)
        IF referrer_id = new.id THEN
            referrer_id := NULL;
        END IF;

        -- Reference Reward: Only if referrer exists
        IF referrer_id IS NOT NULL THEN
            UPDATE public.profiles
            SET app_credits = app_credits + 500
            WHERE id = referrer_id;
        END IF;
      END IF;
  EXCEPTION WHEN OTHERS THEN
      -- If ANYTHING goes wrong with referral (invalid code, DB lock, etc), 
      -- we log a warning but ALLOW the user creation to proceed.
      RAISE WARNING 'Referral processing blocked signup. Ignoring referral. Error: %', SQLERRM;
      referrer_id := NULL;
  END;

  -- 4. Create User Profile
  -- We include referrer_id if it was successfully resolved
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
      500,  -- 500 Credits Welcome Bonus
      ref_code,
      referrer_id, -- Link to referrer (or NULL)
      true -- Mark claimed
  );

  RETURN new;
END;
$$;
