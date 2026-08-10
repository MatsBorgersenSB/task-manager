-- Per-project task renumbering: start from 1, or set a specific display number.
-- Idempotent: also re-applies per-project uniqueness from 044 if still missing.

-- Ensure display IDs are unique within a project (not globally).
alter table public.tasks
  drop constraint if exists tasks_task_number_key;

drop index if exists tasks_task_number_idx;

create unique index if not exists tasks_project_id_task_number_idx
  on public.tasks (project_id, task_number);

create index if not exists tasks_task_number_lookup_idx
  on public.tasks (project_id, task_number);

-- Assign next number per project when inserting without an explicit number.
create or replace function public.assign_task_number()
returns trigger
language plpgsql
as $$
begin
  if NEW.task_number is not null and NEW.task_number > 0 then
    return NEW;
  end if;

  if NEW.project_id is null then
    select coalesce(max(task_number), 0) + 1
    into NEW.task_number
    from public.tasks
    where project_id is null;
  else
    select coalesce(max(task_number), 0) + 1
    into NEW.task_number
    from public.tasks
    where project_id = NEW.project_id;
  end if;

  return NEW;
end;
$$;

drop trigger if exists tasks_assign_task_number on public.tasks;

create trigger tasks_assign_task_number
  before insert on public.tasks
  for each row
  execute function public.assign_task_number();

-- Renumber all tasks in a project to 1..n (current order preserved).
create or replace function public.renumber_project_tasks(p_project_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_internal_user() then
    raise exception 'Internal access required to renumber tasks';
  end if;

  if p_project_id is null then
    raise exception 'Project is required';
  end if;

  -- Phase 1: move to unique negatives to avoid (project_id, task_number) clashes.
  with ranked as (
    select
      id,
      row_number() over (
        order by task_number asc nulls last, created_at asc nulls last, id asc
      )::integer as rn
    from public.tasks
    where project_id = p_project_id
  )
  update public.tasks as t
  set task_number = -r.rn
  from ranked as r
  where t.id = r.id;

  -- Phase 2: flip negatives to final 1..n (preserves phase-1 order).
  update public.tasks
  set task_number = -task_number
  where project_id = p_project_id
    and task_number < 0;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

grant execute on function public.renumber_project_tasks(uuid) to authenticated;

comment on function public.renumber_project_tasks(uuid) is
  'Renumber project tasks to 1..n preserving current order. Internal users only.';

-- Set a specific display number; swaps with the occupant if that number is taken.
create or replace function public.set_task_display_number(
  p_task_id uuid,
  p_new_number integer
)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.tasks%rowtype;
  occupant_id uuid;
  old_number integer;
  temp_number integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_internal_user() then
    raise exception 'Internal access required to change task numbers';
  end if;

  if p_task_id is null then
    raise exception 'Task is required';
  end if;

  if p_new_number is null or p_new_number < 1 then
    raise exception 'Task number must be a positive integer';
  end if;

  select * into target
  from public.tasks
  where id = p_task_id
  for update;

  if not found then
    raise exception 'Task not found';
  end if;

  old_number := target.task_number;

  if old_number = p_new_number then
    return target;
  end if;

  select id into occupant_id
  from public.tasks
  where project_id is not distinct from target.project_id
    and task_number = p_new_number
    and id <> p_task_id
  for update;

  if occupant_id is not null then
    -- Swap via a temporary negative unique to this project.
    temp_number := -abs(old_number) - 1000000;
    if exists (
      select 1
      from public.tasks
      where project_id is not distinct from target.project_id
        and task_number = temp_number
    ) then
      temp_number := -abs(p_new_number) - 2000000;
    end if;

    update public.tasks
    set task_number = temp_number
    where id = p_task_id;

    update public.tasks
    set task_number = old_number
    where id = occupant_id;

    update public.tasks
    set task_number = p_new_number
    where id = p_task_id;
  else
    update public.tasks
    set task_number = p_new_number
    where id = p_task_id;
  end if;

  select * into target
  from public.tasks
  where id = p_task_id;

  return target;
end;
$$;

grant execute on function public.set_task_display_number(uuid, integer) to authenticated;

comment on function public.set_task_display_number(uuid, integer) is
  'Set a task display number within its project; swaps if occupied. Internal users only.';

notify pgrst, 'reload schema';
