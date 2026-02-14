-- ANALYZE LAST SIGNUP & LOGS
-- Run this to see what happened with the most recent user and the debug logs.

-- 1. Most recent user profile
SELECT 
    id, 
    business_name, 
    app_credits, 
    referral_code, 
    referred_by, 
    created_at 
FROM 
    public.profiles 
ORDER BY 
    created_at DESC 
LIMIT 1;

-- 2. Recent Debug Logs
SELECT 
    created_at, 
    process_name, 
    message, 
    details 
FROM 
    public.debug_logs 
ORDER BY 
    created_at DESC 
LIMIT 20;
