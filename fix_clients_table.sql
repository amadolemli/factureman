-- FIX CLIENTS TABLE
-- Ajoute la colonne manquante 'appointments'

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS appointments jsonb DEFAULT '[]'::jsonb;

-- Ajoutons aussi 'history' au cas où il manquerait
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS history jsonb DEFAULT '[]'::jsonb;
