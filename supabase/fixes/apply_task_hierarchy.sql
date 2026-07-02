-- =============================================================================
-- FIX: "The database is missing the parent_task_id column"
-- Applies task-hierarchy migrations 036 + 046 in one idempotent script.
-- Safe to run multiple times. Paste into the Supabase SQL Editor and Run.
-- =============================================================================

-- ── 1. Column + FK (migration 036) ──────────────────────────────────────────
-- tasks.parent_task_id -> tasks.id (self-referencing, one level).
alter table public.tasks
  add column if not exists parent_task_id uuid null
  references public.tasks (id) on delete set null;

create index if not exists idx_tasks_parent_task_id
  on public.tasks (parent_task_id);

-- ── 2. Two-level hierarchy protection trigger (migration 046) ────────────────
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

  if new.parent_task_id = new.id then
    raise exception 'A task cannot be its own parent' using errcode = '23514';
  end if;

  select * into parent_row from public.tasks where id = new.parent_task_id;

  if not found then
    raise exception 'Parent task not found' using errcode = '23503';
  end if;

  if parent_row.parent_task_id is not null then
    raise exception 'Subtasks can only be attached to main tasks (maximum hierarchy depth is 2)'
      using errcode = '23514';
  end if;

  if new.project_id is not null
     and parent_row.project_id is not null
     and new.project_id is distinct from parent_row.project_id then
    raise exception 'Parent task must belong to the same project' using errcode = '23514';
  end if;

  if parent_row.parent_task_id = new.id then
    raise exception 'Circular task hierarchy is not allowed' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.tasks child
    where child.id = new.parent_task_id and child.parent_task_id = new.id
  ) then
    raise exception 'Circular task hierarchy is not allowed' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.tasks child where child.parent_task_id = new.id
  ) then
    raise exception 'A task with subtasks cannot become a subtask' using errcode = '23514';
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

-- ── 3. Force PostgREST to reload its schema cache ────────────────────────────
notify pgrst, 'reload schema';

-- =============================================================================
-- VERIFICATION (run these afterwards; each should return a row)
-- =============================================================================

-- 3a. Column exists?
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'parent_task_id';

-- 3b. Foreign key tasks.parent_task_id -> tasks.id exists?
-- SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS references_table, ccu.column_name AS references_column
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
-- JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'tasks' AND kcu.column_name = 'parent_task_id';

-- 3c. Trigger present?
-- SELECT tgname FROM pg_trigger WHERE tgname = 'trg_validate_task_parent_hierarchy';

-- 3d. RLS update policy on tasks (parent_task_id is covered by row-level UPDATE; no column restriction).
-- SELECT policyname, cmd, qual FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'tasks' AND cmd = 'UPDATE';
