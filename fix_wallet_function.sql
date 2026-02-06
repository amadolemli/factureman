-- FIX WALLET FUNCTIONS FOR TEXT IDs
-- Adapts functions to work with the new TEXT based IDs in profiles and other tables.

-- ============================================================
-- 1. FIX verify_wallet_integrity
-- ============================================================
DROP FUNCTION IF EXISTS verify_wallet_integrity(integer);

CREATE OR REPLACE FUNCTION verify_wallet_integrity(claimed_wallet_credits integer)
RETURNS TABLE(
    server_balance integer, 
    max_allowed_wallet integer,
    is_valid boolean,
    corrected_wallet integer
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    current_server_credits integer;
BEGIN
    -- Get current server balance
    -- FIX: Cast auth.uid() to text to match profiles.id
    SELECT app_credits INTO current_server_credits
    FROM profiles 
    WHERE id = auth.uid()::text;
    
    -- Wallet should never exceed server balance
    -- Allow some grace (50 credits) for sync delays
    
    -- Log the check
    -- FIX: Cast auth.uid() to text for insert
    INSERT INTO wallet_syncs (user_id, server_credits, client_claimed_credits, is_valid)
    VALUES (
        auth.uid()::text, 
        current_server_credits, 
        claimed_wallet_credits,
        claimed_wallet_credits <= current_server_credits + 50
    );
    
    -- Return validation result
    RETURN QUERY SELECT 
        current_server_credits,
        LEAST(current_server_credits, 500) as max_allowed_wallet, -- Cap wallet at 500
        (claimed_wallet_credits <= current_server_credits + 50) as is_valid,
        LEAST(claimed_wallet_credits, current_server_credits) as corrected_wallet;
END;
$$;

-- ============================================================
-- 2. FIX deduct_credits
-- ============================================================
CREATE OR REPLACE FUNCTION public.deduct_credits(amount integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER 
AS $$
DECLARE
  current_credits integer;
  current_user_id text; -- FIX: changed to text
  user_is_banned boolean;
BEGIN
  current_user_id := auth.uid()::text; -- FIX: cast to text
  
  -- Rate limiting (assumes rate_limits still handles auth.uid() correctly or auto-casts)
  IF NOT check_rate_limit('deduct_credits', 100, interval '1 hour') THEN
    RAISE EXCEPTION 'Rate limit exceeded: Too many credit operations';
  END IF;
  
  SELECT app_credits, is_banned INTO current_credits, user_is_banned
  FROM public.profiles WHERE id = current_user_id;

  IF user_is_banned IS TRUE THEN 
    RAISE EXCEPTION 'Account banned';
  END IF;

  IF current_credits >= amount THEN
    UPDATE public.profiles 
    SET app_credits = current_credits - amount 
    WHERE id = current_user_id;
    RETURN true;
  ELSE
    RAISE EXCEPTION 'Insufficient credits: have %, need %', current_credits, amount;
  END IF;
END;
$$;

-- ============================================================
-- 3. FIX grant_credits
-- ============================================================
-- Drop old version with uuid signature to avoid confusion
DROP FUNCTION IF EXISTS public.grant_credits(uuid, integer);

CREATE OR REPLACE FUNCTION public.grant_credits(target_user_id text, amount integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_is_admin boolean;
  target_is_banned boolean;
BEGIN
  -- Validation
  IF amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF amount > 1000000 THEN RAISE EXCEPTION 'Amount exceeds maximum allowed'; END IF;
  
  -- Authorization check
  -- FIX: Cast auth.uid() to text
  SELECT (is_admin OR is_super_admin) INTO caller_is_admin 
  FROM public.profiles 
  WHERE id = auth.uid()::text;
  
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
  
  -- Log the operation
  -- ensure audit_log can take text ID if necessary, mostly jsonb is fine
  INSERT INTO audit_log (user_id, action, table_name, record_id, new_values)
  VALUES (
    auth.uid(), -- audit_log.user_id is likely still UUID referencing auth.users, so keep as UUID
    'GRANT_CREDITS',
    'profiles',
    target_user_id,
    jsonb_build_object('amount', amount, 'target_user', target_user_id)
  );
  
  RETURN true;
END;
$$;
