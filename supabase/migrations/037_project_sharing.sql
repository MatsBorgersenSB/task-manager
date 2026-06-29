-- Project sharing, memberships, and required task.project_id.
-- Safe to re-run.
--
-- Pattern: when adding a boolean column with DEFAULT false, immediately backfill
-- rows that should stay true (invited users, explicit IDs, or created_at cutover).
-- See 038_restore_project_sharing.sql for a standalone backfill migration.
-- See 039_project_users_shared_trigger.sql — trigger keeps is_shared in sync on invite.

alter table public.projects
  add column if not exists is_shared boolean not null default false;

create table if not exists public.project_users (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  email text not null,
  role text not null check (role in ('internal', 'client')),
  created_at timestamptz not null default now()
);

create unique index if not exists project_users_project_email_idx
  on public.project_users (project_id, lower(email));

create index if not exists project_users_email_idx
  on public.project_users (lower(email));

alter table public.project_users enable row level security;

-- ---------------------------------------------------------------------------
-- Backfill is_shared (DEFAULT false would hide pre-existing shared projects)
-- 1) Projects with invited users were shared before this column existed.
-- 2) Explicit IDs for known production shared projects (extend as needed).
-- Safe to re-run: only updates rows still marked is_shared = false.
-- ---------------------------------------------------------------------------
update public.projects p
set is_shared = true
where is_shared = false
  and exists (
    select 1
    from public.project_users pu
    where pu.project_id = p.id
  );

update public.projects
set is_shared = true
where is_shared = false
  and id in (
    '6e5d8a93-c1c3-46f8-9770-9f5049094424'::uuid  -- Dashboard Project
  );

-- Ensure every task belongs to a project (backfill from default project).
insert into public.projects (name, description, is_shared)
select 'Default Project', 'Auto-created for existing tasks', false
where not exists (select 1 from public.projects limit 1);

update public.tasks
set project_id = (
  select id from public.projects order by created_at asc limit 1
)
where project_id is null;

alter table public.tasks
  alter column project_id set not null;

-- ---------------------------------------------------------------------------
-- RLS: project_users
-- ---------------------------------------------------------------------------
drop policy if exists "Internal users manage project_users" on public.project_users;
drop policy if exists "Users read own project_users rows" on public.project_users;

create policy "Internal users manage project_users"
  on public.project_users for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.role in ('admin', 'internal')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.role in ('admin', 'internal')
    )
  );

create policy "Users read own project_users rows"
  on public.project_users for select
  to authenticated
  using (
    lower(email) = lower(
      coalesce(
        (select p.email from public.profiles p where p.id = auth.uid()),
        ''
      )
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: projects (replace open policies with scoped access)
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated users can read projects" on public.projects;
drop policy if exists "Authenticated users can insert projects" on public.projects;
drop policy if exists "Authenticated users can update projects" on public.projects;
drop policy if exists "Authenticated users can delete projects" on public.projects;
drop policy if exists "Internal users read all projects" on public.projects;
drop policy if exists "Internal users insert projects" on public.projects;
drop policy if exists "Internal users update projects" on public.projects;
drop policy if exists "Internal users delete projects" on public.projects;
drop policy if exists "Invited users read shared projects" on public.projects;

create policy "Internal users read all projects"
  on public.projects for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.role in ('admin', 'internal')
    )
  );

create policy "Invited users read shared projects"
  on public.projects for select
  to authenticated
  using (
    is_shared = true
    and exists (
      select 1
      from public.project_users pu
      join public.profiles me on me.id = auth.uid()
      where pu.project_id = projects.id
        and lower(pu.email) = lower(me.email)
    )
  );

create policy "Internal users insert projects"
  on public.projects for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.role in ('admin', 'internal')
    )
  );

create policy "Internal users update projects"
  on public.projects for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.role in ('admin', 'internal')
    )
  );

create policy "Internal users delete projects"
  on public.projects for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.role in ('admin', 'internal')
    )
  );
