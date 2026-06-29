-- Keep projects.is_shared aligned with project_users invitations.
-- When a user is invited, the project must be shared for client RLS.
-- Safe to re-run. Does not unset is_shared when invites are removed.
-- Requires 037_project_sharing.sql (project_users table).

-- Sync any existing invites that predate this trigger.
update public.projects p
set is_shared = true
where is_shared = false
  and exists (
    select 1
    from public.project_users pu
    where pu.project_id = p.id
  );

create or replace function public.mark_project_shared()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.projects
  set is_shared = true
  where id = new.project_id
    and is_shared = false;

  return new;
end;
$$;

drop trigger if exists trg_project_shared on public.project_users;

create trigger trg_project_shared
after insert on public.project_users
for each row
execute function public.mark_project_shared();
