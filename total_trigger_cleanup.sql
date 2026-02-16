-- CLEAN SLATE: REMOVE ALL TRIGGERS ON auth.users
-- We likely have multiple conflicting triggers accumulated from previous attempts.
-- This script finds ALL of them and drops them.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT trigger_name FROM information_schema.triggers WHERE event_object_schema = 'auth' AND event_object_table = 'users') LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON auth.users CASCADE';
        RAISE NOTICE 'Dropped trigger: %', r.trigger_name;
    END LOOP;
END $$;

-- RESTORE ONLY THE MAIN SIGNUP TRIGGER
-- This is the "Safe" reboot version from before
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ref_code text;
  referrer_id uuid;
  new_referral_code text;
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
BEGIN
  -- 1. Generate Referral Code
  new_referral_code := '';
  FOR i IN 1..8 LOOP
    new_referral_code := new_referral_code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;

  -- 2. Find Referrer
  ref_code := NULLIF(TRIM(new.raw_user_meta_data->>'referral_code'), '');
  IF ref_code IS NOT NULL THEN
      SELECT id INTO referrer_id FROM public.profiles WHERE referral_code = ref_code LIMIT 1;
  END IF;

  -- 3. Create Profile
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
      0, 
      new_referral_code, 
      referrer_id, 
      false
  );

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Last resort fallback
  INSERT INTO public.profiles (id, business_name, app_credits, bonuses_claimed)
  VALUES (new.id, 'Erreur Creation', 0, false);
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
