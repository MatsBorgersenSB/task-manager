-- Per-project task numbers: first task in each project is #1, not a global serial.

-- Renumber existing tasks within each project (oldest first).
with ranked as (
  select
    id,
    row_number() over (
      partition by project_id
      order by created_at asc nulls last, task_number asc
    )::integer as new_number
  from public.tasks
  where project_id is not null
)
update public.tasks as t
set task_number = r.new_number
from ranked as r
where t.id = r.id;

-- Tasks without a project keep a standalone sequence.
with ranked as (
  select
    id,
    row_number() over (
      order by created_at asc nulls last, task_number asc
    )::integer as new_number
  from public.tasks
  where project_id is null
)
update public.tasks as t
set task_number = r.new_number
from ranked as r
where t.id = r.id;

-- Replace global uniqueness with per-project uniqueness.
alter table public.tasks
  drop constraint if exists tasks_task_number_key;

drop index if exists tasks_task_number_idx;

create unique index if not exists tasks_project_id_task_number_idx
  on public.tasks (project_id, task_number);

create index if not exists tasks_task_number_lookup_idx
  on public.tasks (project_id, task_number);

-- Stop using the global serial default; assign numbers per project on insert.
alter table public.tasks
  alter column task_number drop default;

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

comment on column public.tasks.task_number is
  'Display ID scoped to project_id; first task in a project is 1.';
