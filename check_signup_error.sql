-- Check the latest debug logs (last 20 entries) to see why signup failed
SELECT 
    created_at, 
    process_name, 
    message, 
    details
FROM public.debug_logs
ORDER BY created_at DESC
LIMIT 20;

-- Also check users table to see if the user was partially created (requires admin rights view or auth schema access if possible, otherwise we rely on debug logs)
