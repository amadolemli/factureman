-- MEGA FIX V2 : SANS TABLE INEXISTANTE
-- Ce script ignore credit_history qui n'existe pas

-- ========================================
-- ÉTAPE 1 : NETTOYAGE POLICIES & CONSTRAINTS
-- ========================================

-- Supprimer policies
DO $$
DECLARE
  pol RECORD;
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT DISTINCT tablename FROM pg_policies WHERE schemaname = 'public' LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl LOOP
      EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON ' || tbl;
    END LOOP;
  END LOOP;
END $$;

-- Supprimer foreign keys
DO $$
DECLARE
  fk RECORD;
BEGIN
  FOR fk IN 
    SELECT tc.table_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  LOOP
    EXECUTE 'ALTER TABLE ' || fk.table_name || ' DROP CONSTRAINT IF EXISTS ' || fk.constraint_name;
  END LOOP;
END $$;

-- ========================================
-- ÉTAPE 2 : CONVERSION EN TEXT
-- ========================================

-- Profiles (CLEF PRINCIPALE)
ALTER TABLE profiles ALTER COLUMN id TYPE text;

-- Tables liées
ALTER TABLE products ALTER COLUMN id TYPE text;
ALTER TABLE products ALTER COLUMN user_id TYPE text;

ALTER TABLE clients ALTER COLUMN id TYPE text;
ALTER TABLE clients ALTER COLUMN user_id TYPE text;

ALTER TABLE invoices ALTER COLUMN id TYPE text;
ALTER TABLE invoices ALTER COLUMN user_id TYPE text;

-- Tables optionnelles (si elles existent)
DO $$ BEGIN
  ALTER TABLE wallet_syncs ALTER COLUMN id TYPE text;
  ALTER TABLE wallet_syncs ALTER COLUMN user_id TYPE text;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE admin_logs ALTER COLUMN id TYPE text;
  ALTER TABLE admin_logs ALTER COLUMN admin_id TYPE text;
  ALTER TABLE admin_logs ALTER COLUMN target_user_id TYPE text;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ========================================
-- ÉTAPE 3 : RESTAURATION FOREIGN KEYS
-- ========================================

ALTER TABLE products 
  ADD CONSTRAINT products_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE clients 
  ADD CONSTRAINT clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE invoices 
  ADD CONSTRAINT invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Optionnelles
DO $$ BEGIN
  ALTER TABLE wallet_syncs 
    ADD CONSTRAINT wallet_syncs_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE admin_logs
    ADD CONSTRAINT admin_logs_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES profiles(id) ON DELETE CASCADE;
  ALTER TABLE admin_logs
    ADD CONSTRAINT admin_logs_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ========================================
-- ÉTAPE 4 : RESTAURATION POLICIES
-- ========================================

-- PRODUCTS
CREATE POLICY "Users can insert their own products" ON products FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update their own products" ON products FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Users can delete their own products" ON products FOR DELETE USING (auth.uid()::text = user_id);
CREATE POLICY "Users can view their own products" ON products FOR SELECT USING (auth.uid()::text = user_id);

-- CLIENTS
CREATE POLICY "Users can insert their own clients" ON clients FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update their own clients" ON clients FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Users can delete their own clients" ON clients FOR DELETE USING (auth.uid()::text = user_id);
CREATE POLICY "Users can view their own clients" ON clients FOR SELECT USING (auth.uid()::text = user_id);

-- INVOICES
CREATE POLICY "Users can insert their own invoices" ON invoices FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update their own invoices" ON invoices FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Users can delete their own invoices" ON invoices FOR DELETE USING (auth.uid()::text = user_id);
CREATE POLICY "Users can view their own invoices" ON invoices FOR SELECT USING (auth.uid()::text = user_id);

-- PROFILES
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid()::text = id);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid()::text = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid()::text = id);

-- ========================================
-- ÉTAPE 5 : VÉRIFICATION
-- ========================================

SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name IN ('id', 'user_id')
ORDER BY table_name;
