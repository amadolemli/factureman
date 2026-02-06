-- TEST DEBUG QR CODE
-- Remplacez 'VOTRE_ID_ICI' par l'ID ou le Numéro qui pose problème

-- 1. Lister les 5 dernières factures pour voir les IDs
SELECT id, number, total_amount, customer_name FROM public.invoices ORDER BY created_at DESC LIMIT 5;

-- 2. Tester la fonction de vérification avec un ID spécifique (à remplacer manuellement si testé dans Supabase Studio)
-- SELECT * FROM get_public_invoice_details('L_ID_QUE_VOUS_VOYEZ_DANS_L_URL');
