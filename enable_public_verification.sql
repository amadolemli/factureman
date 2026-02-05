-- ============================================================
-- ENABLE PUBLIC QR CODE VERIFICATION (ROBUST VERSION)
-- ============================================================

-- This updated function relies ONLY on the 'invoices' table to avoid
-- join errors if the profile is missing or linked incorrectly.
-- It retrieves the business info directly from the invoice snapshot.

CREATE OR REPLACE FUNCTION public.get_public_invoice_details(target_invoice_id uuid)
RETURNS TABLE (
    id uuid,
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
        i.date,
        i.total_amount,
        i.amount_paid,
        (i.status = 'PAID' OR i.status = 'CONFIRMED') as is_finalized,
        i.customer_name,
        (i.content->'business') as business_snapshot
    FROM public.invoices i
    WHERE i.id = target_invoice_id;
END;
$$;

-- Grant access to anonymous users (public)
GRANT EXECUTE ON FUNCTION public.get_public_invoice_details(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_invoice_details(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_invoice_details(uuid) TO service_role;
