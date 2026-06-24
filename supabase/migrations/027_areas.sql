-- Reference areas for task assignment (name + code).
-- Run after 026_task_area.sql.

create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists areas_code_lower_idx
  on public.areas (lower(trim(code)));

create unique index if not exists areas_name_code_lower_idx
  on public.areas (lower(trim(name)), lower(trim(code)));

alter table public.areas enable row level security;

drop policy if exists "Authenticated users can read areas" on public.areas;
drop policy if exists "Authenticated users can insert areas" on public.areas;

create policy "Authenticated users can read areas"
  on public.areas for select
  to authenticated
  using (true);

create policy "Authenticated users can insert areas"
  on public.areas for insert
  to authenticated
  with check (auth.uid() is not null);

insert into public.areas (name, code)
select v.name, v.code
from (
  values
    ('Material Buffer', 'MBU'),
    ('Dryer', 'DRY'),
    ('Material Storage', 'MAS'),
    ('Reactor', 'REA'),
    ('Auxillaries - Boiler', 'AXB'),
    ('Cooling Wetting', 'CWE'),
    ('Product Buffer', 'PBU'),
    ('Unknown / I&T', '#I/T')
) as v(name, code)
where not exists (
  select 1
  from public.areas a
  where lower(trim(a.code)) = lower(trim(v.code))
);
