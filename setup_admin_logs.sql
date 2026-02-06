-- ============================================================
-- ADMIN LOGS SYSTEM - Complete Setup
-- ============================================================
-- This script creates:
-- 1. The admin_logs table for audit trail
-- 2. The get_admin_logs() function to view logs
-- 3. Updates admin functions to log their actions
-- ============================================================

-- 1. CREATE ADMIN LOGS TABLE (AUDIT TRAIL)
CREATE TABLE IF NOT EXISTS public.admin_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id uuid REFERENCES auth.users(id),
    action text NOT NULL, -- 'GRANT_CREDIT', 'BAN_USER', 'UNBAN_USER', 'DELETE_USER', 'PROMOTE_ADMIN', 'DEMOTE_ADMIN'
    target_user_id uuid,
    details jsonb, -- Stores amount, reason, etc.
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Protect logs: Admins can READ, but NO ONE can UPDATE/DELETE logs (Immutability)
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view logs" ON public.admin_logs;
CREATE POLICY "Admins can view logs" 
ON public.admin_logs FOR SELECT 
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR is_super_admin = true))
);

-- 2. FUNCTION TO GET ADMIN LOGS (WITH NAMES)
CREATE OR REPLACE FUNCTION public.get_admin_logs()
RETURNS TABLE (
  id uuid,
  admin_id uuid,
  action text,
  target_user_id uuid,
  details jsonb,
  created_at timestamp with time zone,
  admin_business_name text,  -- Name of the admin who did the action
  target_business_name text  -- Name of the user affected
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
    pa.business_name as admin_business_name,
    pt.business_name as target_business_name
  FROM public.admin_logs l
  LEFT JOIN public.profiles pa ON l.admin_id = pa.id
  LEFT JOIN public.profiles pt ON l.target_user_id = pt.id
  ORDER BY l.created_at DESC
  LIMIT 100; -- Limit to last 100 actions for performance
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_admin_logs() TO authenticated;

-- 3. UPDATE GRANT_CREDITS FUNCTION TO LOG ACTIONS
CREATE OR REPLACE FUNCTION public.grant_credits(target_user_id uuid, amount integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_is_admin boolean;
BEGIN
  -- Verify Admin
  SELECT (is_admin OR is_super_admin) INTO caller_is_admin FROM public.profiles WHERE id = auth.uid();
  IF caller_is_admin IS NOT TRUE THEN RAISE EXCEPTION 'Access Denied'; END IF;

  -- Grant Credits
  UPDATE public.profiles SET app_credits = app_credits + amount WHERE id = target_user_id;
  
  -- LOG THE ACTION
  INSERT INTO public.admin_logs (admin_id, action, target_user_id, details)
  VALUES (auth.uid(), 'GRANT_CREDIT', target_user_id, jsonb_build_object('amount', amount));

  RETURN TRUE;
END;
$$;

-- 4. UPDATE TOGGLE_BAN FUNCTION TO LOG ACTIONS
CREATE OR REPLACE FUNCTION public.toggle_user_ban(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_id uuid;
  caller_is_admin boolean;
  target_is_super boolean;
  current_status boolean;
  new_status boolean;
BEGIN
  caller_id := auth.uid();
  
  SELECT (is_admin OR is_super_admin) INTO caller_is_admin FROM public.profiles WHERE id = caller_id;
  IF caller_is_admin IS NOT TRUE THEN RAISE EXCEPTION 'Access Denied'; END IF;

  SELECT is_banned, is_super_admin INTO current_status, target_is_super FROM public.profiles WHERE id = target_user_id;
  
  -- PROTECT SUPER ADMIN
  IF target_is_super IS TRUE THEN RAISE EXCEPTION 'SECURITY: Cannot ban a Super Admin.'; END IF;

  -- Toggle Ban
  new_status := NOT COALESCE(current_status, false);
  UPDATE public.profiles 
  SET is_banned = new_status
  WHERE id = target_user_id;

  -- LOG with clear action name
  INSERT INTO public.admin_logs (admin_id, action, target_user_id, details)
  VALUES (caller_id, 
          CASE WHEN new_status THEN 'BAN_USER' ELSE 'UNBAN_USER' END,
          target_user_id, 
          jsonb_build_object('new_status', new_status));

  RETURN TRUE;
END;
$$;

-- 5. UPDATE DELETE_USER FUNCTION TO LOG ACTIONS
CREATE OR REPLACE FUNCTION public.delete_user_data(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_id uuid;
  caller_is_super boolean;
  caller_is_admin boolean;
  target_is_super boolean;
  target_is_admin boolean;
BEGIN
  caller_id := auth.uid();

  -- Get Caller Permissions
  SELECT is_super_admin, is_admin INTO caller_is_super, caller_is_admin 
  FROM public.profiles WHERE id = caller_id;
  
  -- Get Target Status
  SELECT is_super_admin, is_admin INTO target_is_super, target_is_admin 
  FROM public.profiles WHERE id = target_user_id;

  -- RULE 1: Basic Access
  IF (caller_is_super IS NOT TRUE AND caller_is_admin IS NOT TRUE) THEN 
    RAISE EXCEPTION 'Access Denied.'; 
  END IF;

  -- RULE 2: Protect Super Admins (Anti-Coup)
  IF target_is_super IS TRUE THEN 
    RAISE EXCEPTION 'SECURITY ALERT: You cannot delete a Super Admin.'; 
  END IF;

  -- RULE 3: Admins cannot delete other Admins (Only Super Admin can)
  IF target_is_admin IS TRUE AND caller_is_super IS NOT TRUE THEN
    RAISE EXCEPTION 'Access Denied: Only Super Admin can delete other Admins.';
  END IF;

  -- EXECUTE DELETE
  DELETE FROM public.products WHERE user_id = target_user_id;
  DELETE FROM public.clients WHERE user_id = target_user_id;
  DELETE FROM public.invoices WHERE user_id = target_user_id;
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- LOG THE ACTION
  INSERT INTO public.admin_logs (admin_id, action, target_user_id, details)
  VALUES (caller_id, 'DELETE_USER', target_user_id, jsonb_build_object('reason', 'Manual Deletion via Panel'));

  RETURN TRUE;
END;
$$;

-- 6. UPDATE TOGGLE_ADMIN_ROLE FUNCTION TO LOG ACTIONS
CREATE OR REPLACE FUNCTION public.toggle_admin_role(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_is_super boolean;
  current_status boolean;
  new_status boolean;
BEGIN
  SELECT is_super_admin INTO caller_is_super FROM public.profiles WHERE id = auth.uid();
  IF caller_is_super IS NOT TRUE THEN RAISE EXCEPTION 'Access Denied: Super Admin Only'; END IF;

  SELECT is_admin INTO current_status FROM public.profiles WHERE id = target_user_id;
  new_status := NOT COALESCE(current_status, false);

  UPDATE public.profiles 
  SET is_admin = new_status
  WHERE id = target_user_id;

  -- LOG with clear action name
  INSERT INTO public.admin_logs (admin_id, action, target_user_id, details)
  VALUES (auth.uid(), 
          CASE WHEN new_status THEN 'PROMOTE_ADMIN' ELSE 'DEMOTE_ADMIN' END,
          target_user_id, 
          jsonb_build_object('new_admin_status', new_status));

  RETURN TRUE;
END;
$$;

-- ============================================================
-- VERIFICATION QUERIES (Run these to test)
-- ============================================================

-- Check if table was created
-- SELECT * FROM public.admin_logs LIMIT 10;

-- Check if function works (will return empty if no logs yet)
-- SELECT * FROM public.get_admin_logs();

-- Test creating a log entry (replace YOUR_USER_ID with an actual user ID)
-- INSERT INTO public.admin_logs (admin_id, action, target_user_id, details)
-- VALUES (auth.uid(), 'TEST', 'YOUR_USER_ID', '{"test": true}');
