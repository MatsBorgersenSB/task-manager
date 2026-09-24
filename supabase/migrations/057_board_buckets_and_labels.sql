-- Planner-style board: custom buckets + colored labels per project.
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Role helpers (idempotent) if earlier migrations were skipped
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

create or replace function public.is_internal_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'internal')
  );
$$;

grant execute on function public.is_internal_user() to authenticated;

-- ---------------------------------------------------------------------------
-- Custom buckets
-- ---------------------------------------------------------------------------
create table if not exists public.project_buckets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists project_buckets_project_position_idx
  on public.project_buckets (project_id, position, created_at);

alter table public.project_buckets enable row level security;

drop policy if exists "Internal users manage project_buckets" on public.project_buckets;
create policy "Internal users manage project_buckets"
  on public.project_buckets for all
  to authenticated
  using (public.is_internal_user())
  with check (public.is_internal_user());

drop policy if exists "Authenticated users read project_buckets" on public.project_buckets;
create policy "Authenticated users read project_buckets"
  on public.project_buckets for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Colored labels (Planner-style)
-- ---------------------------------------------------------------------------
create table if not exists public.project_board_labels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  color text not null default 'rose',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists project_board_labels_project_position_idx
  on public.project_board_labels (project_id, position, created_at);

alter table public.project_board_labels enable row level security;

drop policy if exists "Internal users manage project_board_labels" on public.project_board_labels;
create policy "Internal users manage project_board_labels"
  on public.project_board_labels for all
  to authenticated
  using (public.is_internal_user())
  with check (public.is_internal_user());

drop policy if exists "Authenticated users read project_board_labels" on public.project_board_labels;
create policy "Authenticated users read project_board_labels"
  on public.project_board_labels for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Task columns
-- ---------------------------------------------------------------------------
alter table public.tasks
  add column if not exists bucket_id uuid references public.project_buckets (id) on delete set null;

alter table public.tasks
  add column if not exists board_label_ids uuid[] not null default '{}'::uuid[];

create index if not exists tasks_bucket_id_idx
  on public.tasks (bucket_id);

create index if not exists tasks_board_label_ids_idx
  on public.tasks using gin (board_label_ids);

-- Seed default buckets + labels for existing projects that have none.
insert into public.project_buckets (project_id, name, position)
select p.id, v.name, v.position
from public.projects p
cross join (
  values
    ('To do', 0),
    ('In progress', 1),
    ('Done', 2)
) as v(name, position)
where not exists (
  select 1 from public.project_buckets b where b.project_id = p.id
);

insert into public.project_board_labels (project_id, name, color, position)
select p.id, v.name, v.color, v.position
from public.projects p
cross join (
  values
    ('Urgent', 'rose', 0),
    ('Important', 'amber', 1),
    ('Waiting', 'sky', 2),
    ('Blocked', 'violet', 3)
) as v(name, color, position)
where not exists (
  select 1 from public.project_board_labels l where l.project_id = p.id
);

notify pgrst, 'reload schema';
