-- Ensure authenticated users can update area name and code together.

drop policy if exists "Authenticated users can update areas" on public.areas;
drop policy if exists "Allow update areas" on public.areas;

create policy "Allow update areas"
  on public.areas for update
  to authenticated
  using (true)
  with check (true);
