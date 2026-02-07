# Diagnostic: Signature Upload Issue

## Problem
The signature in the profile is refusing to upload.

## Potential Causes

### 1. **Supabase Storage Bucket Not Configured**
The `user-assets` bucket may not exist or have incorrect policies.

**Solution:** Run the `fix_signature_save.sql` script in your Supabase SQL Editor.

### 2. **Missing Environment Variables**
Your `.env.local` file is empty. The app needs Supabase credentials to upload files.

**Solution:** Fill in your `.env.local` file with:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GEMINI_API_KEY=your-gemini-key
```

### 3. **User Not Authenticated**
The upload requires `userProfile.id` to be present.

**Solution:** Ensure you're logged in before trying to upload a signature.

### 4. **Storage Policy Mismatch**
The storage policy checks if `auth.uid()` matches the folder name, but the code might be using a different user ID format.

**Solution:** Check the storage service code and ensure the `userId` parameter matches the authenticated user's ID.

## Step-by-Step Debugging

### Step 1: Check Browser Console
1. Open the app in your browser
2. Open Developer Tools (F12)
3. Go to the Console tab
4. Try to upload a signature
5. Look for error messages

Common errors:
- `Error uploading signature: {...}` - Storage policy issue
- `Erreur: Profil utilisateur introuvable` - Not logged in
- Network errors - Environment variables missing

### Step 2: Verify Supabase Configuration
1. Go to your Supabase Dashboard
2. Navigate to Storage
3. Check if `user-assets` bucket exists
4. Check if it's set to **Public**
5. Check the Policies tab for the bucket

### Step 3: Test the Upload Function
Add console.log statements to debug:

```typescript
async uploadSignature(dataUrl: string, userId: string): Promise<string | null> {
    console.log('🔍 Starting signature upload for user:', userId);
    try {
        // Convertir data URL en Blob
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        console.log('✅ Blob created:', blob.size, 'bytes');

        const timestamp = Date.now();
        const fileName = `signatures/signature_${timestamp}.png`;
        const filePath = `${userId}/${fileName}`;
        console.log('📁 Upload path:', filePath);

        const { error: uploadError } = await supabase.storage
            .from('user-assets')
            .upload(filePath, blob, {
                contentType: 'image/png',
                upsert: true,
                cacheControl: '3600'
            });

        if (uploadError) {
            console.error('❌ Error uploading signature:', uploadError);
            return null;
        }

        console.log('✅ Upload successful!');
        const { data } = supabase.storage
            .from('user-assets')
            .getPublicUrl(filePath);

        console.log('🔗 Public URL:', data.publicUrl);
        return data.publicUrl;
    } catch (err) {
        console.error('💥 Upload signature exception:', err);
        return null;
    }
}
```

## Quick Fixes

### Fix 1: Run the SQL Script
Execute `fix_signature_save.sql` in Supabase SQL Editor to ensure proper bucket configuration.

### Fix 2: Simplify Storage Policy
If the folder-based policy is causing issues, temporarily use a simpler policy:

```sql
-- Allow all authenticated users to upload
DROP POLICY IF EXISTS "Users can upload their own assets" ON storage.objects;
CREATE POLICY "Users can upload their own assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-assets' 
  AND auth.role() = 'authenticated'
);
```

### Fix 3: Add Error Handling in UI
Update the `saveSignature` function to show more specific errors:

```typescript
const saveSignature = async () => {
  if (sigCanvasRef.current) {
    if (sigCanvasRef.current.isEmpty()) {
      alert("Veuillez signer avant de sauvegarder.");
      return;
    }

    if (!userProfile?.id) {
      alert("Erreur: Profil utilisateur introuvable. Veuillez vous reconnecter.");
      console.error('❌ No user profile found:', userProfile);
      return;
    }

    console.log('👤 User profile:', userProfile);

    const signatureDataUrl = sigCanvasRef.current.getTrimmedCanvas().toDataURL('image/png');
    console.log('🖼️ Signature data URL length:', signatureDataUrl.length);

    try {
      const publicUrl = await storageService.uploadSignature(signatureDataUrl, userProfile.id);
      console.log('📤 Upload result:', publicUrl);

      if (publicUrl) {
        onUpdateBusiness({ ...business, signatureUrl: publicUrl });
        setShowSignatureModal(false);
        alert("✅ Signature sauvegardée dans le Cloud !");
      } else {
        alert("Erreur lors de l'upload de la signature. Vérifiez la console pour plus de détails.");
      }
    } catch (e) {
      console.error("💥 Signature upload error", e);
      alert(`Erreur technique: ${e.message || 'Inconnue'}`);
    }
  }
};
```

## Most Likely Solution

Based on the code review, the most likely issue is that **the Supabase storage bucket policies haven't been applied**. 

**Action Required:**
1. Open your Supabase Dashboard
2. Go to SQL Editor
3. Run the `fix_signature_save.sql` script
4. Try uploading the signature again

If that doesn't work, check the browser console for specific error messages and update this document with the findings.
