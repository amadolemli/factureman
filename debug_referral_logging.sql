-- 1. Create Debug Logs Table
CREATE TABLE IF NOT EXISTS public.debug_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    process_name text,
    message text,
    details jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- 2. Allow public access for debugging (Temporary)
ALTER TABLE public.debug_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for debug" ON public.debug_logs;
CREATE POLICY "Enable all access for debug" ON public.debug_logs FOR ALL USING (true) WITH CHECK (true);

-- 3. Publish to Realtime (so localhost console sees it)
-- SAFE PUBLICATION SETUP: Adds table to existing publication or creates it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime FOR TABLE public.debug_logs;
  ELSE
    ALTER PUBLICATION supabase_realtime ADD TABLE public.debug_logs;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors (e.g. table already in publication)
  RAISE NOTICE 'Publication setup notice: %', SQLERRM;
END;
$$;


-- 4. Update the Trigger Function with Logging
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
  VALUES ('handle_new_user', 'Trigger fired: New User Signup', jsonb_build_object('user_id', new.id, 'meta', new.raw_user_meta_data));

  -- Generate Code
  ref_code := public.generate_unique_referral_code(new.id);
  
  -- Get Input
  input_code := NULLIF(TRIM(new.raw_user_meta_data->>'referral_code'), '');
  
  INSERT INTO public.debug_logs (process_name, message, details)
  VALUES ('handle_new_user', 'Processing Codes', jsonb_build_object('generated_new_code', ref_code, 'input_referral_code', input_code));

  -- Logic...
  BEGIN
    IF input_code IS NOT NULL THEN
      -- Find referrer
      SELECT id INTO referrer_id
      FROM public.profiles
      WHERE referral_code = upper(input_code);

      INSERT INTO public.debug_logs (process_name, message, details)
      VALUES ('handle_new_user', 'Referrer Search Result', jsonb_build_object('search_code', input_code, 'found_referrer_id', referrer_id));

      IF referrer_id = new.id THEN
        referrer_id := NULL;
        INSERT INTO public.debug_logs (process_name, message) VALUES ('handle_new_user', 'Self-referral blocked');
      END IF;

      IF referrer_id IS NOT NULL THEN
        UPDATE public.profiles
        SET app_credits = app_credits + 500
        WHERE id = referrer_id;
        
        INSERT INTO public.debug_logs (process_name, message, details)
        VALUES ('handle_new_user', 'BONUS APPLIED TO REFERRER', jsonb_build_object('referrer_id', referrer_id, 'amount', 500));
      ELSE
         INSERT INTO public.debug_logs (process_name, message, details) 
         VALUES ('handle_new_user', 'Referrer Not Found', jsonb_build_object('code_tried', input_code));
      END IF;
    ELSE
         INSERT INTO public.debug_logs (process_name, message) VALUES ('handle_new_user', 'No referral code provided by user');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.debug_logs (process_name, message, details)
    VALUES ('handle_new_user', 'EXCEPTION ERROR', jsonb_build_object('error', SQLERRM));
    RAISE WARNING 'Referral processing error: %', SQLERRM;
    referrer_id := NULL;
  END;

  -- Create Profile
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

  INSERT INTO public.debug_logs (process_name, message) VALUES ('handle_new_user', 'Profile created successfully');

  RETURN new;
END;
$$;
