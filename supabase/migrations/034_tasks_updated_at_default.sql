-- Ensure tasks.updated_at exists with a default for new rows.
-- Safe to re-run (008 may have added the column without default).

alter table public.tasks
  add column if not exists updated_at timestamptz default now();

update public.tasks
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;
