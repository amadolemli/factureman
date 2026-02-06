-- FIX FINAL QR CODE (TYPE SAFE)

DROP FUNCTION IF EXISTS public.get_public_invoice_details(text);
DROP FUNCTION IF EXISTS public.get_public_invoice_details(uuid);

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
        i.id::text, -- Force text output
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
        -- Compare as TEXT to handle both UUID and TEXT column types
        i.id::text = search_term 
        OR i.number = search_term
    LIMIT 1;
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION public.get_public_invoice_details(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_invoice_details(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_invoice_details(text) TO service_role;
