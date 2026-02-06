-- FIX ADMIN FUNCTIONS FOR TEXT IDs
-- Modifie les fonctions admin pour fonctionner avec les IDs en TEXT

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
    WHERE id = auth.uid()::text 
    AND (is_admin = true OR is_super_admin = true)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    au.id::text,
    au.email,
    au.phone,
    au.created_at,
    au.last_sign_in_at,
    au.raw_app_meta_data,
    au.raw_user_meta_data,
    p.is_banned,
    p.app_credits,
    p.business_name
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
    WHERE id = auth.uid()::text 
    AND (is_admin = true OR is_super_admin = true)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    al.id,
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
    au.email as admin_email,
    tu.email as target_user_email
  FROM audit_log al
  LEFT JOIN auth.users au ON au.id::text = al.user_id::text
  LEFT JOIN auth.users tu ON tu.id::text = al.record_id
  ORDER BY al.created_at DESC
  LIMIT 100;
END;
$$;

-- ============================================================
-- 3. FIX toggle_user_ban (si nécessaire)
-- ============================================================
CREATE OR REPLACE FUNCTION toggle_user_ban(target_user_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_is_super boolean;
  current_ban_status boolean;
BEGIN
  -- Verify super admin
  SELECT is_super_admin INTO caller_is_super 
  FROM profiles 
  WHERE id = auth.uid()::text;
  
  IF caller_is_super IS NOT TRUE THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  -- Get current status
  SELECT is_banned INTO current_ban_status
  FROM profiles
  WHERE id = target_user_id;
  
  -- Toggle
  UPDATE profiles 
  SET is_banned = NOT current_ban_status 
  WHERE id = target_user_id;
  
  -- Log
  INSERT INTO admin_logs (admin_id, action, target_user_id, details)
  VALUES (
    auth.uid()::text,
    CASE WHEN current_ban_status THEN 'unban_user' ELSE 'ban_user' END,
    target_user_id,
    jsonb_build_object('previous_status', current_ban_status)
  );

  RETURN true;
END;
$$;
