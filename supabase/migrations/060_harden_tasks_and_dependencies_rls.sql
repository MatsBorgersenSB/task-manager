-- Migration 060: Harden RLS on tasks, task_dependencies, and project templates
-- + add column-level update guard for external client users.
-- Safe and idempotent across environments (checks table existence for optional tables).

-- ---------------------------------------------------------------------------
-- 1. Ensure role & project access security-definer helpers exist
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

create or replace function public.can_access_project(p_project_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if auth.uid() is null then
    return false;
  end if;

  if public.is_internal_user() then
    return true;
  end if;

  if p_project_id is null then
    return false;
  end if;

  select lower(trim(p.email))
    into v_email
    from public.profiles p
   where p.id = auth.uid();

  if v_email is null or v_email = '' then
    return false;
  end if;

  if to_regclass('public.project_users') is not null then
    return exists (
      select 1
        from public.projects pr
        join public.project_users pu on pu.project_id = pr.id
       where pr.id = p_project_id
         and coalesce(pr.is_shared, false) = true
         and lower(trim(pu.email)) = v_email
    );
  end if;

  return exists (
    select 1
      from public.projects pr
     where pr.id = p_project_id
       and coalesce(pr.is_shared, false) = true
  );
end;
$$;

grant execute on function public.can_access_project(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Tighten public.tasks RLS policies
-- ---------------------------------------------------------------------------
alter table public.tasks enable row level security;

drop policy if exists "Authenticated users can read tasks" on public.tasks;
drop policy if exists "Authenticated users can insert tasks" on public.tasks;
drop policy if exists "Authenticated users can update tasks" on public.tasks;
drop policy if exists "Authenticated users can delete tasks" on public.tasks;
drop policy if exists "Scoped users can read tasks" on public.tasks;
drop policy if exists "Scoped users can insert tasks" on public.tasks;
drop policy if exists "Scoped users can update tasks" on public.tasks;
drop policy if exists "Internal users can delete tasks" on public.tasks;

create policy "Scoped users can read tasks"
  on public.tasks for select
  to authenticated
  using (
    public.is_internal_user()
    or (
      coalesce(visibility_scope, 'internal_client') = 'internal_client'
      and public.can_access_project(project_id)
    )
  );

create policy "Scoped users can insert tasks"
  on public.tasks for insert
  to authenticated
  with check (
    public.is_internal_user()
    or (
      coalesce(visibility_scope, 'internal_client') = 'internal_client'
      and public.can_access_project(project_id)
    )
  );

create policy "Scoped users can update tasks"
  on public.tasks for update
  to authenticated
  using (
    public.is_internal_user()
    or (
      coalesce(visibility_scope, 'internal_client') = 'internal_client'
      and public.can_access_project(project_id)
    )
  )
  with check (
    public.is_internal_user()
    or (
      coalesce(visibility_scope, 'internal_client') = 'internal_client'
      and public.can_access_project(project_id)
    )
  );

create policy "Internal users can delete tasks"
  on public.tasks for delete
  to authenticated
  using (public.is_internal_user());

-- ---------------------------------------------------------------------------
-- 3. Column-level guard trigger on public.tasks for external client updates
--    Prevents non-internal users from mutating SB-only columns via PostgREST.
-- ---------------------------------------------------------------------------
create or replace function public.guard_external_task_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_internal_user() or auth.uid() is null then
    return new;
  end if;

  if new.sb_status is distinct from old.sb_status
     or new.sb_owner is distinct from old.sb_owner
     or new.sb_note is distinct from old.sb_note
     or new.response_sb is distinct from old.response_sb
     or new.risk is distinct from old.risk
     or new.risk_comment is distinct from old.risk_comment
     or new.visibility_scope is distinct from old.visibility_scope
     or new.project_id is distinct from old.project_id
  then
    raise exception 'External client accounts cannot modify Standard Bio internal fields.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_external_task_update on public.tasks;
create trigger trg_guard_external_task_update
  before update on public.tasks
  for each row
  execute function public.guard_external_task_update();

-- ---------------------------------------------------------------------------
-- 4. Tighten RLS on task_dependencies & template tables (when present)
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.task_dependencies') is not null then
    alter table public.task_dependencies enable row level security;

    drop policy if exists "Authenticated users can read task dependencies" on public.task_dependencies;
    drop policy if exists "Authenticated users can manage task dependencies" on public.task_dependencies;
    drop policy if exists "Scoped users read task dependencies" on public.task_dependencies;
    drop policy if exists "Internal users manage task dependencies" on public.task_dependencies;

    create policy "Scoped users read task dependencies"
      on public.task_dependencies for select
      to authenticated
      using (public.can_access_project(project_id));

    create policy "Internal users manage task dependencies"
      on public.task_dependencies for all
      to authenticated
      using (public.is_internal_user())
      with check (public.is_internal_user());
  end if;

  if to_regclass('public.project_templates') is not null then
    alter table public.project_templates enable row level security;

    drop policy if exists "Authenticated users can read project templates" on public.project_templates;
    drop policy if exists "Authenticated users can manage project templates" on public.project_templates;
    drop policy if exists "Internal users read project templates" on public.project_templates;
    drop policy if exists "Internal users manage project templates" on public.project_templates;

    create policy "Internal users read project templates"
      on public.project_templates for select
      to authenticated
      using (public.is_internal_user());

    create policy "Internal users manage project templates"
      on public.project_templates for all
      to authenticated
      using (public.is_internal_user())
      with check (public.is_internal_user());
  end if;

  if to_regclass('public.project_template_tasks') is not null then
    alter table public.project_template_tasks enable row level security;

    drop policy if exists "Authenticated users can read template tasks" on public.project_template_tasks;
    drop policy if exists "Authenticated users can manage template tasks" on public.project_template_tasks;
    drop policy if exists "Internal users read template tasks" on public.project_template_tasks;
    drop policy if exists "Internal users manage template tasks" on public.project_template_tasks;

    create policy "Internal users read template tasks"
      on public.project_template_tasks for select
      to authenticated
      using (public.is_internal_user());

    create policy "Internal users manage template tasks"
      on public.project_template_tasks for all
      to authenticated
      using (public.is_internal_user())
      with check (public.is_internal_user());
  end if;

  if to_regclass('public.project_template_task_dependencies') is not null then
    alter table public.project_template_task_dependencies enable row level security;

    drop policy if exists "Authenticated users can read template dependencies" on public.project_template_task_dependencies;
    drop policy if exists "Authenticated users can manage template dependencies" on public.project_template_task_dependencies;
    drop policy if exists "Internal users read template dependencies" on public.project_template_task_dependencies;
    drop policy if exists "Internal users manage template dependencies" on public.project_template_task_dependencies;

    create policy "Internal users read template dependencies"
      on public.project_template_task_dependencies for select
      to authenticated
      using (public.is_internal_user());

    create policy "Internal users manage template dependencies"
      on public.project_template_task_dependencies for all
      to authenticated
      using (public.is_internal_user())
      with check (public.is_internal_user());
  end if;
end $$;

notify pgrst, 'reload schema';
