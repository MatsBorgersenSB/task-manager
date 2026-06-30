-- Fix infinite recursion in profiles RLS policies.
-- Profiles policies must NOT subquery profiles under RLS.
-- Pattern matches is_admin() from 003_harden_auth.sql.
-- Safe to re-run: uses CREATE OR REPLACE and DROP POLICY IF EXISTS.

-- ---------------------------------------------------------------------------
-- Role helper: admin or internal staff (bypasses RLS)
-- ---------------------------------------------------------------------------
create or replace function public.is_internal_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'internal')
  );
$$;

grant execute on function public.is_internal_user() to authenticated;

-- ---------------------------------------------------------------------------
-- Replace recursive policies (originally 006_tasks_and_projects + 009_task_comments)
-- ---------------------------------------------------------------------------

-- Internal/admin: SB Owner pickers, task assignment lookups.
drop policy if exists "Internal users can read profiles for tasks" on public.profiles;

create policy "Internal users can read profiles for tasks"
  on public.profiles for select
  to authenticated
  using (public.is_internal_user());

-- Comment author emails when the comment is visible to the viewer.
drop policy if exists "Read profiles for visible comments" on public.profiles;

create policy "Read profiles for visible comments"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1
      from public.comments c
      where c.user_id = profiles.id
        and (
          c.type = 'client'
          or public.is_internal_user()
        )
    )
  );
