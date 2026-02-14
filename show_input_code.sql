-- SHOW ACTUAL INPUT
-- Run this to prove that the database received the correct code.

SELECT 
    id,
    email,
    raw_user_meta_data->>'referral_code' as CODE_YOU_ENTERED,
    created_at
FROM 
    auth.users 
ORDER BY 
    created_at DESC 
LIMIT 1;
