-- FIX ADMIN FUNCTIONS LOGGING
-- 1. Updates grant_credits to log to admin_logs
-- 2. Updates delete_user_data to log to admin_logs
-- 3. Ensures both use TEXT IDs for compatibility

-- ============================================================
-- 1. FIX grant_credits with proper logging
-- ============================================================
CREATE OR REPLACE FUNCTION public.grant_credits(target_user_id text, amount integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_is_admin boolean;
  target_is_banned boolean;
  admin_id text;
BEGIN
  admin_id := auth.uid()::text;

  -- Validation
  IF amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF amount > 1000000 THEN RAISE EXCEPTION 'Amount exceeds maximum allowed'; END IF;
  
  -- Authorization check
  SELECT (is_admin OR is_super_admin) INTO caller_is_admin 
  FROM public.profiles 
  WHERE id = admin_id;
  
  IF caller_is_admin IS NOT TRUE THEN 
    RAISE EXCEPTION 'Access Denied: Admin privileges required'; 
  END IF;
  
  -- Check if target is banned
  SELECT is_banned INTO target_is_banned
  FROM public.profiles
  WHERE id = target_user_id;
  
  IF target_is_banned IS TRUE THEN
    RAISE EXCEPTION 'Cannot grant credits to banned user';
  END IF;

  -- Grant credits
  UPDATE public.profiles 
  SET app_credits = app_credits + amount 
  WHERE id = target_user_id;
  
  -- Log the operation to admin_logs
  INSERT INTO public.admin_logs (
    admin_id, 
    action, 
    target_user_id, 
    details
  )
  VALUES (
    admin_id, 
    'GRANT_CREDIT', 
    target_user_id, 
    jsonb_build_object('amount', amount)
  );
  
  RETURN true;
END;
$$;

-- ============================================================
-- 2. FIX delete_user_data with logging
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_user_data(target_user_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_can_delete boolean;
  admin_id text;
BEGIN
  admin_id := auth.uid()::text;

  -- Check permissions (Admins or Super Admins)
  SELECT (is_admin OR is_super_admin) INTO caller_can_delete 
  FROM public.profiles 
  WHERE id = admin_id;
  
  IF caller_can_delete IS NOT TRUE THEN 
    RAISE EXCEPTION 'Access Denied: Only Admins can delete users.'; 
  END IF;

  -- Log BEFORE deleting (so we have record even if profile is gone from join)
  INSERT INTO public.admin_logs (
    admin_id, 
    action, 
    target_user_id, 
    details
  )
  VALUES (
    admin_id, 
    'DELETE_USER', 
    target_user_id, 
    jsonb_build_object('reason', 'Manual Deletion via Admin Panel')
  );

  -- Delete associated data
  DELETE FROM public.products WHERE user_id = target_user_id;
  DELETE FROM public.clients WHERE user_id = target_user_id;
  DELETE FROM public.invoices WHERE user_id = target_user_id;
  
  -- Delete profile
  DELETE FROM public.profiles WHERE id = target_user_id;

  RETURN true;
END;
$$;
