# 🔧 FIX ADMIN LOGS - Quick Guide

## ❌ Problem
The "Logs Séc." (Security Logs) tab in the Admin Panel shows **"Aucune activité enregistrée"** (No activity recorded) because:
1. The `admin_logs` table doesn't exist in your database
2. The `get_admin_logs()` function is missing

## ✅ Solution

### Step 1: Execute SQL Script

1. Open https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Open the file `setup_admin_logs.sql`
5. **Copy ALL content** from the file
6. Paste in SQL Editor
7. Click **RUN**

### Step 2: Verify Setup

In SQL Editor, run this query:
```sql
SELECT * FROM public.admin_logs LIMIT 10;
```

You should see: ✅ A table with columns (no rows yet, that's normal)

### Step 3: Test the Logs

1. Go to Admin Panel in your app
2. Perform an admin action:
   - Grant credits to a user, OR
   - Ban/unban a user, OR
   - Change an admin role
3. Go back to "Logs Séc." tab
4. You should now see the action logged! ✅

---

## 📋 What This Script Does

### Creates:
1. **`admin_logs` table** - Stores all admin actions
2. **`get_admin_logs()` function** - Retrieves logs for display
3. **Updated admin functions** - Now log every action:
   - `grant_credits()` → Logs "GRANT_CREDIT"
   - `toggle_user_ban()` → Logs "BAN_USER" or "UNBAN_USER"
   - `delete_user_data()` → Logs "DELETE_USER"
   - `toggle_admin_role()` → Logs "PROMOTE_ADMIN" or "DEMOTE_ADMIN"

### Security:
- ✅ Admins can **READ** logs
- ✅ **NO ONE** can delete or modify logs (immutable audit trail)
- ✅ Only authenticated admins can view logs

---

## 🧪 Expected Results

### After Setup:

**Admin Panel > Logs Séc. Tab:**
```
┌─────────────────────────────────────────────────────────┐
│ GRANT_CREDIT                    2026-02-06 13:00:00    │
│ Super Admin a agi sur BOUTIQUE ABC                      │
│ {"amount": 100}                                         │
├─────────────────────────────────────────────────────────┤
│ BAN_USER                        2026-02-06 12:55:00    │
│ Admin Jacques a agi sur User XYZ                        │
│ {"new_status": true}                                    │
└─────────────────────────────────────────────────────────┘
```

---

## ⚠️ Important Notes

### First Time Setup
- After running the script, logs will be **empty** (no past actions)
- Logs only capture **FUTURE** admin actions
- This is normal and expected behavior

### Testing
To test if it's working:
1. Grant yourself 10 credits from Admin Panel
2. Check the Logs tab - you should see the action!

---

## 🐛 Troubleshooting

### Logs still empty after performing actions
**Check:**
1. Did you execute `setup_admin_logs.sql` in Supabase? ✅
2. Did you refresh the Admin Panel after the action?
3. Are you an admin/super admin? (Only admins can see logs)

### Error: "relation admin_logs does not exist"
**Solution:** Execute `setup_admin_logs.sql` script in Supabase SQL Editor

### Error: "Access Denied"
**Solution:** Make sure you're logged in as an admin or super admin

---

## 📊 Supabase Database Check

After running the script, verify in **Table Editor**:

### Tables
✅ `admin_logs` - Should exist with these columns:
- `id` (uuid)
- `admin_id` (uuid)
- `action` (text)
- `target_user_id` (uuid)
- `details` (jsonb)
- `created_at` (timestamp)

### Functions
✅ `get_admin_logs()` - Should exist in Database > Functions

---

**Once executed, the logs system will be fully operational!** 🎯
