-- Make sure the debug_logs table exists and is accessible
CREATE TABLE IF NOT EXISTS public.debug_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    process_name text,
    message text,
    details jsonb
);

-- Grant permissions (CRITICAL: if trigger runs as SECURITY DEFINER, it needs insert rights to this table)
GRANT INSERT ON public.debug_logs TO postgres, service_role, authenticated, anon;
GRANT SELECT ON public.debug_logs TO postgres, service_role, authenticated, anon;

-- Also verify profiles table allows insertion of 'referral_code' field if missing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bonuses_claimed boolean DEFAULT false;
