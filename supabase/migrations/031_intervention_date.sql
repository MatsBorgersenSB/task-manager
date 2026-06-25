-- Intervention date (between due and completed).

alter table public.tasks
  add column if not exists intervention_date date;

comment on column public.tasks.intervention_date is
  'Planned or actual intervention date for the task.';
