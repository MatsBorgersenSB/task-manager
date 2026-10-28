-- 061_wbs_main_task_numbering.sql
-- Separates main task numbers (1..M) from subtask internal ordering numbers (100001+)
-- so main tasks always number sequentially (1, 2, 3...) while subtasks display as 1.1, 1.2...

create or replace function public.assign_task_number()
returns trigger
language plpgsql
as $$
begin
  if NEW.task_number is not null and NEW.task_number > 0 then
    return NEW;
  end if;

  if NEW.parent_task_id is not null then
    -- Subtasks get a separate sequence >= 100001 so they never consume main task numbers 1..M
    if NEW.project_id is null then
      select greatest(coalesce(max(task_number), 100000), 100000) + 1
      into NEW.task_number
      from public.tasks
      where project_id is null;
    else
      select greatest(coalesce(max(task_number), 100000), 100000) + 1
      into NEW.task_number
      from public.tasks
      where project_id = NEW.project_id;
    end if;
  else
    -- Main tasks get the next sequential main-task number (1, 2, 3...)
    if NEW.project_id is null then
      select coalesce(max(task_number), 0) + 1
      into NEW.task_number
      from public.tasks
      where project_id is null
        and parent_task_id is null
        and task_number < 100000;
    else
      select coalesce(max(task_number), 0) + 1
      into NEW.task_number
      from public.tasks
      where project_id = NEW.project_id
        and parent_task_id is null
        and task_number < 100000;
    end if;
  end if;

  return NEW;
end;
$$;

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

  -- Phase 1: move all project tasks to unique negative numbers
  with ranked as (
    select
      id,
      row_number() over (
        order by
          (parent_task_id is not null) asc,
          task_number asc nulls last,
          created_at asc nulls last,
          id asc
      )::integer as rn
    from public.tasks
    where project_id = p_project_id
  )
  update public.tasks as t
  set task_number = -r.rn
  from ranked as r
  where t.id = r.id;

  -- Phase 2: assign 1..M to main tasks and 100001+ to subtasks
  with final_numbers as (
    select
      id,
      case
        when parent_task_id is null then
          row_number() over (
            partition by (parent_task_id is null)
            order by (-task_number) asc
          )::integer
        else
          100000 + row_number() over (
            partition by (parent_task_id is null)
            order by (-task_number) asc
          )::integer
      end as next_num
    from public.tasks
    where project_id = p_project_id
      and task_number < 0
  )
  update public.tasks as t
  set task_number = f.next_num
  from final_numbers as f
  where t.id = f.id;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

notify pgrst, 'reload schema';
