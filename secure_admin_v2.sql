-- ============================================================
-- SECURITY UPGRADE & AUDIT LOGS
-- ============================================================

-- 1. CREATE ADMIN LOGS TABLE (AUDIT TRAIL)
CREATE TABLE IF NOT EXISTS public.admin_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id uuid REFERENCES auth.users(id),
    action text NOT NULL, -- 'GRANT_CREDIT', 'BAN_USER', 'DELETE_USER', 'PROMOTE_ADMIN'
    target_user_id uuid,
    details jsonb, -- Stores amount, reason, etc.
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Protect logs: Admins can READ, but NO ONE can UPDATE/DELETE logs (Immutability)
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view logs" 
ON public.admin_logs FOR SELECT 
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR is_super_admin = true))
);

-- 2. SECURE 'DELETE_USER' FUNCTION (Anti-Coup d'État)
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

-- 3. SECURE 'GRANT_CREDITS' WITH LOGGING
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

-- 4. SECURE 'TOGGLE_BAN' WITH LOGGING & PROTECTION
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
BEGIN
  caller_id := auth.uid();
  
  SELECT (is_admin OR is_super_admin) INTO caller_is_admin FROM public.profiles WHERE id = caller_id;
  IF caller_is_admin IS NOT TRUE THEN RAISE EXCEPTION 'Access Denied'; END IF;

  SELECT is_banned, is_super_admin INTO current_status, target_is_super FROM public.profiles WHERE id = target_user_id;
  
  -- PROTECT SUPER ADMIN
  IF target_is_super IS TRUE THEN RAISE EXCEPTION 'SECURITY: Cannot ban a Super Admin.'; END IF;

  -- Toggle Ban
  UPDATE public.profiles 
  SET is_banned = NOT COALESCE(current_status, false)
  WHERE id = target_user_id;

  -- LOG
  INSERT INTO public.admin_logs (admin_id, action, target_user_id, details)
  VALUES (caller_id, 'TOGGLE_BAN', target_user_id, jsonb_build_object('new_status', NOT COALESCE(current_status, false)));

  RETURN TRUE;
END;
$$;
