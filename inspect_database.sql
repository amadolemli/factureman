
-- SCRIPT D'INSPECTION DE LA BASE DE DONNÉES
-- Exécutez ce script dans l'éditeur SQL de Supabase pour voir la structure actuelle de vos tables et fonctions.

-- 1. INSPECTER LES TABLES (Colonnes et Types)
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public'
ORDER BY 
    table_name, ordinal_position;

-- 2. INSPECTER LES POLITIQUES RLS (Sécurité)
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check 
FROM 
    pg_policies 
WHERE 
    schemaname = 'public';

-- 3. INSPECTER LES DÉCLENCHEURS (Triggers)
SELECT 
    event_object_table as table_name, 
    trigger_name, 
    event_manipulation as event, 
    action_statement as definition 
FROM 
    information_schema.triggers 
WHERE 
    trigger_schema = 'public';

-- 4. INSPECTER LES FONCTIONS (Logique métier)
SELECT 
    routine_name, 
    data_type as return_type, 
    external_language 
FROM 
    information_schema.routines 
WHERE 
    routine_schema = 'public' 
    AND routine_type = 'FUNCTION';
