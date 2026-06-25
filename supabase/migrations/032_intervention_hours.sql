-- Intervention duration stored as total hours (days × 8 + hours).

alter table public.tasks
  add column if not exists intervention_hours integer;

comment on column public.tasks.intervention_hours is
  'Intervention duration as total hours (each day = 8 hours).';
