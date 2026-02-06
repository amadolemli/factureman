-- ============================================================
-- SETUP SUPABASE STORAGE BUCKETS
-- ============================================================
-- Ce script crée les buckets de stockage pour les fichiers
-- et configure les politiques de sécurité (RLS)
-- ============================================================

-- 1. CRÉER LES BUCKETS
-- ============================================================

-- Bucket pour les assets utilisateur (images, signatures)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-assets',
  'user-assets',
  true, -- Public (accessible via URL)
  5242880, -- 5 MB max par fichier
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Bucket pour les factures PDF
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoices',
  'invoices',
  true, -- Public (pour partage QR code)
  10485760, -- 10 MB max par fichier
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf'];

-- ============================================================
-- 2. POLITIQUES RLS POUR USER-ASSETS
-- ============================================================

-- Permettre aux utilisateurs d'uploader leurs propres fichiers
DROP POLICY IF EXISTS "Users can upload their own assets" ON storage.objects;
CREATE POLICY "Users can upload their own assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Permettre aux utilisateurs de mettre à jour leurs propres fichiers
DROP POLICY IF EXISTS "Users can update their own assets" ON storage.objects;
CREATE POLICY "Users can update their own assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'user-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Permettre aux utilisateurs de supprimer leurs propres fichiers
DROP POLICY IF EXISTS "Users can delete their own assets" ON storage.objects;
CREATE POLICY "Users can delete their own assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Tout le monde peut VOIR les assets (public)
DROP POLICY IF EXISTS "Everyone can view user assets" ON storage.objects;
CREATE POLICY "Everyone can view user assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-assets');

-- ============================================================
-- 3. POLITIQUES RLS POUR INVOICES
-- ============================================================

-- Permettre aux utilisateurs d'uploader leurs propres factures
DROP POLICY IF EXISTS "Users can upload their own invoices" ON storage.objects;
CREATE POLICY "Users can upload their own invoices"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'invoices' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Permettre aux utilisateurs de mettre à jour leurs propres factures
DROP POLICY IF EXISTS "Users can update their own invoices" ON storage.objects;
CREATE POLICY "Users can update their own invoices"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'invoices' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Permettre aux utilisateurs de supprimer leurs propres factures
DROP POLICY IF EXISTS "Users can delete their own invoices" ON storage.objects;
CREATE POLICY "Users can delete their own invoices"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'invoices' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Tout le monde peut VOIR les factures (pour QR code public)
DROP POLICY IF EXISTS "Everyone can view invoices" ON storage.objects;
CREATE POLICY "Everyone can view invoices"
ON storage.objects FOR SELECT
USING (bucket_id = 'invoices');

-- ============================================================
-- 4. AJOUTER COLONNES URL DANS LA DB (OPTIONNEL)
-- ============================================================
-- Ces colonnes permettent de stocker les URLs directement
-- au lieu de les garder dans le JSONB business_info

-- Ajouter colonnes pour les URLs d'images dans profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS header_image_url text,
  ADD COLUMN IF NOT EXISTS signature_url text;

-- Ajouter colonne pour les URLs de produits (futur)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_url text;

-- Note: invoices a déjà la colonne pdf_url

-- ============================================================
-- VÉRIFICATION
-- ============================================================

-- Vérifier que les buckets sont créés
-- SELECT * FROM storage.buckets WHERE id IN ('user-assets', 'invoices');

-- Vérifier les politiques
-- SELECT * FROM pg_policies WHERE schemaname = 'storage';

-- Tester un upload (dans l'app, pas ici)

-- ============================================================
-- NOTES IMPORTANTES
-- ============================================================

-- Structure des fichiers dans les buckets :
-- 
-- user-assets/
--   ├─ {user_id}/
--   │  ├─ headers/
--   │  │  └─ header_{timestamp}.jpg
--   │  ├─ signatures/
--   │  │  └─ signature_{timestamp}.png
--   │  └─ products/ (futur)
--   │     └─ product_{id}_{timestamp}.jpg
--
-- invoices/
--   └─ {user_id}/
--      ├─ FAC-2024-001.pdf
--      ├─ REC-2024-020.pdf
--      └─ DEV-2024-005.pdf

-- Les URLs publiques seront de la forme :
-- https://{project_ref}.supabase.co/storage/v1/object/public/user-assets/{user_id}/headers/header_123.jpg

-- ============================================================
-- FIN DU SCRIPT
-- ============================================================
