-- MEGA FIX : CONVERTIR TOUTES LES TABLES UUID → TEXT

-- ========================================
-- ÉTAPE 1 : SUPPRIMER TOUTES LES POLICIES
-- ========================================

DO $$
DECLARE
  pol RECORD;
  tbl TEXT;
BEGIN
  -- Pour chaque table ayant des policies
  FOR tbl IN 
    SELECT DISTINCT tablename 
    FROM pg_policies 
    WHERE schemaname = 'public'
  LOOP
    -- Supprimer toutes les policies de cette table
    FOR pol IN 
      SELECT policyname 
      FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON ' || tbl;
      RAISE NOTICE 'Dropped policy % on %', pol.policyname, tbl;
    END LOOP;
  END LOOP;
END $$;

-- ========================================
-- ÉTAPE 2 : SUPPRIMER LES FOREIGN KEYS
-- ========================================

-- Trouver et supprimer toutes les foreign keys
DO $$
DECLARE
  fk RECORD;
BEGIN
  FOR fk IN 
    SELECT 
      tc.table_name, 
      tc.constraint_name
    FROM information_schema.table_constraints tc
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
  LOOP
    EXECUTE 'ALTER TABLE ' || fk.table_name || ' DROP CONSTRAINT IF EXISTS ' || fk.constraint_name;
    RAISE NOTICE 'Dropped FK % from %', fk.constraint_name, fk.table_name;
  END LOOP;
END $$;

-- ========================================
-- ÉTAPE 3 : CONVERTIR TOUS LES ID EN TEXT
-- ========================================

-- Tables principales
ALTER TABLE profiles ALTER COLUMN id TYPE text;

ALTER TABLE products 
  ALTER COLUMN id TYPE text,
  ALTER COLUMN user_id TYPE text;

ALTER TABLE clients 
  ALTER COLUMN id TYPE text,
  ALTER COLUMN user_id TYPE text;

ALTER TABLE invoices 
  ALTER COLUMN id TYPE text,
  ALTER COLUMN user_id TYPE text;

-- Tables secondaires (si elles existent)
ALTER TABLE wallet_syncs 
  ALTER COLUMN id TYPE text,
  ALTER COLUMN user_id TYPE text;

ALTER TABLE admin_logs 
  ALTER COLUMN id TYPE text,
  ALTER COLUMN admin_id TYPE text,
  ALTER COLUMN target_user_id TYPE text;

ALTER TABLE credit_history
  ALTER COLUMN id TYPE text,
  ALTER COLUMN user_id TYPE text;

-- ========================================
-- ÉTAPE 4 : RECRÉER LES FOREIGN KEYS
-- ========================================

-- wallet_syncs → profiles
ALTER TABLE wallet_syncs 
  ADD CONSTRAINT wallet_syncs_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- products → profiles
ALTER TABLE products 
  ADD CONSTRAINT products_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- clients → profiles
ALTER TABLE clients 
  ADD CONSTRAINT clients_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- invoices → profiles
ALTER TABLE invoices 
  ADD CONSTRAINT invoices_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- admin_logs → profiles
ALTER TABLE admin_logs
  ADD CONSTRAINT admin_logs_admin_id_fkey
  FOREIGN KEY (admin_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE admin_logs
  ADD CONSTRAINT admin_logs_target_user_id_fkey
  FOREIGN KEY (target_user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- credit_history → profiles
ALTER TABLE credit_history
  ADD CONSTRAINT credit_history_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ========================================
-- ÉTAPE 5 : RECRÉER LES POLICIES
-- ========================================

-- PRODUCTS
CREATE POLICY "Users can insert their own products"
ON products FOR INSERT
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own products"
ON products FOR UPDATE
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own products"
ON products FOR DELETE
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can view their own products"
ON products FOR SELECT
USING (auth.uid()::text = user_id);

-- CLIENTS
CREATE POLICY "Users can insert their own clients"
ON clients FOR INSERT
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own clients"
ON clients FOR UPDATE
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own clients"
ON clients FOR DELETE
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can view their own clients"
ON clients FOR SELECT
USING (auth.uid()::text = user_id);

-- INVOICES
CREATE POLICY "Users can insert their own invoices"
ON invoices FOR INSERT
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own invoices"
ON invoices FOR UPDATE
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own invoices"
ON invoices FOR DELETE
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can view their own invoices"
ON invoices FOR SELECT
USING (auth.uid()::text = user_id);

-- PROFILES
CREATE POLICY "Users can view their own profile"
ON profiles FOR SELECT
USING (auth.uid()::text = id);

CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
USING (auth.uid()::text = id);

-- ========================================
-- ÉTAPE 6 : VÉRIFICATION
-- ========================================

SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('id', 'user_id', 'admin_id', 'target_user_id')
ORDER BY table_name, column_name;
