-- FIX FINAL: CLIENTS & QR VERIFICATION

-- ============================================================
-- 1. AJOUTER LES COLONNES MANQUANTES (CLIENTS)
-- ============================================================
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS appointments jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS history jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS remaining_balance numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_debt numeric DEFAULT 0;

-- ============================================================
-- 2. FONCTION DE VÉRIFICATION INTELLIGENTE (ID ou NUMÉRO)
-- ============================================================
DROP FUNCTION IF EXISTS public.get_public_invoice_details(text);

CREATE OR REPLACE FUNCTION public.get_public_invoice_details(search_term text)
RETURNS TABLE (
    id text,
    type text,
    number text,
    date text,
    total_amount numeric,
    amount_paid numeric,
    is_finalized boolean,
    customer_name text,
    business_snapshot jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        i.type,
        i.number,
        i.date::text,
        i.total_amount,
        i.amount_paid,
        (i.status = 'PAID' OR i.status = 'CONFIRMED') as is_finalized,
        i.customer_name,
        (i.content->'business') as business_snapshot
    FROM public.invoices i
    WHERE 
        -- Cherche soit par ID exact, soit par Numéro de facture
        i.id = search_term 
        OR i.number = search_term
    LIMIT 1; -- Prend le premier trouvé (au cas où doublon de numéro)
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.get_public_invoice_details(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_invoice_details(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_invoice_details(text) TO service_role;
