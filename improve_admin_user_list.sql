-- Function to List All Users with improved Name resolution
-- Prioritizes distinct business_name column, falls back to business_info keys, ensures we get a usable name.
create or replace function public.get_admin_user_list()
returns table (
  id uuid,
  business_name text,
  phone text,
  app_credits integer,
  last_active timestamp with time zone,
  is_admin boolean,
  is_super_admin boolean,
  is_banned boolean
) 
language plpgsql
security definer
as $$
declare
  caller_can_view boolean;
begin
  -- Qualify with table name/alias "p" to avoid ambiguity
  select (p.is_admin OR p.is_super_admin) into caller_can_view 
  from public.profiles p 
  where p.id = auth.uid();
  
  if caller_can_view is not true then return; end if;

  return query
  select 
    p.id, 
    COALESCE(
        NULLIF(TRIM(p.business_name), ''), 
        NULLIF(TRIM(p.business_info->>'name'), ''), 
        'Utilisateur Sans Nom'
    )::text as business_name,
    u.phone::text, 
    p.app_credits, 
    p.created_at as last_active, 
    p.is_admin, 
    p.is_super_admin, 
    p.is_banned
  from public.profiles p
  join auth.users u on p.id = u.id -- Changed to JOIN to ensure we match users
  order by p.created_at desc;
end;
$$;
