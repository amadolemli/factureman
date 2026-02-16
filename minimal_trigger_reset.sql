-- EMERGENCY FIX: Drop the problematic trigger logic completely and restart with a minimal version
-- This confirms if the trigger logic is the cause.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Recreate the trigger function with absolute minimal logic (NO REFERRALS, NO DEBUG LOGGING)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, business_name, app_credits, bonuses_claimed)
  VALUES (new.id, 'Ma Nouvelle Boutique', 0, false);
  RETURN new;
END;
$$;

-- Reattach the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
