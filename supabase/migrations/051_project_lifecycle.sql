-- Standard Bio Enterprise Project Lifecycle Management
-- States: active → completed → archived → deleted (soft, final)

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
begin
  if not public.is_internal_user() then
    raise exception 'Internal access required' using errcode = '42501';
  end if;

  select * into v_project from public.projects where id = p_project_id;
  if not found or v_project.deleted_at is not null then
    raise exception 'Project not found' using errcode = '23503';
  end if;

  if v_project.source_template_id is not null then
    select name || ' v' || coalesce(version::text, '1')
    into v_template_name
    from public.project_templates
    where id = v_project.source_template_id;
  end if;

  return jsonb_build_object(
    'project_id', v_project.id,
    'project_name', v_project.name,
    'project_status', v_project.project_status,
    'created_at', v_project.created_at,
    'project_age_days', greatest(0, (current_date - v_project.created_at::date)),
    'template_name', v_template_name,
    'template_version', v_project.template_version,
    'main_tasks', (
      select count(*)::int from public.tasks t
      where t.project_id = p_project_id and t.parent_task_id is null
    ),
    'subtasks', (
      select count(*)::int from public.tasks t
      where t.project_id = p_project_id and t.parent_task_id is not null
    ),
    'tasks_total', (
      select count(*)::int from public.tasks t where t.project_id = p_project_id
    ),
    'comments', (
      select count(*)::int from public.comments c
      join public.tasks t on t.id = c.task_id
      where t.project_id = p_project_id
    ),
    'activity_entries', (
      select count(*)::int from public.project_activity pa
      where pa.project_id = p_project_id
    ),
    'users_assigned', (
      select count(*)::int from public.project_users pu
      where pu.project_id = p_project_id
    ),
    'invitations', (
      select count(*)::int from public.project_users pu
      where pu.project_id = p_project_id
    )
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
    raise exception 'Project must be archived before permanent deletion' using errcode = '23514';
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
