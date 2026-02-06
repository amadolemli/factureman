-- FIX RLS POLICIES - VERSION SIMPLIFIÉE
-- Solution: Convertir tout en TEXT pour la comparaison

-- ========================================
-- 1. FIX PRODUCTS TABLE
-- ========================================

DROP POLICY IF EXISTS "Users can insert their own products" ON products;
DROP POLICY IF EXISTS "Users can update their own products" ON products;
DROP POLICY IF EXISTS "Users can delete their own products" ON products;
DROP POLICY IF EXISTS "Users can view their own products" ON products;

CREATE POLICY "Users can insert their own products"
ON products FOR INSERT
WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own products"
ON products FOR UPDATE
USING (auth.uid()::text = user_id::text)
WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete their own products"
ON products FOR DELETE
USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can view their own products"
ON products FOR SELECT
USING (auth.uid()::text = user_id::text);

-- ========================================
-- 2. FIX CLIENTS TABLE
-- ========================================

DROP POLICY IF EXISTS "Users can insert their own clients" ON clients;
DROP POLICY IF EXISTS "Users can update their own clients" ON clients;
DROP POLICY IF EXISTS "Users can delete their own clients" ON clients;
DROP POLICY IF EXISTS "Users can view their own clients" ON clients;

CREATE POLICY "Users can insert their own clients"
ON clients FOR INSERT
WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own clients"
ON clients FOR UPDATE
USING (auth.uid()::text = user_id::text)
WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete their own clients"
ON clients FOR DELETE
USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can view their own clients"
ON clients FOR SELECT
USING (auth.uid()::text = user_id::text);

-- ========================================
-- 3. FIX PROFILES TABLE
-- ========================================

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;

CREATE POLICY "Users can insert their own profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view their own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- ========================================
-- 4. VÉRIFICATION
-- ========================================

SELECT 
  tablename,
  policyname,
  cmd as "Operation"
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('products', 'clients', 'profiles')
ORDER BY tablename, cmd, policyname;
