-- Let an admin block or restore sign-in without the service-role key.
-- Apply in the Supabase SQL editor. Vercel does not run this file.

create or replace function public.admin_set_user_access(
  target_user_id uuid,
  denied boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_count integer;
begin
  if target_user_id is null then
    raise exception 'Target user is required';
  end if;

  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if auth.uid() = target_user_id then
    raise exception 'You cannot change your own account here.';
  end if;

  if not exists (select 1 from auth.users where id = target_user_id) then
    raise exception 'User was not found in authentication.';
  end if;

  if exists (
    select 1 from public.profiles
    where id = target_user_id and role = 'admin'
  ) then
    select count(*) into admin_count
    from public.profiles
    where role = 'admin';

    if admin_count <= 1 then
      raise exception 'Cannot remove access for the last admin.';
    end if;
  end if;

  update auth.users
  set
    banned_until = case
      when denied then now() + interval '100 years'
      else null
    end,
    raw_app_meta_data =
      coalesce(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('access_denied', denied)
  where id = target_user_id;

  return denied;
end;
$$;

create or replace function public.admin_list_denied_user_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  return query
  select u.id
  from auth.users u
  where coalesce(u.raw_app_meta_data ->> 'access_denied', '') = 'true'
     or (u.banned_until is not null and u.banned_until > now());
end;
$$;

revoke all on function public.admin_set_user_access(uuid, boolean) from public;
revoke all on function public.admin_list_denied_user_ids() from public;
grant execute on function public.admin_set_user_access(uuid, boolean) to authenticated;
grant execute on function public.admin_list_denied_user_ids() to authenticated;
