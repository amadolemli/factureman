-- FIX CLIENTS TABLE PERSISTENCE (CORRECTED)
-- Adds missing columns and fixes type mismatch in policy

-- 1. Add 'appointments' column (JSONB)
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS appointments jsonb DEFAULT '[]'::jsonb;

-- 2. Add 'remaining_balance' column (Numeric)
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS remaining_balance numeric DEFAULT 0;

-- 3. Add 'history' column if missing
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS history jsonb DEFAULT '[]'::jsonb;

-- 4. Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- 5. Ensure Policy Exists (Fixed for UUID vs TEXT comparison)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE tablename = 'clients'
        AND policyname = 'Users can CRUD their own clients'
    ) THEN
        CREATE POLICY "Users can CRUD their own clients"
        ON public.clients
        FOR ALL
        USING ( auth.uid()::text = user_id ); -- Added ::text cast to fix error
    END IF;
END
$$;
