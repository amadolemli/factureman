# 🔒 SECURITY AUDIT REPORT - FactureMan App
**Date:** 2026-02-04  
**Auditor:** Security Specialist AI  
**Application:** Invoice Management System (FactureMan)  
**Severity Levels:** 🔴 CRITICAL | 🟠 HIGH | 🟡 MEDIUM | 🔵 LOW | ✅ INFO

---

## EXECUTIVE SUMMARY

This security audit identified **12 vulnerabilities** across multiple categories including authentication, access control, data exposure, and injection risks. The application has some security measures in place (RLS, authentication), but several critical issues require immediate attention.

**Critical Findings:** 3  
**High Priority:** 4  
**Medium Priority:** 3  
**Low Priority:** 2

---

## 🔴 CRITICAL VULNERABILITIES

### 1. **EXPOSED API KEYS IN VERSION CONTROL** 🔴
**File:** `.env` (Line 1-3)  
**Risk:** API keys and database credentials are committed to git repository

```env
VITE_SUPABASE_URL=https://lgqidexautuxnbghlxqj.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_scL_N_24sEy9XH5QLLobzw_W2KBri_o
VITE_GEMINI_API_KEY=AIzaSyDP2posVhyP57T7b7qQEaulbJQL7069mG4
```

**Impact:**
- Attackers can access your Supabase database
- Unauthorized API calls to Gemini (costing you money)
- Data breach of all user data
- Potential to modify/delete data

**Fix:**
1. **IMMEDIATE:** Rotate all API keys:
   - Generate new Supabase Anon Key
   - Generate new Gemini API key
2. Remove `.env` from git history:
   ```bash
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env" \
     --prune-empty --tag-name-filter cat -- --all
   ```
3. Ensure `.env` is in `.gitignore` (✅ already present)
4. Use environment variables in deployment platforms

---

### 2. **CLIENT-SIDE CREDIT MANIPULATION** 🔴
**File:** `src/hooks/useWallet.ts` (Line 14-22)  
**Risk:** Local wallet credits stored in localStorage can be manipulated

**Vulnerable Code:**
```typescript
const setWalletCredits = (newAmount: number | ((prev: number) => number)) => {
    setWalletCreditsState(prev => {
        const value = typeof newAmount === 'function' ? newAmount(prev) : newAmount;
        if (session?.user?.id) {
            localStorage.setItem(`factureman_${session.user.id}_wallet`, value.toString());
        }
        return value;
    });
};
```

**Exploit:**
```javascript
// In browser console, attacker can:
localStorage.setItem('factureman_[userId]_wallet', '999999999');
```

**Impact:**
- Users can give themselves unlimited credits
- Bypass payment for scans and document generation
- Financial loss to the business

**Fix:**
1. **Server-side validation:** Always verify credits on the backend before processing
2. **Wallet verification RPC:**
```sql
CREATE OR REPLACE FUNCTION verify_and_sync_wallet()
RETURNS TABLE(server_credits integer, wallet_credits integer, is_valid boolean)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    -- Return server balance and flag if wallet exceeds it
    RETURN QUERY 
    SELECT 
        app_credits,
        (SELECT wallet_credits FROM client_provided_value), 
        (wallet_credits <= app_credits) as is_valid
    FROM profiles 
    WHERE id = auth.uid();
END;
$$;
```
3. Regular wallet sync and cap enforcement
4. Backend deduction should ALWAYS happen before service delivery

---

### 3. **INSUFFICIENT INPUT VALIDATION ON CREDIT OPERATIONS** 🔴
**File:** `src/components/AdminPanel.tsx` (Line 256-260)  
**Risk:** Admin credit input not properly validated

**Vulnerable Code:**
```typescript
<input
    type="number"
    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono"
    value={creditAmount}
    onChange={e => setCreditAmount(parseInt(e.target.value) || 0)}
/>
```

**Exploit:**
- Admin can input negative numbers (appears as 0 but could bypass validation)
- Very large numbers could cause integer overflow
- No maximum limit enforced

**Impact:**
- Potential credit system manipulation
- Database integrity issues

**Fix:**
```typescript
onChange={e => {
    const val = parseInt(e.target.value) || 0;
    setCreditAmount(Math.max(0, Math.min(val, 1000000))); // Cap at 1M
}}
min="0"
max="1000000"
```

---

## 🟠 HIGH SEVERITY VULNERABILITIES

### 4. **ROW LEVEL SECURITY BYPASS VIA STORAGE POLICY** 🟠
**File:** `setup_storage.sql` (Line 22)  
**Risk:** Storage policy uses `owner` field which can be manipulated

**Vulnerable Policy:**
```sql
create policy "Users can upload their own invoices"
on storage.objects for insert
with check (
  bucket_id = 'invoices' AND
  auth.uid() = owner  -- ❌ 'owner' can be set by client
);
```

**Issue:** 
The `owner` field in storage.objects is client-controlled. An attacker can set `owner` to another user's ID.

**Fix:**
```sql
-- Drop old policies
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
```

---

### 5. **MISSING RATE LIMITING ON CLIENT OPERATIONS** 🟠
**File:** Multiple files  
**Risk:** No rate limiting on document creation, credit transfers, etc.

**Vulnerable Endpoints:**
- `finalizeDocument()` - Can spam document creation
- `handleGrantCredits()` - Admin can spam credit grants
- Client-side operations not throttled

**Impact:**
- DoS attacks
- Database flooding
- Resource exhaustion

**Fix:**
Add rate limiting functions:
```sql
-- Generic rate limiter
CREATE TABLE IF NOT EXISTS rate_limits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users NOT NULL,
    action_type text NOT NULL,
    last_action timestamp with time zone DEFAULT now(),
    action_count integer DEFAULT 1,
    UNIQUE(user_id, action_type)
);

CREATE OR REPLACE FUNCTION check_rate_limit(
    action_name text,
    max_actions integer,
    time_window interval
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    can_proceed boolean;
BEGIN
    -- Clean old entries
    DELETE FROM rate_limits 
    WHERE last_action < now() - time_window;
    
    -- Check or update limit
    INSERT INTO rate_limits (user_id, action_type, last_action, action_count)
    VALUES (auth.uid(), action_name, now(), 1)
    ON CONFLICT (user_id, action_type) DO UPDATE
    SET action_count = rate_limits.action_count + 1,
        last_action = now()
    RETURNING (action_count <= max_actions) INTO can_proceed;
    
    RETURN can_proceed;
END;
$$;
```

Usage:
```sql
-- In deduct_credits function
IF NOT check_rate_limit('deduct_credits', 100, interval '1 hour') THEN
    RAISE EXCEPTION 'Rate limit exceeded';
END IF;
```

---

### 6. **INSECURE PHONE NUMBER AUTHENTICATION** 🟠
**File:** `src/components/AuthScreen.tsx` (Line 23-26)  
**Risk:** Phone numbers used as primary authentication identifier

**Issue:**
```typescript
const getFormattedPhone = () => {
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    return `${countryCode}${cleanPhone}`;
};
```

**Vulnerabilities:**
- No SIM swap protection
- SMS OTP can be intercepted
- No backup authentication method
- Account takeover via phone number recycling

**Fix:**
1. Add email as backup authentication
2. Implement TOTP (Time-based One-Time Password) 2FA
3. Add device fingerprinting
4. Monitor for suspicious login patterns
5. Require additional verification for sensitive operations (email confirmation)

---

### 7. **UNRESTRICTED SUPER ADMIN CREATION** 🟠
**File:** `supabase_schema.sql` (Line 10)  
**Risk:** No built-in protection against unauthorized super admin creation

**Current Schema:**
```sql
is_super_admin boolean default false, -- Can be set by anyone with DB access
```

**Issue:**
- No audit trail for super admin creation
- No approval process
- Database admin can elevate themselves

**Fix:**
```sql
-- Add super admin creation log
CREATE TABLE super_admin_promotions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    promoted_user_id uuid REFERENCES auth.users NOT NULL,
    promoted_by uuid REFERENCES auth.users,
    promoted_at timestamp with time zone DEFAULT now(),
    justification text
);

-- Restrict super admin changes to existing super admins only
ALTER TABLE profiles ADD CONSTRAINT super_admin_immutable_check
CHECK (
    is_super_admin = false 
    OR (SELECT is_super_admin FROM profiles WHERE id = auth.uid()) = true
);

-- Create audited promotion function
CREATE OR REPLACE FUNCTION promote_to_super_admin(
    target_id uuid,
    reason text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    -- Only existing super admins can promote
    IF NOT (SELECT is_super_admin FROM profiles WHERE id = auth.uid()) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;
    
    -- Log the promotion
    INSERT INTO super_admin_promotions (promoted_user_id, promoted_by, justification)
    VALUES (target_id, auth.uid(), reason);
    
    -- Promote
    UPDATE profiles SET is_super_admin = true WHERE id = target_id;
    
    RETURN true;
END;
$$;
```

---

## 🟡 MEDIUM SEVERITY VULNERABILITIES

### 8. **INSUFFICIENT AUDIT LOGGING** 🟡
**File:** Multiple admin functions  
**Risk:** Critical operations not properly logged

**Missing Logs:**
- Credit deductions (only grants are logged)
- Profile updates
- Document finalization
- Password changes
- Failed authentication attempts

**Fix:**
Create comprehensive audit system:
```sql
CREATE TABLE audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users,
    action text NOT NULL,
    table_name text,
    record_id text,
    old_values jsonb,
    new_values jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);

-- Generic audit trigger
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO audit_log (user_id, action, table_name, record_id, old_values, new_values)
    VALUES (
        auth.uid(),
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id::text, OLD.id::text),
        to_jsonb(OLD),
        to_jsonb(NEW)
    );
    RETURN NEW;
END;
$$;

-- Apply to sensitive tables
CREATE TRIGGER profiles_audit AFTER UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER invoices_audit AFTER INSERT OR UPDATE OR DELETE ON invoices
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
```

---

### 9. **MISSING CSRF PROTECTION** 🟡
**File:** `api/scan.ts` and other API endpoints  
**Risk:** Cross-Site Request Forgery attacks possible

**Current State:**
- No CSRF tokens
- Only Bearer token validation
- Could be exploited via malicious sites

**Fix:**
Add CSRF token validation:
```typescript
// In api/scan.ts
export default async function handler(request: Request) {
    // ... existing auth checks ...
    
    // CSRF validation
    const origin = request.headers.get('origin');
    const allowedOrigins = [
        'https://your-app.vercel.app',
        'http://localhost:5173' // Dev only
    ];
    
    if (!origin || !allowedOrigins.includes(origin)) {
        return new Response(
            JSON.stringify({ error: 'Invalid origin' }), 
            { status: 403 }
        );
    }
    
    // ... rest of handler
}
```

---

### 10. **WEAK PASSWORD POLICY** 🟡
**File:** `src/components/ChangePasswordModal.tsx`  
**Risk:** No password strength enforcement

**Current State:**
- Supabase default: minimum 6 characters
- No complexity requirements
- No common password checking

**Fix:**
```typescript
const validatePassword = (pwd: string): { valid: boolean; errors: string[] } => {
    const errors = [];
    
    if (pwd.length < 8) errors.push("Minimum 8 caractères");
    if (!/[A-Z]/.test(pwd)) errors.push("Au moins une majuscule");
    if (!/[a-z]/.test(pwd)) errors.push("Au moins une minuscule");
    if (!/[0-9]/.test(pwd)) errors.push("Au moins un chiffre");
    if (!/[!@#$%^&*]/.test(pwd)) errors.push("Au moins un caractère spécial");
    
    // Check against common passwords
    const commonPasswords = ['password', '12345678', 'azerty123'];
    if (commonPasswords.some(p => pwd.toLowerCase().includes(p))) {
        errors.push("Mot de passe trop commun");
    }
    
    return { valid: errors.length === 0, errors };
};
```

---

## 🔵 LOW SEVERITY ISSUES

### 11. **SENSITIVE DATA IN CLIENT-SIDE LOGS** 🔵
**File:** Multiple files  
**Risk:** User data logged to browser console

**Examples:**
```typescript
// src/services/geminiService.ts:11
console.log("Attempting Secure Server Scan...");

// src/App.tsx
console.error("Error loading local data", e);
```

**Fix:**
Create a secure logger:
```typescript
const logger = {
    log: (...args: any[]) => {
        if (import.meta.env.DEV) console.log(...args);
    },
    error: (...args: any[]) => {
        // Always log errors but sanitize
        const sanitized = args.map(arg => 
            typeof arg === 'object' ? '[Object]' : arg
        );
        console.error(...sanitized);
    }
};
```

---

### 12. **MISSING SECURITY HEADERS** 🔵
**File:** `vercel.json` (Line 12-28)  
**Current Implementation:** Basic headers present ✅

**Missing Headers:**
```json
{
    "key": "Content-Security-Policy",
    "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com"
},
{
    "key": "Strict-Transport-Security",
    "value": "max-age=63072000; includeSubDomains; preload"
},
{
    "key": "Permissions-Policy",
    "value": "geolocation=(), microphone=(), camera=()"
}
```

---

## ✅ SECURITY STRENGTHS

1. **Row Level Security (RLS)** - Properly implemented on all tables
2. **Server-side Credit Deduction** - `deduct_credits()` function is secure
3. **Authentication Required** - All operations require valid session
4. **Hierarchical Admin System** - Super Admin > Admin > User roles
5. **`.env` in .gitignore** - Secrets excluded from repository (but compromised already)
6. **Security Definer Functions** - Proper privilege escalation control
7. **Rate Limiting on Scan API** - Present in `api/scan.ts`

---

## 🎯 PRIORITY ACTION PLAN

### IMMEDIATE (Today)
1. ✅ **Rotate all API keys** (Supabase + Gemini)
2. ✅ **Fix storage RLS policies** (use path-based checks)
3. ✅ **Add wallet verification** (server-side validation)

### THIS WEEK
4. ✅ **Implement rate limiting** on critical operations
5. ✅ **Add input validation** for admin credit operations
6. ✅ **Create audit log system**
7. ✅ **Fix CSRF protection**

### THIS MONTH
8. ✅ **Add password strength requirements**
9. ✅ **Implement 2FA** (TOTP or Email backup)
10. ✅ **Security headers update**
11. ✅ **Penetration testing**
12. ✅ **Security training for admin users**

---

## 📊 RISK ASSESSMENT MATRIX

| Vulnerability | Likelihood | Impact | Risk Score |
|--------------|------------|--------|------------|
| Exposed API Keys | High | Critical | 🔴 **10/10** |
| Credit Manipulation | High | High | 🔴 **9/10** |
| Storage RLS Bypass | Medium | High | 🟠 **7/10** |
| Missing Rate Limits | High | Medium | 🟠 **7/10** |
| Phone Auth Issues | Medium | High | 🟠 **7/10** |
| Super Admin Control | Low | High | 🟠 **6/10** |
| Insufficient Audit | High | Low | 🟡 **5/10** |
| Missing CSRF | Medium | Medium | 🟡 **5/10** |
| Weak Passwords | Medium | Medium | 🟡 **5/10** |

---

## 📞 RECOMMENDATIONS

1. **Implement a Security Incident Response Plan**
2. **Regular security audits** (quarterly)
3. **Penetration testing** by third party
4. **User security awareness training**
5. **Bug bounty program** for responsible disclosure
6. **Automated security scanning** in CI/CD pipeline

---

**Report compiled by:** AI Security Specialist  
**Review required by:** Application Owner  
**Next audit scheduled:** 2026-05-04

---
