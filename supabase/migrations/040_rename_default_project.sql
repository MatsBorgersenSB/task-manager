-- Rename the default project to Carbon Emergente.
-- Safe to re-run.

update public.projects
set name = 'Carbon Emergente'
where name in ('Dashboard Project', 'Default Project')
  and name <> 'Carbon Emergente';

update public.projects
set name = 'Carbon Emergente'
where id = '6e5d8a93-c1c3-46f8-9770-9f5049094424'::uuid
  and name <> 'Carbon Emergente';
