-- Task area (name + code) for client/internal task views.
-- Run after 025_task_links.sql.

alter table public.tasks
  add column if not exists area_name text,
  add column if not exists area_code text;

create index if not exists tasks_area_code_idx on public.tasks (area_code);
