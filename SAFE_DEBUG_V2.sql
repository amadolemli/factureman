-- SAFE DEBUG V2: NO DATA LOSS GUARANTEED
-- This script updates the logging logic WITHOUT deleting any existing tables or data.
-- It ensures existing users and profiles remain untouched.

-- 1. SAFE DEBUG LOGS SETUP (Create only if missing)
CREATE TABLE IF NOT EXISTS public.debug_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    process_name text,
    message text,
    details jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- Ensure RLS is disabled on logs to prevent permission errors (Logs are for admin/dev use)
ALTER TABLE public.debug_logs DISABLE ROW LEVEL SECURITY;

-- Add to publication for realtime (Safe approach)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime FOR TABLE public.debug_logs;
  ELSE
    ALTER PUBLICATION supabase_realtime ADD TABLE public.debug_logs;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore if already exists
END;
$$;

-- 2. SAFE SCHEMA UPDATES (Only adds columns if missing)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bonuses_claimed boolean DEFAULT false;

-- 3. HELPER FUNCTION UPDATE (Safe replace)
CREATE OR REPLACE FUNCTION public.generate_unique_referral_code(user_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN upper(substring(md5(user_id::text) from 1 for 8));
END;
$$;

-- 4. UPDATE THE LOGIC (Replaces the code of the function, keeps the function itself)
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
  -- LOG START (Wrapped in block to never fail)
  BEGIN
    INSERT INTO public.debug_logs (process_name, message, details)
    VALUES ('handle_new_user', 'START_TRIGGER', jsonb_build_object('user_id', new.id));
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
      -- Generate Code
      ref_code := public.generate_unique_referral_code(new.id);
      
      -- Get Input
      input_code := NULLIF(TRIM(new.raw_user_meta_data->>'referral_code'), '');
      
      -- LOG INPUT
      BEGIN
        INSERT INTO public.debug_logs (process_name, message, details)
        VALUES ('handle_new_user', 'INPUT_DATA', jsonb_build_object('gen_code', ref_code, 'input_code', input_code));
      EXCEPTION WHEN OTHERS THEN NULL; END;

      -- Referral Check
      IF input_code IS NOT NULL THEN
        -- Try to find referrer
        referrer_id := NULL;
        BEGIN
            SELECT id INTO referrer_id FROM public.profiles WHERE referral_code = upper(input_code);
        EXCEPTION WHEN OTHERS THEN
            BEGIN INSERT INTO public.debug_logs (process_name, message, details) VALUES ('handle_new_user', 'REFERRER_LOOKUP_ERROR', jsonb_build_object('err', SQLERRM)); EXCEPTION WHEN OTHERS THEN NULL; END;
        END;

        -- Block Self-referral
        IF referrer_id = new.id THEN
            referrer_id := NULL;
             BEGIN INSERT INTO public.debug_logs (process_name, message) VALUES ('handle_new_user', 'SELF_REF_BLOCKED'); EXCEPTION WHEN OTHERS THEN NULL; END;
        END IF;

        -- Apply Bonus
        IF referrer_id IS NOT NULL THEN
            UPDATE public.profiles SET app_credits = app_credits + 500 WHERE id = referrer_id;
            BEGIN INSERT INTO public.debug_logs (process_name, message) VALUES ('handle_new_user', 'BONUS_APPLIED_TO_REFERRER'); EXCEPTION WHEN OTHERS THEN NULL; END;
        ELSE
            BEGIN INSERT INTO public.debug_logs (process_name, message) VALUES ('handle_new_user', 'REFERRER_NOT_FOUND'); EXCEPTION WHEN OTHERS THEN NULL; END;
        END IF;
      END IF;

  EXCEPTION WHEN OTHERS THEN
      -- Catch logic errors
      BEGIN
        INSERT INTO public.debug_logs (process_name, message, details)
        VALUES ('handle_new_user', 'LOGIC_ERROR', jsonb_build_object('err', SQLERRM));
      EXCEPTION WHEN OTHERS THEN NULL; END;
  END;

  -- PROFILE INSERT
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
      
      BEGIN INSERT INTO public.debug_logs (process_name, message) VALUES ('handle_new_user', 'PROFILE_CREATED_SUCCESS'); EXCEPTION WHEN OTHERS THEN NULL; END;

  EXCEPTION WHEN OTHERS THEN
      -- CRITICAL LOGGING OF FAILURE
      BEGIN
        INSERT INTO public.debug_logs (process_name, message, details)
        VALUES ('handle_new_user', 'PROFILE_INSERT_FAILED', jsonb_build_object('err', SQLERRM));
      EXCEPTION WHEN OTHERS THEN NULL; END;
      -- We swallow the error so AUTH user is created, allowing us to see the log.
  END;

  RETURN new;
END;
$$;

-- 5. SAFELY ENSURE TRIGGER EXISTS (Do not drop)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END;
$$;
