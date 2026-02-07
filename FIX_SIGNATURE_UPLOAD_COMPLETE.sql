-- ============================================
-- FIX SIGNATURE UPLOAD - COMPREHENSIVE SOLUTION
-- ============================================
-- This script ensures the user-assets bucket is properly configured
-- and all necessary policies are in place for signature uploads.

-- Step 1: Ensure the user-assets bucket exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-assets',
  'user-assets',
  true,  -- MUST be public for signatures to be viewable
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Step 2: Drop all existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can upload their own assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own assets" ON storage.objects;
DROP POLICY IF EXISTS "Everyone can view user assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to user-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update user-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from user-assets" ON storage.objects;
DROP POLICY IF EXISTS "Public can view user-assets" ON storage.objects;

-- Step 3: Create new policies with proper permissions

-- Policy 1: Allow authenticated users to INSERT (upload) their own files
-- The folder structure is: {user_id}/signatures/signature_123.png
-- So we check if the first folder in the path matches the authenticated user's ID
CREATE POLICY "Authenticated users can upload to user-assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-assets' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Allow authenticated users to UPDATE their own files
CREATE POLICY "Authenticated users can update user-assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-assets' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: Allow authenticated users to DELETE their own files
CREATE POLICY "Authenticated users can delete from user-assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-assets' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 4: Allow EVERYONE (including anonymous) to SELECT (view) files
-- This is necessary because signatures need to be visible on invoices
-- even when shared with clients who aren't logged in
CREATE POLICY "Public can view user-assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'user-assets');

-- Step 4: Verify the setup
-- Run these queries to check if everything is configured correctly:

-- Check bucket configuration
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id = 'user-assets';

-- Check policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'objects' 
AND policyname LIKE '%user-assets%'
ORDER BY policyname;

-- ============================================
-- TROUBLESHOOTING
-- ============================================
-- If uploads still fail after running this script:
--
-- 1. Check if the user is authenticated:
--    SELECT auth.uid(); -- Should return a UUID, not NULL
--
-- 2. Check if the bucket exists:
--    SELECT * FROM storage.buckets WHERE id = 'user-assets';
--
-- 3. Test upload manually in Supabase Storage UI
--
-- 4. Check browser console for specific error messages
--
-- 5. Verify environment variables are set:
--    VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
--
-- ============================================
