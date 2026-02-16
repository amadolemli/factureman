-- CHECK REFERRAL ISSUE
-- This script checks the debug logs and profile schema to diagnose the type mismatch error

-- 1. Check recent debug logs to see the exact error
SELECT 
  created_at,
  process_name,
  message,
  details
FROM public.debug_logs 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC 
LIMIT 20;

-- 2. Check the schema of profiles table to see column types
SELECT 
  column_name,
  data_type,
  udt_name
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
  AND column_name IN ('id', 'referral_code', 'referred_by');

-- 3. Check if there's any profile with the referral code that was used
-- (Replace 'REFERRAL_CODE_USED' with the actual code the user entered)
SELECT 
  id,
  business_name,
  referral_code,
  referred_by,
  app_credits,
  bonuses_claimed
FROM public.profiles
LIMIT 10;
