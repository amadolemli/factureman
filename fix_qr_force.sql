-- FORCE PERMISSIONS & DEBUG FUNCTION

-- 1. DROP old function to be sure
DROP FUNCTION IF EXISTS public.get_public_invoice_details(text);
DROP FUNCTION IF EXISTS public.get_public_invoice_details(uuid);

-- 2. RECREATE FUNCTION (Ultra Permissive)
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
SECURITY DEFINER -- Runs as admin!
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
        i.id = search_term 
        OR i.number = search_term
        OR i.number = replace(search_term, '%20', ' ') -- Handle URL encoding
    LIMIT 1;
END;
$$;

-- 3. GRANT PERMISSIONS (CRITICAL)
REVOKE ALL ON FUNCTION public.get_public_invoice_details(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_invoice_details(text) TO anon; -- Public
GRANT EXECUTE ON FUNCTION public.get_public_invoice_details(text) TO authenticated; -- Logged in users
GRANT EXECUTE ON FUNCTION public.get_public_invoice_details(text) TO service_role; -- Server
