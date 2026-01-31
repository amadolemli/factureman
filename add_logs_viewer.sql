-- ============================================================
-- 5. FUNCTION TO GET ADMIN LOGS
-- ============================================================
create or replace function public.get_admin_logs()
returns table (
  id uuid,
  admin_id uuid,
  action text,
  target_user_id uuid,
  details jsonb,
  created_at timestamp with time zone,
  admin_business_name text,  -- New: Name of the admin who did the action
  target_business_name text  -- New: Name of the user affected
) 
language plpgsql
security definer
as $$
begin
  -- Check permission
  if not exists (select 1 from public.profiles where id = auth.uid() and (is_admin = true or is_super_admin = true)) then
    raise exception 'Access Denied';
  end if;

  return query
  select 
    l.id,
    l.admin_id,
    l.action,
    l.target_user_id,
    l.details,
    l.created_at,
    pa.business_name as admin_business_name,
    pt.business_name as target_business_name
  from public.admin_logs l
  left join public.profiles pa on l.admin_id = pa.id
  left join public.profiles pt on l.target_user_id = pt.id
  order by l.created_at desc
  limit 100; -- Limit to last 100 actions for performance
end;
$$;
