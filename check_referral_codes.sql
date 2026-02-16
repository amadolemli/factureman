-- DIAGNOSTIC: Vérifier les codes de parrainage des utilisateurs
-- Check which users have referral codes and which don't

SELECT 
  id,
  business_name,
  referral_code,
  referred_by,
  app_credits,
  bonuses_claimed,
  created_at
FROM public.profiles
ORDER BY created_at DESC
LIMIT 10;

-- Check specifically if the newest user has a referral code
SELECT 
  id,
  business_name,
  CASE 
    WHEN referral_code IS NULL THEN '❌ PAS DE CODE'
    WHEN referral_code = '' THEN '❌ CODE VIDE'
    ELSE '✅ ' || referral_code
  END as code_status,
  app_credits
FROM public.profiles
ORDER BY created_at DESC
LIMIT 1;
