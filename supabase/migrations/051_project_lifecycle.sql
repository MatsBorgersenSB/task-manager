-- Standard Bio Enterprise Project Lifecycle Management
-- States: active → completed → archived → deleted (soft, final)

-- Ensure role helpers exist (from 003 / 045) if earlier migrations were skipped.
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

-- Ensure project sharing table exists (from 037) if earlier migrations were skipped.
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

drop policy if exists "Internal users manage project_users" on public.project_users;
create policy "Internal users manage project_users"
  on public.project_users for all
  to authenticated
  using (public.is_internal_user())
  with check (public.is_internal_user());

drop policy if exists "Users read own project_users rows" on public.project_users;
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

-- Optional columns referenced by lifecycle impact / filters.
alter table public.projects
  add column if not exists source_template_id uuid,
  add column if not exists template_version integer;

alter table public.tasks
  add column if not exists parent_task_id uuid null references public.tasks (id) on delete set null;

alter table public.projects
  add column if not exists project_status text not null default 'active'
    check (project_status in ('active', 'completed', 'archived')),
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by uuid references public.profiles (id) on delete set null,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles (id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles (id) on delete set null;

create index if not exists idx_projects_lifecycle_status
  on public.projects (project_status)
  where deleted_at is null;

create index if not exists idx_projects_deleted_at
  on public.projects (deleted_at)
  where deleted_at is not null;

create table if not exists public.project_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid,
  project_name text not null,
  action text not null check (action in (
    'project_created',
    'project_completed',
    'project_archived',
    'project_restored',
    'project_deleted'
  )),
  from_status text,
  to_status text,
  reason text,
  actor_user_id uuid references public.profiles (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_lifecycle_events_project
  on public.project_lifecycle_events (project_id, created_at desc);

create index if not exists idx_project_lifecycle_events_created
  on public.project_lifecycle_events (created_at desc);

alter table public.project_lifecycle_events enable row level security;

drop policy if exists "Internal users read lifecycle events" on public.project_lifecycle_events;
create policy "Internal users read lifecycle events"
  on public.project_lifecycle_events for select to authenticated
  using (public.is_internal_user());

create or replace function public.log_project_lifecycle_event(
  p_project_id uuid,
  p_project_name text,
  p_action text,
  p_from_status text,
  p_to_status text,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_lifecycle_events (
    project_id, project_name, action, from_status, to_status,
    reason, actor_user_id, metadata
  )
  values (
    p_project_id, p_project_name, p_action, p_from_status, p_to_status,
    nullif(trim(p_reason), ''), auth.uid(), coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function public.get_project_delete_impact(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects%rowtype;
  v_template_name text;
  v_main_tasks integer := 0;
  v_subtasks integer := 0;
  v_tasks_total integer := 0;
  v_comments integer := 0;
  v_activity integer := 0;
  v_users integer := 0;
begin
  if not public.is_internal_user() then
    raise exception 'Internal access required' using errcode = '42501';
  end if;

  select * into v_project from public.projects where id = p_project_id;
  if not found or v_project.deleted_at is not null then
    raise exception 'Project not found' using errcode = '23503';
  end if;

  if to_regclass('public.project_templates') is not null
     and v_project.source_template_id is not null then
    execute
      'select name || '' v'' || coalesce(version::text, ''1'')
       from public.project_templates
       where id = $1'
      into v_template_name
      using v_project.source_template_id;
  end if;

  select
    count(*) filter (where t.parent_task_id is null)::int,
    count(*) filter (where t.parent_task_id is not null)::int,
    count(*)::int
  into v_main_tasks, v_subtasks, v_tasks_total
  from public.tasks t
  where t.project_id = p_project_id;

  if to_regclass('public.comments') is not null then
    execute
      'select count(*)::int
       from public.comments c
       join public.tasks t on t.id = c.task_id
       where t.project_id = $1'
      into v_comments
      using p_project_id;
  end if;

  if to_regclass('public.project_activity') is not null then
    execute
      'select count(*)::int from public.project_activity where project_id = $1'
      into v_activity
      using p_project_id;
  end if;

  select count(*)::int into v_users
  from public.project_users pu
  where pu.project_id = p_project_id;

  return jsonb_build_object(
    'project_id', v_project.id,
    'project_name', v_project.name,
    'project_status', v_project.project_status,
    'created_at', v_project.created_at,
    'project_age_days', greatest(0, (current_date - v_project.created_at::date)),
    'template_name', v_template_name,
    'template_version', v_project.template_version,
    'main_tasks', v_main_tasks,
    'subtasks', v_subtasks,
    'tasks_total', v_tasks_total,
    'comments', coalesce(v_comments, 0),
    'activity_entries', coalesce(v_activity, 0),
    'users_assigned', v_users,
    'invitations', v_users
  );
end;
$$;

create or replace function public.transition_project_lifecycle(
  p_project_id uuid,
  p_action text,
  p_reason text default null
)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects%rowtype;
  v_from text;
  v_to text;
  v_event text;
begin
  if not public.is_internal_user() then
    raise exception 'Internal access required' using errcode = '42501';
  end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if not found or v_project.deleted_at is not null then
    raise exception 'Project not found' using errcode = '23503';
  end if;

  v_from := v_project.project_status;

  case p_action
    when 'complete' then
      if v_project.project_status <> 'active' then
        raise exception 'Only active projects can be marked complete' using errcode = '23514';
      end if;
      v_to := 'completed';
      v_event := 'project_completed';
      update public.projects
      set project_status = 'completed',
          completed_at = now(),
          completed_by = auth.uid(),
          archived_at = null,
          archived_by = null
      where id = p_project_id
      returning * into v_project;

    when 'archive' then
      if v_project.project_status not in ('active', 'completed') then
        raise exception 'Only active or completed projects can be archived' using errcode = '23514';
      end if;
      v_to := 'archived';
      v_event := 'project_archived';
      update public.projects
      set project_status = 'archived',
          archived_at = now(),
          archived_by = auth.uid()
      where id = p_project_id
      returning * into v_project;

    when 'restore_active' then
      if v_project.project_status <> 'archived' then
        raise exception 'Only archived projects can be restored' using errcode = '23514';
      end if;
      v_to := 'active';
      v_event := 'project_restored';
      update public.projects
      set project_status = 'active',
          archived_at = null,
          archived_by = null,
          completed_at = null,
          completed_by = null
      where id = p_project_id
      returning * into v_project;

    when 'restore_completed' then
      if v_project.project_status <> 'archived' then
        raise exception 'Only archived projects can be restored' using errcode = '23514';
      end if;
      v_to := 'completed';
      v_event := 'project_restored';
      update public.projects
      set project_status = 'completed',
          archived_at = null,
          archived_by = null,
          completed_at = coalesce(v_project.completed_at, now()),
          completed_by = coalesce(v_project.completed_by, auth.uid())
      where id = p_project_id
      returning * into v_project;

    else
      raise exception 'Unknown lifecycle action: %', p_action using errcode = '23514';
  end case;

  perform public.log_project_lifecycle_event(
    p_project_id, v_project.name, v_event, v_from, v_to, p_reason
  );

  return v_project;
end;
$$;

create or replace function public.permanently_delete_project(
  p_project_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects%rowtype;
  v_impact jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if nullif(trim(p_reason), '') is null then
    raise exception 'Delete reason is required' using errcode = '23514';
  end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if not found or v_project.deleted_at is not null then
    raise exception 'Project not found' using errcode = '23503';
  end if;

  if v_project.project_status <> 'archived' then
    update public.projects
    set project_status = 'archived',
        archived_at = coalesce(archived_at, now()),
        archived_by = coalesce(archived_by, auth.uid())
    where id = p_project_id
    returning * into v_project;
  end if;

  v_impact := public.get_project_delete_impact(p_project_id);

  perform public.log_project_lifecycle_event(
    p_project_id,
    v_project.name,
    'project_deleted',
    v_project.project_status,
    'deleted',
    p_reason,
    v_impact
  );

  update public.projects
  set deleted_at = now(),
      deleted_by = auth.uid()
  where id = p_project_id;
end;
$$;

create or replace function public.admin_get_lifecycle_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent jsonb;
begin
  if not public.is_internal_user() then
    raise exception 'Internal access required' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc), '[]'::jsonb)
  into v_recent
  from (
    select
      id, project_id, project_name, action, from_status, to_status,
      reason, actor_user_id, created_at
    from public.project_lifecycle_events
    order by created_at desc
    limit 20
  ) e;

  return jsonb_build_object(
    'active_count', (select count(*)::int from public.projects where deleted_at is null and project_status = 'active'),
    'completed_count', (select count(*)::int from public.projects where deleted_at is null and project_status = 'completed'),
    'archived_count', (select count(*)::int from public.projects where deleted_at is null and project_status = 'archived'),
    'deleted_this_month', (
      select count(*)::int from public.projects
      where deleted_at is not null
        and deleted_at >= date_trunc('month', now())
    ),
    'recent_events', v_recent
  );
end;
$$;

grant execute on function public.get_project_delete_impact(uuid) to authenticated;
grant execute on function public.transition_project_lifecycle(uuid, text, text) to authenticated;
grant execute on function public.permanently_delete_project(uuid, text) to authenticated;
grant execute on function public.admin_get_lifecycle_dashboard() to authenticated;

drop policy if exists "Invited users read shared projects" on public.projects;
create policy "Invited users read shared projects"
  on public.projects for select
  to authenticated
  using (
    deleted_at is null
    and project_status in ('active', 'completed')
    and is_shared = true
    and exists (
      select 1
      from public.project_users pu
      join public.profiles me on me.id = auth.uid()
      where pu.project_id = projects.id
        and lower(pu.email) = lower(me.email)
    )
  );

drop policy if exists "Internal users read all projects" on public.projects;
create policy "Internal users read all projects"
  on public.projects for select
  to authenticated
  using (
    deleted_at is null
    and public.is_internal_user()
  );

drop policy if exists "Admins read deleted projects" on public.projects;
create policy "Admins read deleted projects"
  on public.projects for select
  to authenticated
  using (
    deleted_at is not null
    and public.is_admin()
  );

drop policy if exists "Internal users delete projects" on public.projects;
create policy "No direct project delete"
  on public.projects for delete
  to authenticated
  using (false);

create or replace function public.trg_projects_log_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.log_project_lifecycle_event(
    new.id,
    new.name,
    'project_created',
    null,
    coalesce(new.project_status, 'active'),
    null
  );
  return new;
end;
$$;

drop trigger if exists projects_log_created on public.projects;
create trigger projects_log_created
  after insert on public.projects
  for each row
  execute function public.trg_projects_log_created();
