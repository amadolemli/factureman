-- ============================================================
-- ENABLE PUBLIC QR CODE VERIFICATION
-- ============================================================

-- This function allows the "Verify Document" page to securely read
-- specific details of an invoice WITHOUT requiring login.
-- It bypasses Row Level Security (RLS) safely by only exposing
-- the fields needed for verification.

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
    business_name text,
    business_phone text,
    business_address text
)
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with Super User privileges to bypass RLS
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
        i.status = 'PAID' OR i.status = 'CONFIRMED' as is_finalized, -- Derive finalized status
        i.customer_name,
        p.business_name,
        p.phone as business_phone,
        (p.business_info->>'address')::text as business_address
    FROM public.invoices i
    JOIN public.profiles p ON i.user_id = p.id
    WHERE i.id = target_invoice_id;
END;
$$;

-- Grant access to anonymous users (public)
GRANT EXECUTE ON FUNCTION public.get_public_invoice_details(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_invoice_details(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_invoice_details(uuid) TO service_role;
