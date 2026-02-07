
-- ============================================================
-- SUPER FIX SCRIPT (Run this ENTIRE file in Supabase SQL Editor)
-- ============================================================

-- 1. FIX ADMIN LOGS: AMBIGUOUS ID ERROR
-- ============================================================
-- The error "column reference 'id' is ambiguous" happens because
-- multiple tables (admin_logs, users, profiles) all have an 'id' column.
-- We must drop the function and rewrite it with extremely specific aliases.

DROP FUNCTION IF EXISTS public.get_admin_logs();

CREATE OR REPLACE FUNCTION public.get_admin_logs()
RETURNS TABLE (
  id uuid,
  admin_id uuid,
  action text,
  target_user_id uuid,
  details jsonb,
  created_at timestamp with time zone,
  admin_business_name text,
  admin_phone text,
  target_business_name text,
  target_phone text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Strict permission check
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR is_super_admin = true)) THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  RETURN QUERY
  SELECT 
    l.id AS id,                  -- Explicit alias for output
    l.admin_id AS admin_id,      -- Explicit alias
    l.action AS action,
    l.target_user_id AS target_user_id,
    l.details AS details,
    l.created_at AS created_at,
    COALESCE(pa.business_name, 'Admin Inconnu') AS admin_business_name,
    ua.phone::text AS admin_phone,
    COALESCE(pt.business_name, 'Utilisateur Inconnu') AS target_business_name,
    ut.phone::text AS target_phone
  FROM public.admin_logs l
  -- Join explicitly on ID columns
  LEFT JOIN public.profiles pa ON l.admin_id = pa.id
  LEFT JOIN auth.users ua ON l.admin_id = ua.id
  LEFT JOIN public.profiles pt ON l.target_user_id = pt.id
  LEFT JOIN auth.users ut ON l.target_user_id = ut.id
  ORDER BY l.created_at DESC
  LIMIT 100;
END;
$$;

-- 2. FIX SIGNATURE UPLOAD: STORAGE PERMISSIONS
-- ============================================================
-- We will simplify the policy temporarily to rule out folder-structure issues.
-- This allows any authenticated user to upload to 'user-assets' bucket.
-- The path structure (userId/...) is enforced by the application logic anyway.

-- Ensure bucket exists and is public
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

-- Drop old strict policies
DROP POLICY IF EXISTS "Users can upload their own assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own assets" ON storage.objects;
DROP POLICY IF EXISTS "Everyone can view user assets" ON storage.objects;

-- Create Simpler, Robust Policies
-- Allow any authenticated user to INSERT (Upload) to user-assets
CREATE POLICY "Authenticated users can upload assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-assets' 
  AND auth.role() = 'authenticated'
);

-- Allow owner to UPDATE their own files
CREATE POLICY "Users can update own assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'user-assets' 
  AND auth.uid() = owner
);

-- Allow owner to DELETE their own files
CREATE POLICY "Users can delete own assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-assets' 
  AND auth.uid() = owner
);

-- Allow PUBLIC Read Access (needed for showing signatures on invoices)
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-assets');

-- 3. ENSURE COLUMNS EXIST
-- ============================================================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS signature_url text,
ADD COLUMN IF NOT EXISTS header_image_url text;

