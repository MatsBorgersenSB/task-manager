-- Enforce two-level task hierarchy at the database layer.
-- Prevents self-reference, circular references, and depth > 2.

create or replace function public.validate_task_parent_hierarchy()
returns trigger
language plpgsql
as $$
declare
  parent_row public.tasks%rowtype;
begin
  if new.parent_task_id is null then
    return new;
  end if;

  -- Self-reference
  if new.parent_task_id = new.id then
    raise exception 'A task cannot be its own parent'
      using errcode = '23514';
  end if;

  select *
  into parent_row
  from public.tasks
  where id = new.parent_task_id;

  if not found then
    raise exception 'Parent task not found'
      using errcode = '23503';
  end if;

  -- Parent must be a main task (max depth = 2)
  if parent_row.parent_task_id is not null then
    raise exception 'Subtasks can only be attached to main tasks (maximum hierarchy depth is 2)'
      using errcode = '23514';
  end if;

  -- Parent and child must belong to the same project when both are set
  if new.project_id is not null
     and parent_row.project_id is not null
     and new.project_id is distinct from parent_row.project_id then
    raise exception 'Parent task must belong to the same project'
      using errcode = '23514';
  end if;

  -- Direct circular reference (A → B while B → A)
  if parent_row.parent_task_id = new.id then
    raise exception 'Circular task hierarchy is not allowed'
      using errcode = '23514';
  end if;

  -- Reverse link: proposed parent is already a subtask of this task
  if exists (
    select 1
    from public.tasks child
    where child.id = new.parent_task_id
      and child.parent_task_id = new.id
  ) then
    raise exception 'Circular task hierarchy is not allowed'
      using errcode = '23514';
  end if;

  -- Main tasks with existing subtasks cannot become subtasks
  if exists (
    select 1
    from public.tasks child
    where child.parent_task_id = new.id
  ) then
    raise exception 'A task with subtasks cannot become a subtask'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_task_parent_hierarchy on public.tasks;

create trigger trg_validate_task_parent_hierarchy
  before insert or update of parent_task_id
  on public.tasks
  for each row
  execute function public.validate_task_parent_hierarchy();

comment on function public.validate_task_parent_hierarchy() is
  'Ensures task.parent_task_id forms a two-level hierarchy without cycles.';
