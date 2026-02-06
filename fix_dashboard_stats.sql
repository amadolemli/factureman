-- FIX ADMIN DASHBOARD STATS
-- Corrige le nom de la fonction et les types (TEXT vs UUID)

DROP FUNCTION IF EXISTS get_admin_dashboard_stats();
DROP FUNCTION IF EXISTS get_dashboard_stats(); -- Nettoyage

CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS TABLE (
  total_users integer,
  active_users_24h integer,
  total_credits_distributed bigint,
  blocked_users integer,
  active_admins integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check admin permission
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid()::text 
    AND (profiles.is_admin = true OR profiles.is_super_admin = true)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    -- Total Users
    (SELECT COUNT(*)::integer FROM profiles),
    
    -- Active Users (last 24h)
    (SELECT COUNT(*)::integer FROM auth.users WHERE last_sign_in_at > now() - interval '24 hours'),
    
    -- Total Credits
    (SELECT COALESCE(SUM(app_credits), 0)::bigint FROM profiles),
    
    -- Blocked Users
    (SELECT COUNT(*)::integer FROM profiles WHERE is_banned = true),
    
    -- Active Admins
    (SELECT COUNT(*)::integer FROM profiles WHERE is_admin = true OR is_super_admin = true);
END;
$$;
