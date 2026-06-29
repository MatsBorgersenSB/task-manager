-- Restore is_shared for projects that were shared before the column existed.
-- Apply after 037 if production ran ADD COLUMN without an immediate backfill.
-- Safe to re-run.

-- Projects with invited users must stay shared for client RLS.
update public.projects p
set is_shared = true
where is_shared = false
  and exists (
    select 1
    from public.project_users pu
    where pu.project_id = p.id
  );

-- Known shared projects (extend this list when adding columns with DEFAULT false).
update public.projects
set is_shared = true
where is_shared = false
  and id in (
    '6e5d8a93-c1c3-46f8-9770-9f5049094424'::uuid  -- Dashboard Project
  );
