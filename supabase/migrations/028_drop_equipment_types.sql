-- Remove unused equipment type columns and reference table.
-- Run after 027_areas.sql (safe even if 028_equipment_types was never applied).

alter table public.tasks
  drop column if exists equipment_type_name,
  drop column if exists equipment_type_code;

drop index if exists public.tasks_equipment_type_code_idx;

drop table if exists public.equipment_types;
