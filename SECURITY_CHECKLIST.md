# 🔒 SECURITY CHECKLIST - IMMEDIATE ACTION REQUIRED

## ⚠️ CRITICAL - DO THIS NOW (Today)

### 1. ROTATE ALL API KEYS ❌ NOT DONE
**Why:** Your current keys are exposed in the `.env` file which may have been committed to git

#### Supabase Keys
1. Go to Supabase Dashboard → Settings → API
2. Click "Generate new anon key"
3. Update `.env` file with new key
4. Redeploy application

#### Gemini API Key
1. Go to Google AI Studio → API Keys
2. Delete old key: `AIzaSyDP2posVhyP57T7b7qQEaulbJQL7069mG4`
3. Create new key with restrictions:
   - API restrictions: Only allow Generative Language API
   - Application restrictions: HTTP referrers (your domain only)
4. Update `.env` file
5. **IMPORTANT:** Set environment variable `GEMINI_API_KEY` in Vercel (not `VITE_GEMINI_API_KEY`)

#### Clean Git History
```bash
# Remove .env from git history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (WARNING: Coordinate with team)
git push origin --force --all
```

### 2. FIX STORAGE POLICIES ❌ NOT DONE
Copy and run the contents of `SECURITY_FIXES.sql` section "FIX 1" in Supabase SQL Editor

**Verify:**
```sql
SELECT policyname FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';
```
Should show "Users can upload to their own folder" etc.

### 3. IMPLEMENT WALLET VERIFICATION ❌ NOT DONE
Run `SECURITY_FIXES.sql` section "FIX 2" 

**Then update frontend** (`src/hooks/useWallet.ts`):
```typescript
// Add verification before using wallet credits
const verifyWallet = async () => {
    const { data, error } = await supabase.rpc('verify_wallet_integrity', {
        claimed_wallet_credits: walletCredits
    });
    
    if (data && !data.is_valid) {
        console.warn('Wallet validation failed, syncing...');
        setWalletCredits(data.corrected_wallet);
    }
};
```

---

## 🟠 HIGH PRIORITY - THIS WEEK

### 4. ADD RATE LIMITING ❌ NOT DONE
- [ ] Run `SECURITY_FIXES.sql` section "FIX 3"
- [ ] Test with: `SELECT check_rate_limit('test', 5, interval '1 minute');`
- [ ] Monitor `rate_limits` table for abuse patterns

### 5. ENABLE AUDIT LOGGING ❌ NOT DONE
- [ ] Run `SECURITY_FIXES.sql` section "FIX 4"
- [ ] Verify triggers: `SELECT * FROM pg_trigger WHERE tgname LIKE '%audit%';`
- [ ] Check logs: `SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 10;`

### 6. ENHANCE ADMIN CONTROLS ❌ NOT DONE
- [ ] Run `SECURITY_FIXES.sql` sections "FIX 5" and "FIX 6"
- [ ] Update `AdminPanel.tsx` credit input validation:
```typescript
const MAX_CREDIT_GRANT = 1000000;
const handleGrantCredits = async () => {
    if (creditAmount <= 0 || creditAmount > MAX_CREDIT_GRANT) {
        setMessage({ 
            type: 'error', 
            text: `Montant invalide (1-${MAX_CREDIT_GRANT.toLocaleString()})` 
        });
        return;
    }
    // ... rest of function
};
```

### 7. IMPLEMENT CSRF PROTECTION ❌ NOT DONE
Update `api/scan.ts`:
```typescript
const ALLOWED_ORIGINS = [
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    'http://localhost:5173'
].filter(Boolean);

const origin = request.headers.get('origin');
if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return new Response(
        JSON.stringify({ error: 'Invalid origin' }), 
        { status: 403 }
    );
}
```

---

## 🟡 MEDIUM PRIORITY - THIS MONTH

### 8. PASSWORD STRENGTH ENFORCEMENT ❌ NOT DONE
Update `ChangePasswordModal.tsx`:
```typescript
const PASSWORD_REQUIREMENTS = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecial: true
};

const validatePassword = (pwd: string): string[] => {
    const errors = [];
    if (pwd.length < 8) errors.push("Minimum 8 caractères");
    if (!/[A-Z]/.test(pwd)) errors.push("Au moins une majuscule");
    if (!/[a-z]/.test(pwd)) errors.push("Au moins une minuscule");
    if (!/[0-9]/.test(pwd)) errors.push("Au moins un chiffre");
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) errors.push("Au moins un caractère spécial (!@#$%^&*...)");
    return errors;
};
```

### 9. ADD SECURITY HEADERS ❌ NOT DONE
Update `vercel.json`:
```json
{
    "key": "Content-Security-Policy",
    "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com; font-src 'self' data:;"
},
{
    "key": "Strict-Transport-Security",
    "value": "max-age=63072000; includeSubDomains; preload"
},
{
    "key": "Permissions-Policy",
    "value": "geolocation=(), microphone=(), camera=(), payment=()"
},
{
    "key": "Referrer-Policy",
    "value": "strict-origin-when-cross-origin"
}
```

### 10. SANITIZE LOGS ❌ NOT DONE
Create `src/utils/logger.ts`:
```typescript
const sanitize = (data: any): any => {
    if (typeof data === 'string') {
        // Remove potential PII
        return data.replace(/\b[\d]{10}\b/g, '[PHONE]')
                   .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL]');
    }
    if (typeof data === 'object' && data !== null) {
        return '[Object]';
    }
    return data;
};

export const logger = {
    log: (...args: any[]) => {
        if (import.meta.env.DEV) console.log(...args);
    },
    error: (...args: any[]) => {
        console.error(...args.map(sanitize));
    },
    warn: (...args: any[]) => {
        if (import.meta.env.DEV) console.warn(...args);
    }
};
```

### 11. ADD BRUTE FORCE PROTECTION ❌ NOT DONE
- [ ] Run `SECURITY_FIXES.sql` section "FIX 7"
- [ ] Update `AuthScreen.tsx` login handler:
```typescript
const handleLoginPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
        // Check if account is locked
        const { data: canLogin } = await supabase.rpc('check_login_attempts', {
            phone_number: getFormattedPhone()
        });

        if (!canLogin) {
            throw new Error('Compte temporairement verrouillé. Trop de tentatives. Réessayez dans 15 minutes.');
        }

        const finalPhone = getFormattedPhone();
        const { data, error } = await supabase.auth.signInWithPassword({
            phone: finalPhone,
            password: password
        });

        if (error) {
            // Record failed attempt
            await supabase.rpc('record_failed_login', {
                phone_number: finalPhone
            });
            
            if (error.message.includes('Invalid login')) {
                throw new Error("Mot de passe incorrect.");
            }
            throw error;
        }

        // Login successful - continue as normal
        // ...
    } catch (err: any) {
        // ...
    }
};
```

---

## 📋 VERIFICATION CHECKLIST

After applying fixes, verify each one:

```sql
-- 1. Storage policies fixed?
SELECT COUNT(*) FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname LIKE '%own%folder%';
-- Should return 3

-- 2. Wallet verification available?
SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'verify_wallet_integrity'
);
-- Should return true

-- 3. Rate limiting active?
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_name = 'rate_limits';
-- Should return 1

-- 4. Audit logging enabled?
SELECT COUNT(*) FROM pg_trigger 
WHERE tgname LIKE '%audit%';
-- Should return 4 (one per table)

-- 5. Constraints added?
SELECT COUNT(*) FROM information_schema.table_constraints 
WHERE constraint_type = 'CHECK' 
AND table_name IN ('profiles', 'invoices', 'products');
-- Should return at least 6
```

---

## 🎯 PRIORITY SCORE TRACKER

Track your progress:

| Task | Priority | Status | Date |
|------|----------|--------|------|
| Rotate API Keys | 🔴 Critical | ❌ | ____ |
| Fix Storage RLS | 🔴 Critical | ❌ | ____ |
| Wallet Verification | 🔴 Critical | ❌ | ____ |
| Rate Limiting | 🟠 High | ❌ | ____ |
| Audit Logging | 🟠 High | ❌ | ____ |
| Admin Input Validation | 🟠 High | ❌ | ____ |
| CSRF Protection | 🟠 High | ❌ | ____ |
| Password Strength | 🟡 Medium | ❌ | ____ |
| Security Headers | 🟡 Medium | ❌ | ____ |
| Log Sanitization | 🟡 Medium | ❌ | ____ |
| Brute Force Protection | 🟡 Medium | ❌ | ____ |

Progress: 0/11 (0%)

---

## 📞 NEED HELP?

If you encounter issues:

1. **Database errors:** Check Supabase logs (Dashboard → Logs)
2. **RLS issues:** Verify user is authenticated: `SELECT auth.uid();`
3. **Function errors:** Check function exists: `\df functionname` in SQL editor
4. **Policy errors:** List policies: `SELECT * FROM pg_policies WHERE tablename = 'tablename';`

---

## 🚀 DEPLOYMENT CHECKLIST

Before deploying to production:

- [ ] All API keys rotated
- [ ] `.env` not in git repository
- [ ] Environment variables set in Vercel
- [ ] All SQL fixes applied to production database
- [ ] Frontend code updated with new security functions
- [ ] Security headers configured
- [ ] Test all critical flows (login, document creation, payments)
- [ ] Monitor logs for errors after deployment
- [ ] Set up alerts for suspicious activity

---

**Remember:** Security is an ongoing process. Review this checklist monthly!

Last updated: 2026-02-04
