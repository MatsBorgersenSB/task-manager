-- Link tasks as subtasks of a parent task (one level).
-- Safe to re-run.

alter table public.tasks
  add column if not exists parent_task_id uuid null references public.tasks (id) on delete set null;

create index if not exists idx_tasks_parent_task_id
  on public.tasks (parent_task_id);
