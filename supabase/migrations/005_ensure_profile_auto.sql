-- Automatic profile creation on login/signup (idempotent, race-safe).
-- Run after 001–004 migrations.
--
-- Role assignment (first match wins):
--   1. First profile in DB        → admin
--   2. Matching pending invite  → invited role (then invite is consumed)
--   3. Email @ company_domain   → internal
--   4. Otherwise                → external
--
-- Email always comes from auth.users (auth.uid()) — never from client input.

create or replace function public.ensure_user_profile(
  user_email text default null,
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
  normalized_email text;
  email_domain text;
  invite_record public.invites;
  used_invite boolean := false;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Single source of truth: authenticated user's email in auth.users
  select lower(trim(email)) into normalized_email
  from auth.users
  where id = uid;

  if normalized_email is null or normalized_email = '' or position('@' in normalized_email) = 0 then
    raise exception 'Auth user has no valid email';
  end if;

  -- Idempotent: return existing profile immediately
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

  -- Race-safe: concurrent sign-ups will not create duplicate rows
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

comment on function public.ensure_user_profile(text, text) is
  'Creates profile for auth.uid() if missing. Idempotent. user_email param is ignored (legacy).';
