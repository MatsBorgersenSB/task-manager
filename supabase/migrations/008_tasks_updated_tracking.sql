-- Track who last modified each task and when.
-- Run after 007_tasks_created_by.sql.
-- Safe to re-run.

alter table public.tasks
  add column if not exists updated_by text;

alter table public.tasks
  add column if not exists updated_at timestamptz;
