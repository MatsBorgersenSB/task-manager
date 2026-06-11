-- Track who created each task (for "Created by Client" badge).
-- Run after 006_tasks_and_projects.sql.
-- Safe to re-run: skips existing column and constraint.

alter table public.tasks
  add column if not exists created_by uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_tasks_profiles'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint fk_tasks_profiles
      foreign key (created_by)
      references public.profiles (id)
      on delete set null;
  end if;
end $$;

create index if not exists tasks_created_by_idx on public.tasks (created_by);
