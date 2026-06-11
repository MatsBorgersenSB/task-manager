-- Track who created each task (for "Created by Client" badge).
-- Run after 006_tasks_and_projects.sql.

alter table public.tasks
  add column if not exists created_by uuid references public.profiles (id) on delete set null;

create index if not exists tasks_created_by_idx on public.tasks (created_by);
