-- SAFE DEBUG: Add comprehensive error catching to handle_new_user
-- This modifies the function to swallow errors and LOG them instead,
-- so the signup doesn't crash completely.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ref_code text;
  referrer_id uuid;
  first_referral_code text;
BEGIN
  -- 1. Initialize Default Values
  BEGIN
      first_referral_code := public.generate_unique_referral_code();
  EXCEPTION WHEN OTHERS THEN
      -- Fallback if generator fails
      first_referral_code := 'USER-' || substr(md5(random()::text), 1, 6);
      INSERT INTO public.debug_logs (process_name, message, details)
      VALUES ('handle_new_user', 'CODE_GEN_ERROR', jsonb_build_object('err', SQLERRM));
  END;

  -- 2. Check for Referral Code
  ref_code := (new.raw_user_meta_data->>'referral_code');
  
  -- If empty string, treat as null
  IF ref_code = '' THEN
      ref_code := NULL;
  END IF;

  -- 3. Lookup Referrer (Safe)
  IF ref_code IS NOT NULL THEN
      BEGIN
          SELECT id INTO referrer_id 
          FROM public.profiles 
          WHERE referral_code = ref_code 
          LIMIT 1;
      EXCEPTION WHEN OTHERS THEN
          INSERT INTO public.debug_logs (process_name, message, details)
          VALUES ('handle_new_user', 'REFERRAL_LOOKUP_ERROR', jsonb_build_object('err', SQLERRM));
      END;
  END IF;

  -- 4. Create Profile (Safe Insert)
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
          0,  -- Zero credits initially (delayed)
          first_referral_code, 
          referrer_id, 
          false -- Not claimed yet
      );
  EXCEPTION WHEN OTHERS THEN
      -- Initial profile insert failed. Log it.
      INSERT INTO public.debug_logs (process_name, message, details)
      VALUES ('handle_new_user', 'PROFILE_INSERT_FAILED', jsonb_build_object('err', SQLERRM, 'user_id', new.id));
      
      -- Attempt fallback insert (minimal)
      BEGIN
          INSERT INTO public.profiles (id, business_name, app_credits, bonuses_claimed)
          VALUES (new.id, 'Erreur Creation', 0, false);
      EXCEPTION WHEN OTHERS THEN
          -- Total failure
          INSERT INTO public.debug_logs (process_name, message, details)
          VALUES ('handle_new_user', 'FATAL_PROFILE_FAIL', jsonb_build_object('err', SQLERRM));
      END;
  END;

  -- 5. EDGE CASE: If password already set (rare), award immediately
  IF new.encrypted_password IS NOT NULL THEN
      PERFORM public.award_bonus_transaction(new.id);
  END IF;

  RETURN new;
END;
$$;
