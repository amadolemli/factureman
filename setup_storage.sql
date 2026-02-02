-- 1. ADD PDF_URL COLUMN TO INVOICES
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS pdf_url text;

-- 2. CREATE STORAGE BUCKET FOR INVOICES
-- Note: This requires the 'storage' extension which is default in Supabase
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', true)
on conflict (id) do nothing;

-- 3. ENABLE STORAGE POLICIES
-- Allow authenticated users to upload files to 'invoices' bucket
create policy "Users can upload their own invoices"
on storage.objects for insert
with check (
  bucket_id = 'invoices' AND
  auth.uid() = owner
);

-- Allow authenticated users to view their own invoices
-- (Or all authenticated users if public is true, but let's restrict to owner for safety ideally, 
--  but 'public' bucket means public URL access. We'll rely on the unguessable filenames for now 
--  or strict RLS if we turn off public. Let's keep it simple: Public read for the signed URL logic)
create policy "Users can update their own invoices"
on storage.objects for update
using ( bucket_id = 'invoices' AND auth.uid() = owner );

create policy "Users can read their own invoices"
on storage.objects for select
using ( bucket_id = 'invoices' AND auth.uid() = owner );
