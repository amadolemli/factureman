-- SUPER DEBUG REFERRAL FIX
-- This script resets the debugging infrastructure to ensure we can see what's wrong.

-- 1. RESET DEBUG LOGS TABLE
DROP TABLE IF EXISTS public.debug_logs;
CREATE TABLE public.debug_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    process_name text,
    message text,
    details jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- disable RLS to guarantee no permission errors
ALTER TABLE public.debug_logs DISABLE ROW LEVEL SECURITY;

-- Add to publication for realtime
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime FOR TABLE public.debug_logs;
  ELSE
    ALTER PUBLICATION supabase_realtime ADD TABLE public.debug_logs;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore
END;
$$;

-- 2. ENSURE PROFILES COLUMNS
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bonuses_claimed boolean DEFAULT false;

-- 3. ENSURE HELPER FUNCTION
CREATE OR REPLACE FUNCTION public.generate_unique_referral_code(user_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN upper(substring(md5(user_id::text) from 1 for 8));
END;
$$;

-- 4. REDEFINE THE TRIGGER FUNCTION WITH "SAFE" LOGGING
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
  -- SAFE LOG START
  BEGIN
    INSERT INTO public.debug_logs (process_name, message, details)
    VALUES ('handle_new_user', 'START_TRIGGER', jsonb_build_object('user_id', new.id));
  EXCEPTION WHEN OTHERS THEN 
    NULL; -- If logging fails, keep going!
  END;

  -- MAIN LOGIC BLOCK
  BEGIN
      -- Generate Code
      ref_code := public.generate_unique_referral_code(new.id);
      
      -- Get Input
      input_code := NULLIF(TRIM(new.raw_user_meta_data->>'referral_code'), '');
      
      -- SAFE LOG INPUT
      BEGIN
        INSERT INTO public.debug_logs (process_name, message, details)
        VALUES ('handle_new_user', 'INPUT_DATA', jsonb_build_object('code', ref_code, 'input', input_code));
      EXCEPTION WHEN OTHERS THEN NULL; END;

      -- Referral Check
      IF input_code IS NOT NULL THEN
        -- Try to find referrer
        BEGIN
            SELECT id INTO referrer_id FROM public.profiles WHERE referral_code = upper(input_code);
        EXCEPTION WHEN OTHERS THEN
            BEGIN INSERT INTO public.debug_logs (process_name, message, details) VALUES ('handle_new_user', 'REFERRER_LOOKUP_FAIL', jsonb_build_object('err', SQLERRM)); EXCEPTION WHEN OTHERS THEN NULL; END;
        END;

        IF referrer_id = new.id THEN
            referrer_id := NULL;
        END IF;

        IF referrer_id IS NOT NULL THEN
            UPDATE public.profiles SET app_credits = app_credits + 500 WHERE id = referrer_id;
            BEGIN INSERT INTO public.debug_logs (process_name, message) VALUES ('handle_new_user', 'BONUS_APPLIED'); EXCEPTION WHEN OTHERS THEN NULL; END;
        ELSE
            BEGIN INSERT INTO public.debug_logs (process_name, message) VALUES ('handle_new_user', 'REFERRER_NOT_FOUND'); EXCEPTION WHEN OTHERS THEN NULL; END;
        END IF;
      END IF;

  EXCEPTION WHEN OTHERS THEN
      -- Catch any logic error
      BEGIN
        INSERT INTO public.debug_logs (process_name, message, details)
        VALUES ('handle_new_user', 'CRITICAL_LOGIC_ERROR', jsonb_build_object('err', SQLERRM));
      EXCEPTION WHEN OTHERS THEN NULL; END;
  END;

  -- PROFILE INSERT BLOCK
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
      -- CRITICAL: Log why profile failed!
      BEGIN
        INSERT INTO public.debug_logs (process_name, message, details)
        VALUES ('handle_new_user', 'PROFILE_INSERT_FAILED', jsonb_build_object('err', SQLERRM));
      EXCEPTION WHEN OTHERS THEN NULL; END;
      
      -- Do not raise exception, let auth user exist
  END;

  RETURN new;
END;
$$;

-- 5. RESET THE TRIGGER ITSELF (To be 100% sure we are using the new function)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
