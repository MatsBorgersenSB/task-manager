-- Allow nested subtasks (main → level 1 → level 2 → …).
-- Replaces the two-level limit from 046_task_hierarchy_protection.sql.
-- Cycles, self-parenting, and cross-project parents stay rejected.

create or replace function public.validate_task_parent_hierarchy()
returns trigger
language plpgsql
as $$
declare
  parent_row public.tasks%rowtype;
  ancestor_id uuid;
  steps integer := 0;
begin
  if new.parent_task_id is null then
    return new;
  end if;

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

  if new.project_id is not null
     and parent_row.project_id is not null
     and new.project_id is distinct from parent_row.project_id then
    raise exception 'Parent task must belong to the same project'
      using errcode = '23514';
  end if;

  -- Walk ancestors of the proposed parent. Hitting this row is a cycle.
  -- The step cap also stops a pre-existing loop elsewhere in the chain.
  ancestor_id := new.parent_task_id;
  while ancestor_id is not null loop
    if ancestor_id = new.id then
      raise exception 'Circular task hierarchy is not allowed'
        using errcode = '23514';
    end if;

    steps := steps + 1;
    if steps > 50 then
      raise exception 'Task hierarchy is too deep or contains a cycle'
        using errcode = '23514';
    end if;

    select t.parent_task_id
    into ancestor_id
    from public.tasks t
    where t.id = ancestor_id;
  end loop;

  return new;
end;
$$;

comment on function public.validate_task_parent_hierarchy() is
  'Ensures task.parent_task_id is an acyclic hierarchy. Nested subtasks are allowed.';
