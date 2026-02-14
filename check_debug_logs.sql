-- CHECK DEBUG LOGS
-- Run this script in the Supabase SQL Editor to see the latest server-side logs.
-- This is useful if the browser console isn't showing anything.

SELECT 
    created_at, 
    process_name, 
    message, 
    details 
FROM 
    public.debug_logs 
ORDER BY 
    created_at DESC 
LIMIT 50;
