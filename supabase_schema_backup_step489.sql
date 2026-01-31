-- Enable Row Level Security (RLS)

-- 1. PROFILES TABLE (Store user settings and CREDITS)
create table public.profiles (
  id uuid references auth.users not null primary key,
  business_name text,
  business_info jsonb, 
  app_credits integer default 500, -- NOUVEAU: 500 crédits par défaut
  is_admin boolean default false, -- Sub admins are boolean true
  is_super_admin boolean default false, -- NOUVEAU: SUPER ADMIN (Main)
  is_banned boolean default false, 
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

-- RLS: User can SEE their own profile
create policy "Users can select their own profile"
  on public.profiles for select
  using ( auth.uid() = id );

-- RLS: User can UDPATE their business info, BUT NOT CREDITS
create policy "Users can update own business info"
  on public.profiles for update
  using ( auth.uid() = id )
  with check ( 
    auth.uid() = id 
    -- Security: Credit, Admin, Banned stats are immutable by client
    AND (app_credits IS NOT DISTINCT FROM (select app_credits from public.profiles where id = auth.uid()))
    AND (is_admin IS NOT DISTINCT FROM (select is_admin from public.profiles where id = auth.uid()))
    AND (is_super_admin IS NOT DISTINCT FROM (select is_super_admin from public.profiles where id = auth.uid()))
    AND (is_banned IS NOT DISTINCT FROM (select is_banned from public.profiles where id = auth.uid()))
  );


-- 2. CLIENTS TABLE (Address Book)
create table public.clients (
  id text primary key,
  user_id uuid references auth.users not null,
  name text not null,
  phone text,
  total_debt numeric default 0,
  history jsonb default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.clients enable row level security;

create policy "Users can CRUD their own clients"
  on public.clients for all
  using ( auth.uid() = user_id );


-- 3. PRODUCTS TABLE (Inventory)
create table public.products (
  id text primary key,
  user_id uuid references auth.users not null,
  name text not null,
  category text,
  price numeric default 0,
  stock integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.products enable row level security;

create policy "Users can CRUD their own products"
  on public.products for all
  using ( auth.uid() = user_id );


-- 4. INVOICES TABLE (History)
create table public.invoices (
  id text primary key,
  user_id uuid references auth.users not null,
  number text not null,
  type text not null, 
  date date not null,
  customer_name text,
  customer_phone text,
  total_amount numeric,
  amount_paid numeric,
  status text, 
  content jsonb, 
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.invoices enable row level security;

create policy "Users can CRUD their own invoices"
  on public.invoices for all
  using ( auth.uid() = user_id );


-- 5. FUNCTION TO DEDUCT CREDIT (SECURE BACKEND LOGIC)
create or replace function public.deduct_credits(amount integer)
returns boolean
language plpgsql
security definer 
as $$
declare
  current_credits integer;
  current_user_id uuid;
  user_is_banned boolean;
begin
  current_user_id := auth.uid();
  select app_credits, is_banned into current_credits, user_is_banned
  from public.profiles where id = current_user_id;

  if user_is_banned is true then return false; end if;

  if current_credits >= amount then
    update public.profiles set app_credits = current_credits - amount where id = current_user_id;
    return true;
  else
    return false;
  end if;
end;
$$;


-- 6. ADMIN TRIGGER
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, business_name, app_credits)
  values (new.id, 'Ma Nouvelle Boutique', 500); 
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 7. ADMIN FUNCTIONS (HIERARCHICAL)

-- Helper to check admin access
-- Level 1: Sub Admin (Can grant credits, Ban)
-- Level 2: Super Admin (Can promote admins, Delete users)

create or replace function public.check_user_role()
returns table(is_admin boolean, is_super_admin boolean) 
language plpgsql security definer
as $$
begin
  return query select p.is_admin, p.is_super_admin from public.profiles p where p.id = auth.uid();
end;
$$;


-- Function to Grant Credits (Any Admin)
create or replace function public.grant_credits(target_user_id uuid, amount integer)
returns boolean
language plpgsql
security definer
as $$
declare
  caller_is_admin boolean;
begin
  select (is_admin OR is_super_admin) into caller_is_admin from public.profiles where id = auth.uid();
  if caller_is_admin is not true then raise exception 'Access Denied'; end if;

  update public.profiles set app_credits = app_credits + amount where id = target_user_id;
  return true;
end;
$$;


-- Function to Toggle Ban (Any Admin)
create or replace function public.toggle_user_ban(target_user_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  caller_is_admin boolean;
  current_ban_status boolean;
  target_is_super boolean;
begin
  select (is_admin OR is_super_admin) into caller_is_admin from public.profiles where id = auth.uid();
  if caller_is_admin is not true then raise exception 'Access Denied'; end if;

  select is_banned, is_super_admin into current_ban_status, target_is_super from public.profiles where id = target_user_id;
  
  if target_is_super is true then raise exception 'Cannot ban a Super Admin'; end if;

  update public.profiles 
  set is_banned = not coalesce(current_ban_status, false)
  where id = target_user_id;
  
  return true;
end;
$$;


-- Function to DELETE USER DATA (Super Admin Only)
create or replace function public.delete_user_data(target_user_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  caller_is_super boolean;
begin
  select is_super_admin into caller_is_super from public.profiles where id = auth.uid();
  if caller_is_super is not true then raise exception 'Access Denied: Super Admin Only'; end if;

  delete from public.products where user_id = target_user_id;
  delete from public.clients where user_id = target_user_id;
  delete from public.invoices where user_id = target_user_id;
  delete from public.profiles where id = target_user_id;

  return true;
end;
$$;


-- Function to Toggle Admin Role (Super Admin Only)
create or replace function public.toggle_admin_role(target_user_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  caller_is_super boolean;
  current_status boolean;
begin
  select is_super_admin into caller_is_super from public.profiles where id = auth.uid();
  if caller_is_super is not true then raise exception 'Access Denied: Super Admin Only'; end if;

  select is_admin into current_status from public.profiles where id = target_user_id;

  update public.profiles 
  set is_admin = not coalesce(current_status, false)
  where id = target_user_id;

  return true;
end;
$$;


-- Function to List All Users (Any Admin sees list, but Super Admin sees more info ideally? Same info for now)
create or replace function public.get_admin_user_list()
returns table (
  id uuid,
  business_name text,
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
  select (is_admin OR is_super_admin) into caller_can_view from public.profiles where id = auth.uid();
  if caller_can_view is not true then return; end if;

  return query
  select p.id, p.business_name, p.app_credits, p.created_at as last_active, p.is_admin, p.is_super_admin, p.is_banned
  from public.profiles p
  order by p.created_at desc;
end;
$$;

-- Function to Get Dashboard Stats (Admin Only)
create or replace function public.get_admin_dashboard_stats()
returns jsonb
language plpgsql
security definer
as $$
declare
  caller_can_view boolean;
  total_users integer;
  total_credits_outstanding integer;
  total_banned integer;
  total_admins integer;
begin
  select (is_admin OR is_super_admin) into caller_can_view from public.profiles where id = auth.uid();
  if caller_can_view is not true then raise exception 'Access Denied'; end if;

  select count(*), sum(app_credits), count(case when is_banned then 1 end), count(case when is_admin then 1 end)
  into total_users, total_credits_outstanding, total_banned, total_admins
  from public.profiles;

  return jsonb_build_object(
    'total_users', total_users,
    'total_credits', coalesce(total_credits_outstanding, 0),
    'total_banned', total_banned,
    'total_admins', total_admins
  );
end;
$$;
