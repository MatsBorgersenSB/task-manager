-- Run in Supabase SQL Editor (Dashboard → SQL)
-- Fresh installs: run this file. Existing DBs: also run 002_admin_role.sql

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'internal', 'external')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Admins can read all profiles" on public.profiles;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Admins can read all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  );

-- Profile rows are created via ensure_user_profile() RPC (security definer).
-- No client INSERT/UPDATE policies — see 003_harden_auth.sql for full RLS hardening.

-- Assign role: first user → admin; else domain-based internal/external.
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
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if normalized_email is null or normalized_email = '' then
    raise exception 'Email is required';
  end if;

  select * into existing from public.profiles where id = uid;
  if found then
    return existing;
  end if;

  select count(*) into profile_count from public.profiles;

  if profile_count = 0 then
    assigned_role := 'admin';
  else
    email_domain := lower(split_part(normalized_email, '@', 2));
    if email_domain = lower(trim(company_domain)) then
      assigned_role := 'internal';
    else
      assigned_role := 'external';
    end if;
  end if;

  insert into public.profiles (id, email, role)
  values (uid, normalized_email, assigned_role)
  returning * into existing;

  return existing;
end;
$$;

grant execute on function public.ensure_user_profile(text, text) to authenticated;
