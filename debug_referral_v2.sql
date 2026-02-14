-- DEBUG V2: CATCH ALL ERRORS TO REVEAL THEM
-- This script ensures the transaction logic swallows errors so they are logged to debug_logs.
-- This allows us to see WHY it failed, even if the result is a broken user (which we can delete later).

-- 1. Ensure Columns Exist (Just in case)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bonuses_claimed boolean DEFAULT false;

-- 2. Ensure Helper Function Exists
CREATE OR REPLACE FUNCTION public.generate_unique_referral_code(user_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN upper(substring(md5(user_id::text) from 1 for 8));
END;
$$;

-- 3. Update Trigger with "Swallow & Log" Strategy
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
  -- LOG START
  INSERT INTO public.debug_logs (process_name, message, details)
  VALUES ('handle_new_user', 'START', jsonb_build_object('user_id', new.id));

  BEGIN
      -- Generate Code
      ref_code := public.generate_unique_referral_code(new.id);
      
      -- Get Input
      input_code := NULLIF(TRIM(new.raw_user_meta_data->>'referral_code'), '');
      
      INSERT INTO public.debug_logs (process_name, message, details)
      VALUES ('handle_new_user', 'CODES', jsonb_build_object('gen', ref_code, 'input', input_code));

      -- Referral Logic
      IF input_code IS NOT NULL THEN
        SELECT id INTO referrer_id FROM public.profiles WHERE referral_code = upper(input_code);

        IF referrer_id = new.id THEN
            referrer_id := NULL;
             INSERT INTO public.debug_logs (process_name, message) VALUES ('handle_new_user', 'SELF_REF_BLOCKED');
        END IF;

        IF referrer_id IS NOT NULL THEN
            UPDATE public.profiles SET app_credits = app_credits + 500 WHERE id = referrer_id;
            INSERT INTO public.debug_logs (process_name, message) VALUES ('handle_new_user', 'BONUS_GIVEN');
        ELSE
            INSERT INTO public.debug_logs (process_name, message) VALUES ('handle_new_user', 'REF_NOT_FOUND');
        END IF;
      END IF;

  EXCEPTION WHEN OTHERS THEN
      -- Catch logic errors (lookup, update)
      INSERT INTO public.debug_logs (process_name, message, details)
      VALUES ('handle_new_user', 'LOGIC_ERROR', jsonb_build_object('err', SQLERRM));
  END;

  -- PROFILE CREATION (Wrapped to catch the "Database error saving new user")
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
          500, 
          ref_code, 
          referrer_id, 
          true
      );
      INSERT INTO public.debug_logs (process_name, message) VALUES ('handle_new_user', 'PROFILE_CREATED');

  EXCEPTION WHEN OTHERS THEN
      -- CRITICAL: Catch the insert error so transaction commits and we see the log!
      INSERT INTO public.debug_logs (process_name, message, details)
      VALUES ('handle_new_user', 'PROFILE_INSERT_FAIL', jsonb_build_object('err', SQLERRM));
      
      -- We do NOT raise exception here, to allow the Auth User to be created.
      -- You will have a user without a profile, but you will see the error in logs.
  END;

  RETURN new;
END;
$$;
