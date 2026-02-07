
-- Drop the function first because we are changing its return type (adding columns)
DROP FUNCTION IF EXISTS public.get_admin_logs();

-- Recreate the function with the new columns (admin_phone, target_phone)
CREATE OR REPLACE FUNCTION public.get_admin_logs()
RETURNS TABLE (
  id uuid,
  admin_id uuid,
  action text,
  target_user_id uuid,
  details jsonb,
  created_at timestamp with time zone,
  admin_business_name text,
  admin_phone text,       -- New column
  target_business_name text,
  target_phone text       -- New column
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check permission
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR is_super_admin = true)) THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  RETURN QUERY
  SELECT 
    l.id,
    l.admin_id,
    l.action,
    l.target_user_id,
    l.details,
    l.created_at,
    COALESCE(pa.business_name, 'Admin Inconnu') as admin_business_name,
    ua.phone::text as admin_phone,
    COALESCE(pt.business_name, 'Utilisateur Inconnu') as target_business_name,
    ut.phone::text as target_phone
  FROM public.admin_logs l
  LEFT JOIN public.profiles pa ON l.admin_id = pa.id
  LEFT JOIN auth.users ua ON l.admin_id = ua.id
  LEFT JOIN public.profiles pt ON l.target_user_id = pt.id
  LEFT JOIN auth.users ut ON l.target_user_id = ut.id
  ORDER BY l.created_at DESC
  LIMIT 100;
END;
$$;
