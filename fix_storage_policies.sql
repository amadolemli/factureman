-- SECURITY POLICY FIX FOR SIGNATURES
-- Allows public access to view signatures
-- Allows authenticated users to upload their own signatures

-- 1. Create bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-assets', 'user-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;

-- 3. Create permissive policies

-- VIEW: Anyone can view assets (signatures, headers)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'user-assets' );

-- UPLOAD: Authenticated users can upload to their own folder
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'user-assets' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- UPDATE: Authenticated users can update their own files
CREATE POLICY "Authenticated Update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'user-assets' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE: Authenticated users can delete their own files
CREATE POLICY "Authenticated Delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'user-assets' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);
