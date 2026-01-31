-- ============================================================
-- FIX ADMIN PERMISSIONS
-- ============================================================
-- Ce script corrige les fonctions d'administration pour s'assurer
-- que les administrateurs peuvent ajouter des crédits et supprimer dés utilisateurs.

-- 1. CORRECTION ADD CREDITS (GRANT CREDITS)
-- Permet à tout ADMIN ou SUPER ADMIN d'ajouter des crédits.
create or replace function public.grant_credits(target_user_id uuid, amount integer)
returns boolean
language plpgsql
security definer
as $$
declare
  caller_is_admin boolean;
begin
  -- Vérifie si l'appelant est admin ou super admin
  select (is_admin OR is_super_admin) into caller_is_admin from public.profiles where id = auth.uid();
  
  if caller_is_admin is not true then 
    raise exception 'Access Denied: You are not an Admin.'; 
  end if;

  -- Update target profile
  update public.profiles set app_credits = app_credits + amount where id = target_user_id;
  
  return true;
end;
$$;


-- 2. CORRECTION DELETE USER DATA
-- ATTENTION : Modifié pour permettre aux simples ADMINS de supprimer aussi (si c'est souhaité).
-- Si vous voulez restreindre aux super admins, remettez "is_super_admin".
create or replace function public.delete_user_data(target_user_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  caller_can_delete boolean;
begin
  -- MODIFICATION: Allow ADMINS to delete users too (since user requested "as admin")
  select (is_admin OR is_super_admin) into caller_can_delete from public.profiles where id = auth.uid();
  
  if caller_can_delete is not true then 
    raise exception 'Access Denied: Only Admins can delete users.'; 
  end if;

  -- Delete associated data (Cascade manually to be safe)
  delete from public.products where user_id = target_user_id;
  delete from public.clients where user_id = target_user_id;
  delete from public.invoices where user_id = target_user_id;
  
  -- Delete profile (This removes them from the app view, but they remain in Auth)
  delete from public.profiles where id = target_user_id;

  return true;
end;
$$;

