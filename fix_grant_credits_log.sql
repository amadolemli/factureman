-- FIX GRANT CREDITS LOGGING
-- Updates grant_credits to write to admin_logs table which is used by the Admin Panel

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
  
  -- Log the operation to admin_logs (Correct Table)
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
