-- CHECK INVOICES SCHEMA
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'invoices' AND column_name = 'id';
