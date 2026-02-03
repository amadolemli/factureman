-- 1. ADD PDF_URL COLUMN TO INVOICES
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS pdf_url text;

-- 2. CREATE STORAGE BUCKET FOR INVOICES
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', true)
on conflict (id) do nothing;

-- 3. ENABLE STORAGE POLICIES (SAFE UPDATE)

-- Drop existing policies to avoid "already exists" errors
drop policy if exists "Users can upload their own invoices" on storage.objects;
drop policy if exists "Users can update their own invoices" on storage.objects;
drop policy if exists "Users can read their own invoices" on storage.objects;

-- Create Policies
create policy "Users can upload their own invoices"
on storage.objects for insert
with check (
  bucket_id = 'invoices' AND
  auth.uid() = owner
);

create policy "Users can update their own invoices"
on storage.objects for update
using ( bucket_id = 'invoices' AND auth.uid() = owner );

create policy "Users can read their own invoices"
on storage.objects for select
using ( bucket_id = 'invoices' AND auth.uid() = owner );
