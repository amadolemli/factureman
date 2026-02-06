-- FIX ADMIN FUNCTIONS V2 - RESOLVE AMBIGUITY
-- Précise explicitement les préfixes de table (au.id, p.id)

-- ============================================================
-- 1. FIX get_admin_user_list
-- ============================================================
DROP FUNCTION IF EXISTS get_admin_user_list();

CREATE OR REPLACE FUNCTION get_admin_user_list()
RETURNS TABLE (
  id text,
  email text,
  phone text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  app_metadata jsonb,
  user_metadata jsonb,
  is_banned boolean,
  app_credits integer,
  business_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid()::text 
    AND (profiles.is_admin = true OR profiles.is_super_admin = true)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    au.id::text,
    au.email::text, -- Explicit cast to avoid ambiguity issues
    au.phone::text,
    au.created_at,
    au.last_sign_in_at,
    au.raw_app_meta_data,
    au.raw_user_meta_data,
    COALESCE(p.is_banned, false),
    COALESCE(p.app_credits, 0),
    COALESCE(p.business_name, '')
  FROM auth.users au
  LEFT JOIN profiles p ON p.id = au.id::text
  ORDER BY au.created_at DESC;
END;
$$;

-- ============================================================
-- 2. FIX get_admin_logs
-- ============================================================
DROP FUNCTION IF EXISTS get_admin_logs();

CREATE OR REPLACE FUNCTION get_admin_logs()
RETURNS TABLE (
  id text,
  user_id text,
  action text,
  table_name text,
  record_id text,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  success boolean,
  error_message text,
  created_at timestamptz,
  admin_email text,
  target_user_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid()::text 
    AND (profiles.is_admin = true OR profiles.is_super_admin = true)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    al.id::text,
    al.user_id::text,
    al.action,
    al.table_name,
    al.record_id,
    al.old_values,
    al.new_values,
    al.ip_address,
    al.user_agent,
    al.success,
    al.error_message,
    al.created_at,
    au.email::text as admin_email,
    tu.email::text as target_user_email
  FROM audit_log al
  LEFT JOIN auth.users au ON au.id::text = al.user_id::text
  LEFT JOIN auth.users tu ON tu.id::text = al.record_id
  ORDER BY al.created_at DESC
  LIMIT 100;
END;
$$;

-- ============================================================
-- 3. FIX get_dashboard_stats (si vous l'avez)
-- ============================================================
DROP FUNCTION IF EXISTS get_dashboard_stats();

CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS TABLE (
  total_users integer,
  active_users_24h integer,
  total_credits_distributed bigint,
  total_credits_consumed bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid()::text 
    AND (profiles.is_admin = true OR profiles.is_super_admin = true)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::integer FROM profiles),
    (SELECT COUNT(*)::integer FROM auth.users WHERE last_sign_in_at > now() - interval '24 hours'),
    (SELECT COALESCE(SUM(app_credits), 0)::bigint FROM profiles),
    0::bigint; -- Placeholder for consumed credits if not tracked separately
END;
$$;
