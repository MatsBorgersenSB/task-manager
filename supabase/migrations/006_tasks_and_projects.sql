-- Tasks and projects — replaces FastAPI/SQLite task storage.
-- Run after 001–005 in the Supabase SQL Editor.

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "Authenticated users can read projects"
  on public.projects for select
  to authenticated
  using (true);

create policy "Authenticated users can insert projects"
  on public.projects for insert
  to authenticated
  with check (auth.uid() is not null);

create policy "Authenticated users can update projects"
  on public.projects for update
  to authenticated
  using (true);

create policy "Authenticated users can delete projects"
  on public.projects for delete
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Tasks (uuid PK + task_number for display/sort in the existing UI)
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  task_number serial unique not null,
  project_id uuid references public.projects (id) on delete set null,
  title text not null,
  description text,
  status text,
  priority text,
  assigned_to uuid references public.profiles (id) on delete set null,
  responsible text,
  created_at timestamptz not null default now(),
  -- Extended fields used by the existing client/internal UI
  registration_date date,
  risk text,
  risk_comment text,
  date_due date,
  date_completed date,
  sb_status text,
  sb_owner text,
  sb_note text,
  response_sb text
);

create index if not exists tasks_task_number_idx on public.tasks (task_number);
create index if not exists tasks_status_idx on public.tasks (status);
create index if not exists tasks_priority_idx on public.tasks (priority);
create index if not exists tasks_assigned_to_idx on public.tasks (assigned_to);
create index if not exists tasks_project_id_idx on public.tasks (project_id);

alter table public.tasks enable row level security;

create policy "Authenticated users can read tasks"
  on public.tasks for select
  to authenticated
  using (true);

create policy "Authenticated users can insert tasks"
  on public.tasks for insert
  to authenticated
  with check (auth.uid() is not null);

create policy "Authenticated users can update tasks"
  on public.tasks for update
  to authenticated
  using (true);

create policy "Authenticated users can delete tasks"
  on public.tasks for delete
  to authenticated
  using (true);

-- Internal/admin users need to list profiles for SB Owner pickers.
drop policy if exists "Internal users can read profiles for tasks" on public.profiles;

create policy "Internal users can read profiles for tasks"
  on public.profiles for select
  using (
    exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.role in ('admin', 'internal')
    )
  );
