-- Equipment types reference table + task columns.
-- Run after 027_areas.sql.

alter table public.tasks
  add column if not exists equipment_type_name text,
  add column if not exists equipment_type_code text;

create index if not exists tasks_equipment_type_code_idx
  on public.tasks (equipment_type_code);

create table if not exists public.equipment_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists equipment_types_code_idx
  on public.equipment_types (lower(trim(code)));

create unique index if not exists equipment_types_name_code_idx
  on public.equipment_types (lower(trim(name)), lower(trim(code)));

alter table public.equipment_types enable row level security;

drop policy if exists "Allow read equipment types" on public.equipment_types;
drop policy if exists "Allow insert equipment types" on public.equipment_types;

create policy "Allow read equipment types"
  on public.equipment_types for select
  to authenticated
  using (true);

create policy "Allow insert equipment types"
  on public.equipment_types for insert
  to authenticated
  with check (auth.uid() is not null);

insert into public.equipment_types (name, code)
select v.name, v.code
from (
  values
    ('Motor', 'MOT'),
    ('Fan', 'FAN'),
    ('Pump', 'PMP')
) as v(name, code)
where not exists (
  select 1
  from public.equipment_types e
  where lower(trim(e.code)) = lower(trim(v.code))
);
