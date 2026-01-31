-- 1. Add Tracking Column to Profiles
alter table public.profiles 
add column if not exists last_scan_at timestamp with time zone;

-- 2. Create Rate Limit Check Function
create or replace function public.check_scan_rate_limit()
returns boolean
language plpgsql
security definer
as $$
declare
  current_user_id uuid;
  last_scan timestamp with time zone;
  min_interval interval := interval '10 seconds'; -- LIMIT: 1 scan every 10s
begin
  current_user_id := auth.uid();
  
  -- Get last scan time
  select last_scan_at into last_scan
  from public.profiles
  where id = current_user_id;

  -- Check if too fast
  if last_scan is not null and (now() - last_scan) < min_interval then
    return false; -- Rate Limit Exceeded
  end if;

  -- Update time
  update public.profiles 
  set last_scan_at = now() 
  where id = current_user_id;

  return true; -- Allowed
end;
$$;
