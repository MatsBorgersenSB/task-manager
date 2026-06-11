-- Harden auth: RLS, invites, audit logs, race-safe profile creation.
-- Run after 001_profiles.sql (and 002_admin_role.sql if applicable).

-- ---------------------------------------------------------------------------
-- Helper: check if the current user is an admin
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
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
      and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Invites table — predefined role before first sign-up
-- ---------------------------------------------------------------------------
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null check (role in ('admin', 'internal', 'external')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.invites enable row level security;

-- ---------------------------------------------------------------------------
-- Audit logs — admin actions
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  user_id uuid references auth.users (id) on delete set null,
  target_id uuid,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

-- ---------------------------------------------------------------------------
-- Profiles RLS — read-only for clients; mutations via SECURITY DEFINER RPCs
-- ---------------------------------------------------------------------------
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Admins can update profiles" on public.profiles;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Admins can read all profiles"
  on public.profiles for select
  using (public.is_admin());

-- No INSERT/UPDATE/DELETE policies — profiles are managed by RPC functions only.

-- ---------------------------------------------------------------------------
-- Invites RLS — admins only
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can read invites" on public.invites;
drop policy if exists "Admins can manage invites" on public.invites;

create policy "Admins can read invites"
  on public.invites for select
  using (public.is_admin());

-- Inserts/updates/deletes happen via admin_create_invite RPC only.

-- ---------------------------------------------------------------------------
-- Audit logs RLS — admins read-only
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can read audit logs" on public.audit_logs;

create policy "Admins can read audit logs"
  on public.audit_logs for select
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Internal: write audit log (called from SECURITY DEFINER functions)
-- ---------------------------------------------------------------------------
create or replace function public.write_audit_log(
  p_action text,
  p_user_id uuid,
  p_target_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (action, user_id, target_id)
  values (p_action, p_user_id, p_target_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- ensure_user_profile — idempotent, race-safe, invite-aware role assignment
-- Priority: first user → admin; else invite → invited role; else domain → internal; else external
-- ---------------------------------------------------------------------------
create or replace function public.ensure_user_profile(
  user_email text,
  company_domain text default 'yourcompany.com'
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  existing public.profiles;
  profile_count integer;
  assigned_role text;
  normalized_email text := lower(trim(user_email));
  email_domain text;
  invite_record public.invites;
  used_invite boolean := false;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if normalized_email is null or normalized_email = '' then
    raise exception 'Email is required';
  end if;

  -- Fast path: profile already exists (idempotent)
  select * into existing from public.profiles where id = uid;
  if found then
    return existing;
  end if;

  select count(*) into profile_count from public.profiles;

  if profile_count = 0 then
    assigned_role := 'admin';
  else
    select * into invite_record
    from public.invites
    where email = normalized_email
    limit 1;

    if found then
      assigned_role := invite_record.role;
      used_invite := true;
    else
      email_domain := lower(split_part(normalized_email, '@', 2));
      if email_domain = lower(trim(company_domain)) then
        assigned_role := 'internal';
      else
        assigned_role := 'external';
      end if;
    end if;
  end if;

  -- Race-safe insert: concurrent sign-ups won't create duplicates
  insert into public.profiles (id, email, role)
  values (uid, normalized_email, assigned_role)
  on conflict (id) do nothing;

  select * into existing from public.profiles where id = uid;
  if not found then
    raise exception 'Could not create or load profile';
  end if;

  -- Consume invite after successful profile creation
  if used_invite then
    delete from public.invites where email = normalized_email;
  end if;

  return existing;
end;
$$;

grant execute on function public.ensure_user_profile(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_update_user_role — admins only; blocks self role change
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_user_role(
  target_user_id uuid,
  new_role text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.profiles;
  old_role text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if auth.uid() = target_user_id then
    raise exception 'You cannot change your own role';
  end if;

  if new_role not in ('admin', 'internal', 'external') then
    raise exception 'Invalid role: %', new_role;
  end if;

  select role into old_role from public.profiles where id = target_user_id;
  if not found then
    raise exception 'User not found';
  end if;

  if old_role = new_role then
    select * into updated from public.profiles where id = target_user_id;
    return updated;
  end if;

  update public.profiles
  set role = new_role
  where id = target_user_id
  returning * into updated;

  perform public.write_audit_log(
    'role_change:' || old_role || '->' || new_role,
    auth.uid(),
    target_user_id
  );

  return updated;
end;
$$;

grant execute on function public.admin_update_user_role(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_create_invite — admins only
-- ---------------------------------------------------------------------------
create or replace function public.admin_create_invite(
  invite_email text,
  invite_role text
)
returns public.invites
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(invite_email));
  result public.invites;
  existing_profile public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if normalized_email is null or normalized_email = '' then
    raise exception 'Email is required';
  end if;

  if invite_role not in ('admin', 'internal', 'external') then
    raise exception 'Invalid role: %', invite_role;
  end if;

  select * into existing_profile
  from public.profiles
  where email = normalized_email;

  if found then
    raise exception 'User already registered with this email';
  end if;

  insert into public.invites (email, role, invited_by)
  values (normalized_email, invite_role, auth.uid())
  on conflict (email) do update set
    role = excluded.role,
    invited_by = excluded.invited_by,
    created_at = now()
  returning * into result;

  perform public.write_audit_log(
    'user_invite:' || invite_role,
    auth.uid(),
    result.id
  );

  return result;
end;
$$;

grant execute on function public.admin_create_invite(text, text) to authenticated;
