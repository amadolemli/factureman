-- check_bonus_result.sql
SELECT 
    p.id, 
    p.business_name, 
    p.app_credits, 
    p.bonuses_claimed,
    p.referred_by,
    p.created_at,
    u.phone_confirmed_at,
    u.encrypted_password IS NOT NULL as has_password
FROM 
    public.profiles p
JOIN 
    auth.users u ON p.id = u.id::text
ORDER BY 
    p.created_at DESC
LIMIT 5;

-- Also check debug logs for any "AWARDED" messages
SELECT * FROM public.debug_logs WHERE message LIKE '%AWARDED%' ORDER BY created_at DESC LIMIT 10;
