-- Intervention date + duration (idempotent; safe to re-run in SQL Editor).

alter table public.tasks
  add column if not exists intervention_date date;

alter table public.tasks
  add column if not exists intervention_hours integer;

comment on column public.tasks.intervention_date is
  'Planned or actual intervention date for the task.';

comment on column public.tasks.intervention_hours is
  'Intervention duration as total hours (each day = 8 hours).';
