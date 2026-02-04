-- ====================================================================
-- CRITICAL SECURITY FIXES FOR FACTUREMAN APP
-- Apply these fixes IMMEDIATELY to secure your application
-- ====================================================================

-- ============================================================
-- FIX 1: SECURE STORAGE POLICIES (Path-Based Authentication)
-- ============================================================

-- Drop old insecure policies
DROP POLICY IF EXISTS "Users can upload their own invoices" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own invoices" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own invoices" ON storage.objects;

-- Create secure policies using path-based checking
CREATE POLICY "Users can upload to their own folder"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'invoices' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'invoices' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can read their own files"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'invoices' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Public access to own files"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'invoices' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);


-- ============================================================
-- FIX 2: WALLET VERIFICATION & ANTI-FRAUD SYSTEM
-- ============================================================

-- Table to track wallet sync history
CREATE TABLE IF NOT EXISTS wallet_syncs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users NOT NULL,
    server_credits integer NOT NULL,
    client_claimed_credits integer,
    is_valid boolean,
    synced_at timestamp with time zone DEFAULT now()
);

ALTER TABLE wallet_syncs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own wallet syncs"
ON wallet_syncs FOR SELECT
USING (auth.uid() = user_id);


-- Function to verify wallet integrity
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
    SELECT app_credits INTO current_server_credits
    FROM profiles 
    WHERE id = auth.uid();
    
    -- Wallet should never exceed server balance
    -- Allow some grace (50 credits) for sync delays
    
    -- Log the check
    INSERT INTO wallet_syncs (user_id, server_credits, client_claimed_credits, is_valid)
    VALUES (
        auth.uid(), 
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
-- FIX 3: ENHANCED RATE LIMITING SYSTEM
-- ============================================================

-- Rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users NOT NULL,
    action_type text NOT NULL,
    last_action timestamp with time zone DEFAULT now(),
    action_count integer DEFAULT 1,
    window_start timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, action_type)
);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- No direct access, only via functions
CREATE POLICY "No direct access" ON rate_limits FOR ALL USING (false);


-- Generic rate limiter
CREATE OR REPLACE FUNCTION check_rate_limit(
    action_name text,
    max_actions integer,
    time_window interval
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    current_count integer;
    window_expired boolean;
BEGIN
    -- Check if window has expired
    SELECT (now() - window_start) > time_window INTO window_expired
    FROM rate_limits
    WHERE user_id = auth.uid() AND action_type = action_name;
    
    -- Reset if window expired or doesn't exist
    IF window_expired IS NULL OR window_expired THEN
        INSERT INTO rate_limits (user_id, action_type, action_count, window_start)
        VALUES (auth.uid(), action_name, 1, now())
        ON CONFLICT (user_id, action_type) DO UPDATE
        SET action_count = 1, window_start = now(), last_action = now();
        
        RETURN true;
    END IF;
    
    -- Get current count
    SELECT action_count INTO current_count
    FROM rate_limits
    WHERE user_id = auth.uid() AND action_type = action_name;
    
    -- Check limit
    IF current_count >= max_actions THEN
        RETURN false;
    END IF;
    
    -- Increment counter
    UPDATE rate_limits
    SET action_count = action_count + 1, last_action = now()
    WHERE user_id = auth.uid() AND action_type = action_name;
    
    RETURN true;
END;
$$;


-- Update deduct_credits to use rate limiting
CREATE OR REPLACE FUNCTION public.deduct_credits(amount integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER 
AS $$
DECLARE
  current_credits integer;
  current_user_id uuid;
  user_is_banned boolean;
BEGIN
  current_user_id := auth.uid();
  
  -- Rate limiting: Max 100 deductions per hour
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
-- FIX 4: COMPREHENSIVE AUDIT LOGGING
-- ============================================================

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users,
    action text NOT NULL,
    table_name text,
    record_id text,
    old_values jsonb,
    new_values jsonb,
    ip_address inet,
    user_agent text,
    success boolean DEFAULT true,
    error_message text,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can view all logs, users can view their own
CREATE POLICY "Admins view all audit logs"
ON audit_log FOR SELECT
USING (
    (SELECT is_admin OR is_super_admin FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Users view own audit logs"
ON audit_log FOR SELECT
USING (auth.uid() = user_id);


-- Generic audit trigger
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (user_id, action, table_name, record_id, old_values)
        VALUES (
            auth.uid(),
            'DELETE',
            TG_TABLE_NAME,
            OLD.id::text,
            to_jsonb(OLD)
        );
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (user_id, action, table_name, record_id, old_values, new_values)
        VALUES (
            auth.uid(),
            'UPDATE',
            TG_TABLE_NAME,
            NEW.id::text,
            to_jsonb(OLD),
            to_jsonb(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (user_id, action, table_name, record_id, new_values)
        VALUES (
            auth.uid(),
            'INSERT',
            TG_TABLE_NAME,
            NEW.id::text,
            to_jsonb(NEW)
        );
        RETURN NEW;
    END IF;
END;
$$;


-- Apply audit triggers to sensitive tables
DROP TRIGGER IF EXISTS profiles_audit ON profiles;
CREATE TRIGGER profiles_audit 
AFTER INSERT OR UPDATE OR DELETE ON profiles
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS invoices_audit ON invoices;
CREATE TRIGGER invoices_audit 
AFTER INSERT OR UPDATE OR DELETE ON invoices
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS products_audit ON products;
CREATE TRIGGER products_audit 
AFTER INSERT OR UPDATE OR DELETE ON products
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS clients_audit ON clients;
CREATE TRIGGER clients_audit 
AFTER INSERT OR UPDATE OR DELETE ON clients
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();


-- ============================================================
-- FIX 5: SUPER ADMIN CONTROLS & AUDIT
-- ============================================================

-- Super admin promotion log
CREATE TABLE IF NOT EXISTS super_admin_promotions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    promoted_user_id uuid REFERENCES auth.users NOT NULL,
    promoted_by uuid REFERENCES auth.users,
    justification text,
    promoted_at timestamp with time zone DEFAULT now()
);

ALTER TABLE super_admin_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view promotions"
ON super_admin_promotions FOR SELECT
USING (
    (SELECT is_super_admin FROM profiles WHERE id = auth.uid())
);


-- Secure super admin promotion function
CREATE OR REPLACE FUNCTION promote_to_super_admin(
    target_id uuid,
    reason text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    caller_is_super boolean;
BEGIN
    -- Only existing super admins can promote
    SELECT is_super_admin INTO caller_is_super 
    FROM profiles 
    WHERE id = auth.uid();
    
    IF caller_is_super IS NOT TRUE THEN
        RAISE EXCEPTION 'Unauthorized: Only Super Admins can promote';
    END IF;
    
    -- Check if target exists
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = target_id) THEN
        RAISE EXCEPTION 'Target user not found';
    END IF;
    
    -- Log the promotion
    INSERT INTO super_admin_promotions (promoted_user_id, promoted_by, justification)
    VALUES (target_id, auth.uid(), reason);
    
    -- Promote
    UPDATE profiles 
    SET is_super_admin = true 
    WHERE id = target_id;
    
    RETURN true;
END;
$$;


-- ============================================================
-- FIX 6: ENHANCED GRANT CREDITS WITH VALIDATION
-- ============================================================

CREATE OR REPLACE FUNCTION public.grant_credits(target_user_id uuid, amount integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_is_admin boolean;
  target_is_banned boolean;
BEGIN
  -- Validation: Amount must be positive and reasonable
  IF amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  
  IF amount > 1000000 THEN
    RAISE EXCEPTION 'Amount exceeds maximum allowed (1,000,000)';
  END IF;
  
  -- Rate limiting: Max 50 grant operations per hour
  IF NOT check_rate_limit('grant_credits', 50, interval '1 hour') THEN
    RAISE EXCEPTION 'Rate limit exceeded: Too many grant operations';
  END IF;

  -- Authorization check
  SELECT (is_admin OR is_super_admin) INTO caller_is_admin 
  FROM public.profiles 
  WHERE id = auth.uid();
  
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
  INSERT INTO audit_log (user_id, action, table_name, record_id, new_values)
  VALUES (
    auth.uid(),
    'GRANT_CREDITS',
    'profiles',
    target_user_id::text,
    jsonb_build_object('amount', amount, 'target_user', target_user_id)
  );
  
  RETURN true;
END;
$$;


-- ============================================================
-- FIX 7: FAILED LOGIN TRACKING (Brute Force Protection)
-- ============================================================

CREATE TABLE IF NOT EXISTS failed_login_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    phone text NOT NULL,
    ip_address inet,
    attempted_at timestamp with time zone DEFAULT now()
);

ALTER TABLE failed_login_attempts ENABLE ROW LEVEL SECURITY;

-- No direct access
CREATE POLICY "No direct access to failed logins" 
ON failed_login_attempts FOR ALL 
USING (false);


-- Function to check if phone is locked out
CREATE OR REPLACE FUNCTION check_login_attempts(phone_number text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    recent_failures integer;
BEGIN
    -- Count failures in last 15 minutes
    SELECT COUNT(*) INTO recent_failures
    FROM failed_login_attempts
    WHERE phone = phone_number 
    AND attempted_at > now() - interval '15 minutes';
    
    -- Lock out after 5 failed attempts
    IF recent_failures >= 5 THEN
        RETURN false;
    END IF;
    
    RETURN true;
END;
$$;


-- Function to record failed login
CREATE OR REPLACE FUNCTION record_failed_login(phone_number text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO failed_login_attempts (phone)
    VALUES (phone_number);
    
    -- Clean up old attempts (older than 1 hour)
    DELETE FROM failed_login_attempts
    WHERE attempted_at < now() - interval '1 hour';
END;
$$;


-- ============================================================
-- FIX 8: INPUT VALIDATION CONSTRAINTS
-- ============================================================

-- Add constraints to profiles table
ALTER TABLE profiles 
ADD CONSTRAINT app_credits_positive CHECK (app_credits >= 0),
ADD CONSTRAINT app_credits_max CHECK (app_credits <= 10000000);

-- Add constraints to invoices
ALTER TABLE invoices
ADD CONSTRAINT total_amount_positive CHECK (total_amount >= 0),
ADD CONSTRAINT amount_paid_positive CHECK (amount_paid >= 0),
ADD CONSTRAINT amount_paid_not_over_total CHECK (amount_paid <= total_amount);

-- Add constraints to products
ALTER TABLE products
ADD CONSTRAINT price_positive CHECK (price >= 0),
ADD CONSTRAINT stock_positive CHECK (stock >= 0);


-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Run these to verify fixes were applied correctly:

-- 1. Check storage policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';

-- 2. Check rate limit table
SELECT COUNT(*) as rate_limit_table_exists 
FROM information_schema.tables 
WHERE table_name = 'rate_limits';

-- 3. Check audit log table
SELECT COUNT(*) as audit_log_table_exists 
FROM information_schema.tables 
WHERE table_name = 'audit_log';

-- 4. Check triggers
SELECT tgname, tgrelid::regclass, proname 
FROM pg_trigger 
JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid
WHERE tgname LIKE '%audit%';

-- 5. Test wallet verification
-- SELECT * FROM verify_wallet_integrity(100);

-- 6. Test rate limiting
-- SELECT check_rate_limit('test_action', 5, interval '1 minute');


-- ============================================================
-- COMPLETE!
-- ============================================================
-- All critical security fixes have been applied.
-- Next steps:
-- 1. Rotate all API keys (Supabase + Gemini)
-- 2. Update frontend to use new verification functions
-- 3. Monitor audit_log table for suspicious activity
-- 4. Test all critical flows
-- ============================================================
