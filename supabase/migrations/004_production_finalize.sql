-- Production finalization: hardened RLS, RPCs, audit schema, indexes, safeguards.
-- Run after 001_profiles.sql, 002_admin_role.sql (if needed), and 003_harden_auth.sql.

-- ---------------------------------------------------------------------------
-- Indexes for common admin / auth queries
-- ---------------------------------------------------------------------------
create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- Revoke direct table writes — all mutations must go through RPCs
-- ---------------------------------------------------------------------------
revoke insert, update, delete on public.profiles from anon, authenticated;
revoke insert, update, delete on public.invites from anon, authenticated;
revoke insert, update, delete on public.audit_logs from anon, authenticated;

grant select on public.profiles to authenticated;
grant select on public.invites to authenticated;
grant select on public.audit_logs to authenticated;

-- ---------------------------------------------------------------------------
-- Audit logs — actor / target / metadata (production schema)
-- ---------------------------------------------------------------------------
alter table public.audit_logs
  add column if not exists actor_user_id uuid references auth.users (id) on delete set null;

alter table public.audit_logs
  add column if not exists target_user_id uuid;

alter table public.audit_logs
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.audit_logs
set actor_user_id = user_id
where actor_user_id is null and user_id is not null;

update public.audit_logs
set target_user_id = target_id
where target_user_id is null and target_id is not null;

-- ---------------------------------------------------------------------------
-- Internal audit writer — not callable by clients
-- ---------------------------------------------------------------------------
create or replace function public.write_audit_log(
  p_action text,
  p_actor_user_id uuid,
  p_target_user_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (
    action,
    actor_user_id,
    target_user_id,
    metadata,
    user_id,
    target_id
  )
  values (
    p_action,
    p_actor_user_id,
    p_target_user_id,
    coalesce(p_metadata, '{}'::jsonb),
    p_actor_user_id,
    p_target_user_id
  );
end;
$$;

revoke all on function public.write_audit_log(text, uuid, uuid, jsonb) from public;
revoke all on function public.write_audit_log(text, uuid, uuid, jsonb) from anon;
revoke all on function public.write_audit_log(text, uuid, uuid, jsonb) from authenticated;

-- Drop legacy overload if present
drop function if exists public.write_audit_log(text, uuid, uuid);

-- ---------------------------------------------------------------------------
-- Helper: count admins (used by last-admin safeguard)
-- ---------------------------------------------------------------------------
create or replace function public.admin_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.profiles where role = 'admin';
$$;

revoke all on function public.admin_count() from public;
grant execute on function public.admin_count() to authenticated;

-- ---------------------------------------------------------------------------
-- ensure_user_profile — verify email matches auth.users; invite-aware; race-safe
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
  auth_email text;
  email_domain text;
  invite_record public.invites;
  used_invite boolean := false;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if normalized_email is null or normalized_email = '' or position('@' in normalized_email) = 0 then
    raise exception 'Valid email is required';
  end if;

  -- Never trust client-supplied email — must match auth.users
  select lower(trim(email)) into auth_email
  from auth.users
  where id = uid;

  if auth_email is null then
    raise exception 'Auth user not found';
  end if;

  if normalized_email <> auth_email then
    raise exception 'Email does not match authenticated account';
  end if;

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

  insert into public.profiles (id, email, role)
  values (uid, normalized_email, assigned_role)
  on conflict (id) do nothing;

  select * into existing from public.profiles where id = uid;
  if not found then
    raise exception 'Could not create or load profile';
  end if;

  if used_invite then
    delete from public.invites where email = normalized_email;
  end if;

  return existing;
end;
$$;

grant execute on function public.ensure_user_profile(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_update_user_role — admin check, last-admin safeguard, audit trail
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
  admins_remaining integer;
  meta jsonb;
begin
  if target_user_id is null then
    raise exception 'Target user is required';
  end if;

  if not public.is_admin() then
    perform public.write_audit_log(
      'role_change_denied',
      auth.uid(),
      target_user_id,
      jsonb_build_object('reason', 'not_admin', 'attempted_role', new_role)
    );
    raise exception 'Admin access required';
  end if;

  if auth.uid() = target_user_id then
    perform public.write_audit_log(
      'role_change_denied',
      auth.uid(),
      target_user_id,
      jsonb_build_object('reason', 'self_change', 'attempted_role', new_role)
    );
    raise exception 'You cannot change your own role';
  end if;

  if new_role is null or new_role not in ('admin', 'internal', 'external') then
    perform public.write_audit_log(
      'role_change_denied',
      auth.uid(),
      target_user_id,
      jsonb_build_object('reason', 'invalid_role', 'attempted_role', new_role)
    );
    raise exception 'Invalid role: %', coalesce(new_role, 'null');
  end if;

  select role into old_role from public.profiles where id = target_user_id;
  if not found then
    perform public.write_audit_log(
      'role_change_denied',
      auth.uid(),
      target_user_id,
      jsonb_build_object('reason', 'user_not_found', 'attempted_role', new_role)
    );
    raise exception 'User not found';
  end if;

  if old_role = new_role then
    select * into updated from public.profiles where id = target_user_id;
    return updated;
  end if;

  -- Prevent removing the last admin
  if old_role = 'admin' and new_role <> 'admin' then
    select public.admin_count() into admins_remaining;
    if admins_remaining <= 1 then
      perform public.write_audit_log(
        'role_change_denied',
        auth.uid(),
        target_user_id,
        jsonb_build_object('reason', 'last_admin', 'attempted_role', new_role)
      );
      raise exception 'Cannot remove the last admin';
    end if;
  end if;

  update public.profiles
  set role = new_role
  where id = target_user_id
  returning * into updated;

  meta := jsonb_build_object(
    'old_role', old_role,
    'new_role', new_role,
    'target_email', updated.email
  );

  perform public.write_audit_log('role_change', auth.uid(), target_user_id, meta);

  return updated;
end;
$$;

grant execute on function public.admin_update_user_role(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_create_invite — validated email + role; audit trail
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
  is_update boolean := false;
  meta jsonb;
begin
  if not public.is_admin() then
    perform public.write_audit_log(
      'invite_denied',
      auth.uid(),
      null,
      jsonb_build_object('reason', 'not_admin', 'email', invite_email, 'role', invite_role)
    );
    raise exception 'Admin access required';
  end if;

  if normalized_email is null or normalized_email = '' or position('@' in normalized_email) = 0 then
    perform public.write_audit_log(
      'invite_denied',
      auth.uid(),
      null,
      jsonb_build_object('reason', 'invalid_email', 'email', invite_email)
    );
    raise exception 'Valid email is required';
  end if;

  if invite_role is null or invite_role not in ('admin', 'internal', 'external') then
    perform public.write_audit_log(
      'invite_denied',
      auth.uid(),
      null,
      jsonb_build_object('reason', 'invalid_role', 'email', normalized_email, 'role', invite_role)
    );
    raise exception 'Invalid role: %', coalesce(invite_role, 'null');
  end if;

  select * into existing_profile
  from public.profiles
  where email = normalized_email;

  if found then
    perform public.write_audit_log(
      'invite_denied',
      auth.uid(),
      existing_profile.id,
      jsonb_build_object('reason', 'already_registered', 'email', normalized_email)
    );
    raise exception 'User already registered with this email';
  end if;

  select exists(select 1 from public.invites where email = normalized_email) into is_update;

  insert into public.invites (email, role, invited_by)
  values (normalized_email, invite_role, auth.uid())
  on conflict (email) do update set
    role = excluded.role,
    invited_by = excluded.invited_by,
    created_at = now()
  returning * into result;

  meta := jsonb_build_object(
    'email', normalized_email,
    'role', invite_role,
    'updated_existing', is_update
  );

  perform public.write_audit_log(
    case when is_update then 'invite_updated' else 'invite_created' end,
    auth.uid(),
    result.id,
    meta
  );

  return result;
end;
$$;

grant execute on function public.admin_create_invite(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS — reassert least-privilege (idempotent)
-- ---------------------------------------------------------------------------
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Admins can update profiles" on public.profiles;

create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Admins can read all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can read invites" on public.invites;
drop policy if exists "Admins can manage invites" on public.invites;

create policy "Admins can read invites"
  on public.invites for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can read audit logs" on public.audit_logs;

create policy "Admins can read audit logs"
  on public.audit_logs for select
  to authenticated
  using (public.is_admin());

-- No anon policies — anonymous users cannot read any auth tables.
