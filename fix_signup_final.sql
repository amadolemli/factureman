-- FIX SIGNUP & REFERRAL SYSTEM (FINAL ROBUST VERSION)
-- Ce script corrige l'erreur "Database error saving new user" en :
-- 1. Sécurisant la logique de parrainage (si elle échoue, l'inscription continue).
-- 2. Utilisant une méthode plus stable pour la création du profil.
-- 3. Gérant les cas limites (codes en double, erreurs de clé étrangère).

-- 1. Vérification des colonnes nécessaires
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bonuses_claimed boolean DEFAULT false;

-- 2. Fonction de génération de code (MD5 8 chars)
CREATE OR REPLACE FUNCTION public.generate_unique_referral_code(user_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  -- Génère un code unique de 8 caractères basé sur l'ID utilisateur
  RETURN upper(substring(md5(user_id::text) from 1 for 8));
END;
$$;

-- 3. Fonction principale de gestion des nouveaux utilisateurs
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  ref_code text;
  referrer_id uuid;
  input_code text;
BEGIN
  -- A. Génération du code de parrainage pour le NOUVEL utilisateur
  ref_code := public.generate_unique_referral_code(new.id);
  
  -- B. Traitement du parrainage (Code entré par l'utilisateur)
  -- Nous utilisons un bloc BEGIN/EXCEPTION pour que les erreurs de parrainage ne bloquent JAMAIS l'inscription
  BEGIN
      input_code := NULLIF(TRIM(new.raw_user_meta_data->>'referral_code'), '');
      
      IF input_code IS NOT NULL THEN
          -- Recherche du parrain
          SELECT id INTO referrer_id
          FROM public.profiles
          WHERE referral_code = upper(input_code);

          -- Empercher l'auto-parrainage (si jamais)
          IF referrer_id = new.id THEN
             referrer_id := NULL;
          END IF;

          -- Si parrain trouvé : Lui donner son bonus (500 crédits)
          IF referrer_id IS NOT NULL THEN
             UPDATE public.profiles
             SET app_credits = app_credits + 500
             WHERE id = referrer_id;
          END IF;
      END IF;
  EXCEPTION WHEN OTHERS THEN
      -- En cas d'erreur dans le parrainage, on loggue l'erreur mais on continue
      RAISE WARNING 'Erreur parrainage ignorée lors de l''inscription : %', SQLERRM;
      referrer_id := NULL; -- On ignore le parrain en cas d'erreur
  END;

  -- C. Création du Profil Utilisateur (Étape Critique)
  BEGIN
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
          'Ma Nouvelle Boutique', 
          500, -- Bonus de bienvenue : 500 crédits
          ref_code,
          referrer_id,
          true -- Marqué comme reclamé
      );
  EXCEPTION WHEN OTHERS THEN
      -- Si l'insertion échoue (ex: collision de code rare), on réessaie sans référence
      RAISE WARNING 'Échec création profil standard, tentative de secours. Erreur : %', SQLERRM;
      
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
          'Ma Nouvelle Boutique', 
          500,
          NULL, -- On met NULL pour éviter les conflits unique
          NULL, -- On met NULL pour le parrain
          true
      );
  END;

  RETURN new;
END;
$$;

-- 4. Ré-attacher le déclencheur (Trigger)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
