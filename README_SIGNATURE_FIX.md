# 🔧 Fix: Signature Upload Issue

## Problem
The signature in the profile is refusing to upload to Supabase Storage.

## Quick Solution (Most Likely Fix)

### Step 1: Run the SQL Script
1. Open your **Supabase Dashboard**
2. Go to **SQL Editor**
3. Open the file `FIX_SIGNATURE_UPLOAD_COMPLETE.sql`
4. Copy and paste the entire content into the SQL Editor
5. Click **Run** to execute the script

This script will:
- ✅ Create the `user-assets` bucket if it doesn't exist
- ✅ Set the bucket to public (required for viewing signatures)
- ✅ Configure proper RLS policies for authenticated users
- ✅ Allow users to upload, update, and delete their own files
- ✅ Allow public viewing of all files in the bucket

### Step 2: Test the Upload
1. Refresh your app
2. Go to **Profile Settings** → **Signature Digitale**
3. Click **"Créer ma signature"**
4. Draw your signature
5. Click **"Valider"**

If it still doesn't work, proceed to the diagnostic steps below.

---

## Diagnostic Tool (Built-in)

I've added a diagnostic tool directly in your app to help identify the exact issue.

### How to Use:
1. Open your app
2. Go to **Profile Settings**
3. Scroll to the **Signature Digitale** section
4. Click **"🔧 Problème d'upload ? Lancer le diagnostic"**
5. Click **"Run Diagnostics"**
6. Review the results

The diagnostic tool will:
- ✅ Check if you're authenticated
- ✅ Verify the `user-assets` bucket exists
- ✅ Test blob creation
- ✅ Attempt a real upload
- ✅ Show specific error messages
- ✅ Provide solutions based on the error

---

## Manual Troubleshooting

### Issue 1: Bucket Doesn't Exist
**Symptoms:**
- Error message: "Bucket not found"
- Upload returns null

**Solution:**
Run `FIX_SIGNATURE_UPLOAD_COMPLETE.sql` in Supabase SQL Editor

---

### Issue 2: Storage Policies Not Configured
**Symptoms:**
- Error message: "new row violates row-level security policy"
- Error message: "permission denied"

**Solution:**
1. Go to Supabase Dashboard → **Storage** → **Policies**
2. Check if policies exist for `user-assets` bucket
3. If not, run `FIX_SIGNATURE_UPLOAD_COMPLETE.sql`

---

### Issue 3: User Not Authenticated
**Symptoms:**
- Alert: "Profil utilisateur introuvable"
- Console error: "No user profile found"

**Solution:**
1. Log out of the app
2. Log back in
3. Try uploading the signature again

---

### Issue 4: Environment Variables Missing
**Symptoms:**
- Network errors
- Supabase client not initialized
- Upload fails silently

**Solution:**
1. Check your `.env.local` file
2. Ensure these variables are set:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
3. Restart your dev server: `npm run dev`

---

### Issue 5: Bucket Not Public
**Symptoms:**
- Upload succeeds
- Signature URL is generated
- But signature doesn't display on invoices

**Solution:**
1. Go to Supabase Dashboard → **Storage** → **Buckets**
2. Find `user-assets` bucket
3. Click **Settings**
4. Enable **Public bucket**
5. Save changes

---

## Enhanced Logging

I've added detailed console logging to help debug the issue. When you try to upload a signature, check the browser console (F12) for messages like:

```
🔍 [SIGNATURE UPLOAD] Starting upload for user: abc-123-def
📦 [SIGNATURE UPLOAD] Converting data URL to blob...
✅ [SIGNATURE UPLOAD] Blob created: 12345 bytes, type: image/png
📁 [SIGNATURE UPLOAD] Upload path: abc-123-def/signatures/signature_1234567890.png
☁️ [SIGNATURE UPLOAD] Uploading to Supabase storage...
```

If you see an error, it will show:
```
❌ [SIGNATURE UPLOAD] Error uploading signature: {...}
❌ [SIGNATURE UPLOAD] Error details: {...}
```

This will tell you exactly what went wrong.

---

## Files Modified

### 1. `src/services/storageService.ts`
- ✅ Added detailed console logging
- ✅ Better error reporting
- ✅ Shows upload progress

### 2. `src/components/ProfileSettings.tsx`
- ✅ Enhanced error messages
- ✅ Added diagnostic button
- ✅ Better user feedback

### 3. `src/components/StorageDiagnostic.tsx` (NEW)
- ✅ Automated diagnostic tool
- ✅ Tests all aspects of storage
- ✅ Provides specific solutions

### 4. `FIX_SIGNATURE_UPLOAD_COMPLETE.sql` (NEW)
- ✅ Comprehensive SQL fix script
- ✅ Creates bucket if missing
- ✅ Configures all policies
- ✅ Includes verification queries

---

## Next Steps

1. **Run the SQL script** in Supabase (most likely fix)
2. **Test the upload** in your app
3. If it still fails, **use the diagnostic tool**
4. **Check the browser console** for specific errors
5. **Contact me** with the console output if you need more help

---

## Prevention

To avoid this issue in the future:
- ✅ Always run storage setup scripts when deploying to a new environment
- ✅ Keep environment variables up to date
- ✅ Test uploads after any Supabase configuration changes
- ✅ Use the diagnostic tool before reporting issues

---

## Support

If you're still having issues after following these steps:
1. Open the browser console (F12)
2. Run the diagnostic tool
3. Take a screenshot of the console output
4. Share it with me for further assistance

The enhanced logging will show exactly where the upload is failing, making it much easier to fix!
