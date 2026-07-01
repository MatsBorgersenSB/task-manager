-- Standard Bio User Access & Login Intelligence Center
-- Login sessions, activity tracking, admin-only directory RPCs.

alter table public.profiles
  add column if not exists last_login_at timestamptz,
  add column if not exists last_activity_at timestamptz,
  add column if not exists display_name text;

comment on column public.profiles.last_login_at is
  'Most recent successful authentication.';
comment on column public.profiles.last_activity_at is
  'Last client heartbeat while session active.';

create table if not exists public.user_login_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  login_at timestamptz not null default now(),
  logout_at timestamptz,
  session_duration_seconds integer,
  auth_provider text,
  ip_address text,
  user_agent text,
  device_type text,
  browser text,
  platform text,
  is_suspicious boolean not null default false,
  suspicion_reason text,
  created_at timestamptz not null default now(),
  constraint user_login_sessions_duration_nonneg
    check (session_duration_seconds is null or session_duration_seconds >= 0)
);

create index if not exists idx_user_login_sessions_user_login
  on public.user_login_sessions (user_id, login_at desc);

create index if not exists idx_user_login_sessions_suspicious
  on public.user_login_sessions (is_suspicious, login_at desc)
  where is_suspicious = true;

alter table public.user_login_sessions enable row level security;

drop policy if exists "Users can insert own login sessions" on public.user_login_sessions;
create policy "Users can insert own login sessions"
  on public.user_login_sessions for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update own login sessions" on public.user_login_sessions;
create policy "Users can update own login sessions"
  on public.user_login_sessions for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Admins can read all login sessions" on public.user_login_sessions;
create policy "Admins can read all login sessions"
  on public.user_login_sessions for select to authenticated
  using (public.is_admin());

comment on table public.user_login_sessions is
  'Per-sign-in audit trail for Standard Bio Access Center (admin-only read).';

-- Record login and return session id
create or replace function public.record_user_login(
  p_auth_provider text default 'email',
  p_ip_address text default null,
  p_user_agent text default null,
  p_device_type text default null,
  p_browser text default null,
  p_platform text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_session_id uuid;
  v_suspicious boolean := false;
  v_reason text := null;
  v_known_device boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.user_login_sessions s
    where s.user_id = v_user_id
      and coalesce(s.browser, '') = coalesce(p_browser, '')
      and coalesce(s.platform, '') = coalesce(p_platform, '')
      and coalesce(s.device_type, '') = coalesce(p_device_type, '')
    limit 1
  ) into v_known_device;

  if not v_known_device and exists (
    select 1 from public.user_login_sessions where user_id = v_user_id limit 1
  ) then
    v_suspicious := true;
    v_reason := 'Sign-in from new device or browser';
  end if;

  insert into public.user_login_sessions (
    user_id, auth_provider, ip_address, user_agent,
    device_type, browser, platform, is_suspicious, suspicion_reason
  )
  values (
    v_user_id, nullif(trim(p_auth_provider), ''), nullif(trim(p_ip_address), ''),
    nullif(trim(p_user_agent), ''), nullif(trim(p_device_type), ''),
    nullif(trim(p_browser), ''), nullif(trim(p_platform), ''),
    v_suspicious, v_reason
  )
  returning id into v_session_id;

  update public.profiles
  set
    last_login_at = now(),
    last_activity_at = now()
  where id = v_user_id;

  return v_session_id;
end;
$$;

create or replace function public.record_user_activity()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  update public.profiles
  set last_activity_at = now()
  where id = auth.uid();
end;
$$;

create or replace function public.end_user_login_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  update public.user_login_sessions
  set
    logout_at = now(),
    session_duration_seconds = greatest(
      0,
      extract(epoch from (now() - login_at))::integer
    )
  where id = p_session_id
    and user_id = auth.uid()
    and logout_at is null;
end;
$$;

-- Admin directory: users + project counts + session stats
create or replace function public.admin_get_access_directory()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.email), '[]'::jsonb)
  into v_result
  from (
    select
      p.id,
      p.email,
      p.role,
      p.created_at,
      p.last_login_at,
      p.last_activity_at,
      coalesce(p.display_name, split_part(p.email, '@', 1)) as display_name,
      (
        select count(*)::int
        from public.project_users pu
        where lower(pu.email) = lower(p.email)
      ) as projects_assigned,
      (
        select count(distinct pu.project_id)::int
        from public.project_users pu
        join public.projects pr on pr.id = pu.project_id
        where lower(pu.email) = lower(p.email)
          and pr.is_shared = true
      ) as projects_shared,
      (
        select count(*)::int
        from public.user_login_sessions s
        where s.user_id = p.id
      ) as login_count,
      (
        select count(*)::int
        from public.user_login_sessions s
        where s.user_id = p.id and s.is_suspicious = true
      ) as suspicious_login_count
    from public.profiles p
  ) t;

  return v_result;
end;
$$;

create or replace function public.admin_get_user_access_detail(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile jsonb;
  v_sessions jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select to_jsonb(t) into v_profile
  from (
    select
      p.id,
      p.email,
      p.role,
      p.created_at,
      p.last_login_at,
      p.last_activity_at,
      coalesce(p.display_name, split_part(p.email, '@', 1)) as display_name,
      (
        select count(*)::int from public.project_users pu
        where lower(pu.email) = lower(p.email)
      ) as projects_assigned,
      (
        select count(distinct pu.project_id)::int
        from public.project_users pu
        join public.projects pr on pr.id = pu.project_id
        where lower(pu.email) = lower(p.email) and pr.is_shared = true
      ) as projects_shared
    from public.profiles p
    where p.id = p_user_id
  ) t;

  if v_profile is null then
    return null;
  end if;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.login_at desc), '[]'::jsonb)
  into v_sessions
  from (
    select
      id, login_at, logout_at, session_duration_seconds,
      auth_provider, ip_address, user_agent, device_type,
      browser, platform, is_suspicious, suspicion_reason
    from public.user_login_sessions
    where user_id = p_user_id
    order by login_at desc
    limit 100
  ) s;

  return jsonb_build_object('profile', v_profile, 'sessions', v_sessions);
end;
$$;

create or replace function public.admin_get_recent_suspicious_logins(p_limit integer default 25)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return (
    select coalesce(jsonb_agg(to_jsonb(t) order by t.login_at desc), '[]'::jsonb)
    from (
      select
        s.id,
        s.user_id,
        p.email,
        s.login_at,
        s.auth_provider,
        s.ip_address,
        s.browser,
        s.platform,
        s.device_type,
        s.suspicion_reason
      from public.user_login_sessions s
      join public.profiles p on p.id = s.user_id
      where s.is_suspicious = true
      order by s.login_at desc
      limit greatest(1, least(p_limit, 100))
    ) t
  );
end;
$$;

grant execute on function public.record_user_login(text, text, text, text, text, text) to authenticated;
grant execute on function public.record_user_activity() to authenticated;
grant execute on function public.end_user_login_session(uuid) to authenticated;
grant execute on function public.admin_get_access_directory() to authenticated;
grant execute on function public.admin_get_user_access_detail(uuid) to authenticated;
grant execute on function public.admin_get_recent_suspicious_logins(integer) to authenticated;
