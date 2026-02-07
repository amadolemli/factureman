
-- ============================================================
-- GLOBAL FIX SCRIPT (Run this ENTIRE file in Supabase SQL Editor)
-- ============================================================

-- 1. FIX ADMIN LOGS DISPLAY (Empty Logs Issue)
-- ============================================================
-- First, drop the old function that had fewer columns
DROP FUNCTION IF EXISTS public.get_admin_logs();

-- Recreate it with the new phone number columns
CREATE OR REPLACE FUNCTION public.get_admin_logs()
RETURNS TABLE (
  id uuid,
  admin_id uuid,
  action text,
  target_user_id uuid,
  details jsonb,
  created_at timestamp with time zone,
  admin_business_name text,
  admin_phone text,       -- New phone column
  target_business_name text,
  target_phone text       -- New phone column
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check permission
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR is_super_admin = true)) THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  RETURN QUERY
  SELECT 
    l.id,
    l.admin_id,
    l.action,
    l.target_user_id,
    l.details,
    l.created_at,
    COALESCE(pa.business_name, 'Admin Inconnu') as admin_business_name,
    ua.phone::text as admin_phone,
    COALESCE(pt.business_name, 'Utilisateur Inconnu') as target_business_name,
    ut.phone::text as target_phone
  FROM public.admin_logs l
  LEFT JOIN public.profiles pa ON l.admin_id = pa.id
  LEFT JOIN auth.users ua ON l.admin_id = ua.id
  LEFT JOIN public.profiles pt ON l.target_user_id = pt.id
  LEFT JOIN auth.users ut ON l.target_user_id = ut.id
  ORDER BY l.created_at DESC
  LIMIT 100;
END;
$$;

-- 2. FIX SIGNATURE UPLOAD (Storage Permission Issue)
-- ============================================================
-- Create bucket 'user-assets' if missing
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-assets',
  'user-assets',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Reset Policies for 'user-assets' to ensure uploads work
DROP POLICY IF EXISTS "Users can upload their own assets" ON storage.objects;
CREATE POLICY "Users can upload their own assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update their own assets" ON storage.objects;
CREATE POLICY "Users can update their own assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'user-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete their own assets" ON storage.objects;
CREATE POLICY "Users can delete their own assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Everyone can view user assets" ON storage.objects;
CREATE POLICY "Everyone can view user assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-assets');

-- 3. ENSURE DATABASE COLUMNS EXIST
-- ============================================================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS signature_url text,
ADD COLUMN IF NOT EXISTS header_image_url text;

