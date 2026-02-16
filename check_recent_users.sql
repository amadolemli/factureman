-- 1. Check recent profiles and their referral status
SELECT 
    id, 
    business_name, 
    app_credits, 
    referral_code, 
    referred_by, 
    bonuses_claimed,
    created_at
FROM 
    public.profiles
ORDER BY 
    created_at DESC
LIMIT 5;

-- 2. Check auth.users status for the last 5 users
-- Note: need to run this with high privilege or via a function if possible
-- Since I can't directly select from auth.users easily without a helper function in some setups,
-- I will check if the user exists in public.profiles first.

-- 3. Check for any errors in debug logs
SELECT * FROM public.debug_logs ORDER BY created_at DESC LIMIT 10;
