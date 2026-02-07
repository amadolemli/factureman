-- update_get_admin_logs.sql
-- Fixed: Support TEXT IDs and join with auth.users for phone numbers

-- Drop the existing function first to allow changing the return type
DROP FUNCTION IF EXISTS public.get_admin_logs();

CREATE OR REPLACE FUNCTION public.get_admin_logs()
RETURNS TABLE (
  log_id text,
  admin_id text,
  action text,
  target_user_id text,
  details jsonb,
  created_at timestamp with time zone,
  admin_business_name text,  
  admin_phone text,
  target_business_name text,
  target_phone text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_can_view boolean;
BEGIN
  -- Check permission (Cast auth.uid() to text to match profiles.id)
  SELECT (p.is_admin OR p.is_super_admin) INTO caller_can_view
  FROM public.profiles p 
  WHERE p.id = auth.uid()::text;
  
  IF caller_can_view IS NOT TRUE THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  RETURN QUERY
  SELECT 
    l.id AS log_id,
    l.admin_id,
    l.action,
    l.target_user_id,
    l.details,
    l.created_at,
    COALESCE(pa.business_name, 'Admin Inconnu') AS admin_business_name,
    COALESCE(ua.phone, '')::text AS admin_phone,
    COALESCE(pt.business_name, 'Utilisateur Supprimé') AS target_business_name,
    COALESCE(ut.phone, '')::text AS target_phone
  FROM public.admin_logs l
  LEFT JOIN public.profiles pa ON l.admin_id = pa.id
  -- Join with auth.users requires casting search ID to UUID or auth ID to text
  LEFT JOIN auth.users ua ON l.admin_id = ua.id::text
  LEFT JOIN public.profiles pt ON l.target_user_id = pt.id
  LEFT JOIN auth.users ut ON l.target_user_id = ut.id::text
  ORDER BY l.created_at DESC
  LIMIT 100;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_admin_logs() TO authenticated;
