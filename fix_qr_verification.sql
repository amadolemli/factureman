-- ============================================================
-- FIX QR CODE VERIFICATION - Support TEXT IDs
-- ============================================================

-- Drop the old function with UUID parameter
DROP FUNCTION IF EXISTS public.get_public_invoice_details(uuid);

-- Create new function that accepts TEXT IDs (current app format)
CREATE OR REPLACE FUNCTION public.get_public_invoice_details(target_invoice_id text)
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
    WHERE i.id = target_invoice_id;
END;
$$;

-- Grant access to all user types (including anonymous for public QR scanning)
GRANT EXECUTE ON FUNCTION public.get_public_invoice_details(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_invoice_details(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_invoice_details(text) TO service_role;
