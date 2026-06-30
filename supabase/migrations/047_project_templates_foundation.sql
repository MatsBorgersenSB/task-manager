-- Foundation schema for future project templates (no UI in this sprint).
-- Templates define reusable main-task / subtask hierarchies with metadata.

create table if not exists public.project_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_templates_active
  on public.project_templates (is_active)
  where is_active = true;

comment on table public.project_templates is
  'Reusable project blueprints. Instantiation creates a live project + tasks.';

-- Template tasks: parent_template_task_id null = main task, set = subtask.
create table if not exists public.project_template_tasks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.project_templates (id) on delete cascade,
  parent_template_task_id uuid references public.project_template_tasks (id) on delete cascade,
  sort_order integer not null default 0,
  title text not null,
  description text,
  area_id uuid references public.areas (id) on delete set null,
  responsible text,
  sb_owner text,
  sb_status text,
  priority text,
  visibility_scope text,
  due_offset_days integer,
  intervention_offset_days integer,
  default_status text default 'Pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint project_template_tasks_due_offset_nonneg
    check (due_offset_days is null or due_offset_days >= 0),
  constraint project_template_tasks_intervention_offset_nonneg
    check (intervention_offset_days is null or intervention_offset_days >= 0)
);

create index if not exists idx_project_template_tasks_template
  on public.project_template_tasks (template_id, sort_order);

create index if not exists idx_project_template_tasks_parent
  on public.project_template_tasks (parent_template_task_id)
  where parent_template_task_id is not null;

comment on table public.project_template_tasks is
  'Template task tree. parent_template_task_id null = main task; otherwise subtask.';

comment on column public.project_template_tasks.due_offset_days is
  'Days from project instantiation date to set task due date.';

-- Two-level template hierarchy (mirror live tasks).
create or replace function public.validate_template_task_hierarchy()
returns trigger
language plpgsql
as $$
declare
  parent_row public.project_template_tasks%rowtype;
begin
  if new.parent_template_task_id is null then
    return new;
  end if;

  if new.parent_template_task_id = new.id then
    raise exception 'A template task cannot be its own parent'
      using errcode = '23514';
  end if;

  select *
  into parent_row
  from public.project_template_tasks
  where id = new.parent_template_task_id;

  if not found then
    raise exception 'Parent template task not found'
      using errcode = '23503';
  end if;

  if parent_row.template_id is distinct from new.template_id then
    raise exception 'Parent template task must belong to the same template'
      using errcode = '23514';
  end if;

  if parent_row.parent_template_task_id is not null then
    raise exception 'Template subtasks can only attach to main template tasks'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.project_template_tasks child
    where child.parent_template_task_id = new.id
  ) then
    raise exception 'A template task with subtasks cannot become a subtask'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_template_task_hierarchy on public.project_template_tasks;

create trigger trg_validate_template_task_hierarchy
  before insert or update of parent_template_task_id
  on public.project_template_tasks
  for each row
  execute function public.validate_template_task_hierarchy();

alter table public.project_templates enable row level security;
alter table public.project_template_tasks enable row level security;

drop policy if exists "Authenticated users can read project templates" on public.project_templates;
create policy "Authenticated users can read project templates"
  on public.project_templates for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can manage project templates" on public.project_templates;
create policy "Authenticated users can manage project templates"
  on public.project_templates for all
  to authenticated
  using (true)
  with check (auth.uid() is not null);

drop policy if exists "Authenticated users can read template tasks" on public.project_template_tasks;
create policy "Authenticated users can read template tasks"
  on public.project_template_tasks for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can manage template tasks" on public.project_template_tasks;
create policy "Authenticated users can manage template tasks"
  on public.project_template_tasks for all
  to authenticated
  using (true)
  with check (auth.uid() is not null);
