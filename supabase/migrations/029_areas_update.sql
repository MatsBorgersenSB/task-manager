-- Allow authenticated users to rename areas (code stays immutable in app logic).

drop policy if exists "Authenticated users can update areas" on public.areas;

create policy "Authenticated users can update areas"
  on public.areas for update
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
