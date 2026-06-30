-- Standard Bio Project Execution Platform
-- Extends template foundation with versioning, dependencies, milestones,
-- project metadata, and automated template instantiation.

-- ---------------------------------------------------------------------------
-- Template versioning & admin fields
-- ---------------------------------------------------------------------------
alter table public.project_templates
  add column if not exists slug text,
  add column if not exists version integer not null default 1,
  add column if not exists is_latest boolean not null default true,
  add column if not exists is_archived boolean not null default false,
  add column if not exists knowledge_notes text,
  add column if not exists health_baseline jsonb not null default '{}'::jsonb,
  add column if not exists cloned_from_id uuid references public.project_templates (id) on delete set null;

create index if not exists idx_project_templates_slug_latest
  on public.project_templates (slug, is_latest)
  where is_latest = true and is_archived = false;

create unique index if not exists idx_project_templates_slug_version
  on public.project_templates (slug, version)
  where slug is not null;

comment on column public.project_templates.slug is
  'Stable identifier across versions, e.g. commissioning, installation.';
comment on column public.project_templates.health_baseline is
  'JSON: critical_task_ids, critical_milestone_ids, required_deliverables.';

-- ---------------------------------------------------------------------------
-- Template task extensions
-- ---------------------------------------------------------------------------
alter table public.project_template_tasks
  add column if not exists is_milestone boolean not null default false,
  add column if not exists is_critical boolean not null default false,
  add column if not exists estimated_duration_days integer,
  add column if not exists template_notes text,
  add column if not exists area_name text,
  add column if not exists area_code text;

alter table public.project_template_tasks
  drop constraint if exists project_template_tasks_estimated_duration_nonneg;

alter table public.project_template_tasks
  add constraint project_template_tasks_estimated_duration_nonneg
    check (estimated_duration_days is null or estimated_duration_days >= 0);

-- ---------------------------------------------------------------------------
-- Template task dependencies
-- ---------------------------------------------------------------------------
create table if not exists public.project_template_task_dependencies (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.project_templates (id) on delete cascade,
  predecessor_template_task_id uuid not null references public.project_template_tasks (id) on delete cascade,
  successor_template_task_id uuid not null references public.project_template_tasks (id) on delete cascade,
  dependency_type text not null default 'FS'
    check (dependency_type in ('FS', 'FF', 'SS', 'SF')),
  lag_days integer not null default 0,
  created_at timestamptz not null default now(),
  constraint template_task_deps_distinct
    check (predecessor_template_task_id <> successor_template_task_id),
  constraint template_task_deps_lag_nonneg
    check (lag_days >= 0),
  unique (predecessor_template_task_id, successor_template_task_id)
);

create index if not exists idx_template_task_deps_template
  on public.project_template_task_dependencies (template_id);

comment on table public.project_template_task_dependencies is
  'Template predecessor links. FS=Finish→Start, FF, SS, SF.';

-- ---------------------------------------------------------------------------
-- Project metadata for execution
-- ---------------------------------------------------------------------------
alter table public.projects
  add column if not exists client_name text,
  add column if not exists project_owner text,
  add column if not exists start_date date,
  add column if not exists source_template_id uuid references public.project_templates (id) on delete set null,
  add column if not exists template_version integer;

create index if not exists idx_projects_source_template
  on public.projects (source_template_id)
  where source_template_id is not null;

-- ---------------------------------------------------------------------------
-- Live task extensions
-- ---------------------------------------------------------------------------
alter table public.tasks
  add column if not exists is_milestone boolean not null default false,
  add column if not exists is_critical boolean not null default false,
  add column if not exists estimated_duration_days integer,
  add column if not exists template_notes text,
  add column if not exists source_template_task_id uuid;

create index if not exists idx_tasks_milestone
  on public.tasks (project_id, is_milestone)
  where is_milestone = true;

-- ---------------------------------------------------------------------------
-- Live task dependencies
-- ---------------------------------------------------------------------------
create table if not exists public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  predecessor_task_id uuid not null references public.tasks (id) on delete cascade,
  successor_task_id uuid not null references public.tasks (id) on delete cascade,
  dependency_type text not null default 'FS'
    check (dependency_type in ('FS', 'FF', 'SS', 'SF')),
  lag_days integer not null default 0,
  created_at timestamptz not null default now(),
  constraint task_deps_distinct
    check (predecessor_task_id <> successor_task_id),
  constraint task_deps_lag_nonneg
    check (lag_days >= 0),
  unique (predecessor_task_id, successor_task_id)
);

create index if not exists idx_task_deps_project
  on public.task_dependencies (project_id);

create index if not exists idx_task_deps_predecessor
  on public.task_dependencies (predecessor_task_id);

create index if not exists idx_task_deps_successor
  on public.task_dependencies (successor_task_id);

alter table public.project_template_task_dependencies enable row level security;
alter table public.task_dependencies enable row level security;

drop policy if exists "Authenticated users can read template dependencies" on public.project_template_task_dependencies;
create policy "Authenticated users can read template dependencies"
  on public.project_template_task_dependencies for select to authenticated using (true);

drop policy if exists "Authenticated users can manage template dependencies" on public.project_template_task_dependencies;
create policy "Authenticated users can manage template dependencies"
  on public.project_template_task_dependencies for all to authenticated
  using (true) with check (auth.uid() is not null);

drop policy if exists "Authenticated users can read task dependencies" on public.task_dependencies;
create policy "Authenticated users can read task dependencies"
  on public.task_dependencies for select to authenticated using (true);

drop policy if exists "Authenticated users can manage task dependencies" on public.task_dependencies;
create policy "Authenticated users can manage task dependencies"
  on public.task_dependencies for all to authenticated
  using (true) with check (auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- Circular dependency validation (template)
-- ---------------------------------------------------------------------------
create or replace function public.validate_template_dependency_cycle()
returns trigger
language plpgsql
as $$
begin
  if exists (
    with recursive chain as (
      select new.successor_template_task_id as task_id
      union
      select d.successor_template_task_id
      from public.project_template_task_dependencies d
      join chain c on d.predecessor_template_task_id = c.task_id
      where d.template_id = new.template_id
    )
    select 1
    from chain
    where task_id = new.predecessor_template_task_id
  ) then
    raise exception 'Circular template dependency detected'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_template_dependency_cycle on public.project_template_task_dependencies;
create trigger trg_validate_template_dependency_cycle
  before insert or update on public.project_template_task_dependencies
  for each row execute function public.validate_template_dependency_cycle();

-- ---------------------------------------------------------------------------
-- Circular dependency validation (live tasks)
-- ---------------------------------------------------------------------------
create or replace function public.validate_task_dependency_cycle()
returns trigger
language plpgsql
as $$
begin
  if exists (
    with recursive chain as (
      select new.successor_task_id as task_id
      union
      select d.successor_task_id
      from public.task_dependencies d
      join chain c on d.predecessor_task_id = c.task_id
      where d.project_id = new.project_id
    )
    select 1
    from chain
    where task_id = new.predecessor_task_id
  ) then
    raise exception 'Circular task dependency detected'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_task_dependency_cycle on public.task_dependencies;
create trigger trg_validate_task_dependency_cycle
  before insert or update on public.task_dependencies
  for each row execute function public.validate_task_dependency_cycle();

-- ---------------------------------------------------------------------------
-- Instantiate project from template (single transaction, bulk insert)
-- ---------------------------------------------------------------------------
create or replace function public.instantiate_project_from_template(
  p_name text,
  p_client_name text default null,
  p_project_owner text default null,
  p_start_date date default current_date,
  p_template_id uuid default null,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_template public.project_templates%rowtype;
  v_task record;
  v_area record;
  v_new_task_id uuid;
  v_id_map jsonb := '{}'::jsonb;
  v_due date;
  v_intervention date;
  v_template_name text;
begin
  if p_name is null or trim(p_name) = '' then
    raise exception 'Project name is required' using errcode = '23514';
  end if;

  if p_template_id is null then
    insert into public.projects (name, description, client_name, project_owner, start_date, created_by)
    values (trim(p_name), nullif(trim(p_description), ''), nullif(trim(p_client_name), ''),
            nullif(trim(p_project_owner), ''), p_start_date, auth.uid())
    returning id into v_project_id;
    return v_project_id;
  end if;

  select * into v_template from public.project_templates where id = p_template_id;
  if not found then
    raise exception 'Template not found' using errcode = '23503';
  end if;

  v_template_name := v_template.name || ' v' || v_template.version::text;

  insert into public.projects (
    name, description, client_name, project_owner, start_date,
    source_template_id, template_version, created_by
  )
  values (
    trim(p_name),
    coalesce(nullif(trim(p_description), ''), v_template.description),
    nullif(trim(p_client_name), ''),
    nullif(trim(p_project_owner), ''),
    coalesce(p_start_date, current_date),
    p_template_id,
    v_template.version,
    auth.uid()
  )
  returning id into v_project_id;

  -- Main template tasks first
  for v_task in
    select *
    from public.project_template_tasks
    where template_id = p_template_id
      and parent_template_task_id is null
    order by sort_order, created_at
  loop
    v_due := case
      when v_task.due_offset_days is not null
        then (coalesce(p_start_date, current_date) + v_task.due_offset_days)
      else null
    end;
    v_intervention := case
      when v_task.intervention_offset_days is not null
        then (coalesce(p_start_date, current_date) + v_task.intervention_offset_days)
      else null
    end;

    if v_task.area_id is not null then
      select name, code into v_area from public.areas where id = v_task.area_id;
    elsif v_task.area_name is not null then
      v_area.name := v_task.area_name;
      v_area.code := v_task.area_code;
    else
      v_area.name := null;
      v_area.code := null;
    end if;

    insert into public.tasks (
      project_id, title, description, status, priority, responsible,
      sb_status, sb_priority, sb_owner, visibility_scope,
      area_name, area_code, date_due, intervention_date,
      is_milestone, is_critical, estimated_duration_days, template_notes,
      source_template_task_id, created_by
    )
    values (
      v_project_id,
      v_task.title,
      v_task.description,
      coalesce(v_task.default_status, 'Pending'),
      v_task.priority,
      v_task.responsible,
      v_task.sb_status,
      v_task.priority,
      v_task.sb_owner,
      coalesce(v_task.visibility_scope, 'internal'),
      v_area.name,
      v_area.code,
      v_due,
      v_intervention,
      v_task.is_milestone,
      v_task.is_critical,
      v_task.estimated_duration_days,
      v_task.template_notes,
      v_task.id,
      auth.uid()
    )
    returning id into v_new_task_id;

    v_id_map := v_id_map || jsonb_build_object(v_task.id::text, v_new_task_id::text);
  end loop;

  -- Subtasks
  for v_task in
    select *
    from public.project_template_tasks
    where template_id = p_template_id
      and parent_template_task_id is not null
    order by sort_order, created_at
  loop
    v_new_task_id := (v_id_map ->> v_task.parent_template_task_id::text)::uuid;
    if v_new_task_id is null then
      raise exception 'Parent template task not instantiated: %', v_task.parent_template_task_id
        using errcode = '23503';
    end if;

    v_due := case
      when v_task.due_offset_days is not null
        then (coalesce(p_start_date, current_date) + v_task.due_offset_days)
      else null
    end;
    v_intervention := case
      when v_task.intervention_offset_days is not null
        then (coalesce(p_start_date, current_date) + v_task.intervention_offset_days)
      else null
    end;

    if v_task.area_id is not null then
      select name, code into v_area from public.areas where id = v_task.area_id;
    elsif v_task.area_name is not null then
      v_area.name := v_task.area_name;
      v_area.code := v_task.area_code;
    else
      v_area.name := null;
      v_area.code := null;
    end if;

    insert into public.tasks (
      project_id, title, description, status, priority, responsible,
      sb_status, sb_priority, sb_owner, visibility_scope,
      area_name, area_code, date_due, intervention_date,
      parent_task_id, is_milestone, is_critical, estimated_duration_days,
      template_notes, source_template_task_id, created_by
    )
    values (
      v_project_id,
      v_task.title,
      v_task.description,
      coalesce(v_task.default_status, 'Pending'),
      v_task.priority,
      v_task.responsible,
      v_task.sb_status,
      v_task.priority,
      v_task.sb_owner,
      coalesce(v_task.visibility_scope, 'internal_client'),
      v_area.name,
      v_area.code,
      v_due,
      v_intervention,
      v_new_task_id,
      v_task.is_milestone,
      v_task.is_critical,
      v_task.estimated_duration_days,
      v_task.template_notes,
      v_task.id,
      auth.uid()
    )
    returning id into v_new_task_id;

    v_id_map := v_id_map || jsonb_build_object(v_task.id::text, v_new_task_id::text);
  end loop;

  -- Dependencies
  insert into public.task_dependencies (
    project_id, predecessor_task_id, successor_task_id, dependency_type, lag_days
  )
  select
    v_project_id,
    (v_id_map ->> d.predecessor_template_task_id::text)::uuid,
    (v_id_map ->> d.successor_template_task_id::text)::uuid,
    d.dependency_type,
    d.lag_days
  from public.project_template_task_dependencies d
  where d.template_id = p_template_id
    and v_id_map ? d.predecessor_template_task_id::text
    and v_id_map ? d.successor_template_task_id::text;

  return v_project_id;
end;
$$;

grant execute on function public.instantiate_project_from_template(
  text, text, text, date, uuid, text
) to authenticated;

comment on function public.instantiate_project_from_template is
  'Creates a project and all tasks/subtasks/deps from a Standard Bio template.';
