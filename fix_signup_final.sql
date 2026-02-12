-- Fonction ROBUSTE pour gérer les nouveaux utilisateurs et les parrainages
-- Cette version sépare la création du profil (étape critique) de l'attribution des bonus (étape secondaire)
-- pour garantir que le lien de parrainage est toujours sauvegardé même en cas d'erreur de crédits.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  ref_code text;
  ref_id uuid;
  input_code text;
BEGIN
  -- 1. Générer un code de parrainage unique pour le nouvel utilisateur
  ref_code := public.generate_unique_referral_code(new.id);
  
  -- 2. Lire et nettoyer le code parrain saisi (nettoyage des espaces et majuscules)
  input_code := NULLIF(TRIM(new.raw_user_meta_data->>'referral_code'), '');
  
  -- 3. Chercher le parrain (Bloc sécurisé : si ça échoue, on continue sans parrain)
  IF input_code IS NOT NULL THEN
      BEGIN
          -- On cherche l'ID du parrain correspondant au code
          SELECT id INTO ref_id 
          FROM public.profiles 
          WHERE referral_code = upper(input_code);
      EXCEPTION WHEN OTHERS THEN 
          -- En cas d'erreur technique, on loggue mais on ne bloque pas l'inscription
          RAISE WARNING 'Erreur lors de la recherche du parrain: %', SQLERRM;
          ref_id := NULL;
      END;
  END IF;

  -- 4. CRÉER LE PROFIL UTILISATEUR (Étape critique)
  -- On insère le 'referred_by' (ref_id) IMMÉDIATEMENT ici pour ne jamais perdre le lien.
  INSERT INTO public.profiles (
      id, 
      business_name, 
      app_credits, 
      referral_code, 
      referred_by, 
      bonuses_claimed
  )
  VALUES (
      new.id, 
      COALESCE(new.raw_user_meta_data->>'business_name', 'Nouveau Commerce'), 
      500,       -- Bonus de bienvenue : 500 crédits
      ref_code,  -- Son propre code de parrainage
      ref_id,    -- L'ID de son parrain (ou NULL)
      false      -- Bonus non encore "réclamés" (flag technique)
  );

  -- 5. ATTRIBUER LES CRÉDITS AU PARRAIN (Bloc sécurisé 2)
  -- Si cette étape échoue (ex: droits, verrouillage), le profil ci-dessus reste valide !
  IF ref_id IS NOT NULL THEN
      BEGIN
          UPDATE public.profiles 
          SET app_credits = app_credits + 500 
          WHERE id = ref_id;
      EXCEPTION WHEN OTHERS THEN 
          -- Si on n'arrive pas à donner les crédits, ce n'est pas grave, le lien existe.
          -- On pourra corriger les crédits plus tard avec un script.
          RAISE WARNING 'Erreur lors de l''ajout des crédits parrain: %', SQLERRM;
      END;
  END IF;

  RETURN new;
END;
$$;
