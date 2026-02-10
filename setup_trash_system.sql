-- UPDATE TRASH SYSTEM TO 30 DAYS
-- Modifies the cleanup function to delete items older than 30 days.

CREATE OR REPLACE FUNCTION public.empty_trash()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete invoices older than 30 days
  DELETE FROM public.invoices 
  WHERE deleted_at < (now() - interval '30 days');

  -- Delete products older than 30 days
  DELETE FROM public.products 
  WHERE deleted_at < (now() - interval '30 days');
END;
$$;
