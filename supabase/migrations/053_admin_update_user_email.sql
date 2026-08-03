-- Admin email correction: update profile + related email references atomically.
-- auth.users.email must be updated separately via service role (see admin API).

create or replace function public.admin_update_user_email(
  target_user_id uuid,
  new_email text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_new text := lower(trim(new_email));
  old_email text;
  updated public.profiles;
  conflict_profile uuid;
begin
  if target_user_id is null then
    raise exception 'Target user is required';
  end if;

  if not public.is_admin() then
    perform public.write_audit_log(
      'email_change_denied',
      auth.uid(),
      target_user_id,
      jsonb_build_object('reason', 'not_admin', 'attempted_email', new_email)
    );
    raise exception 'Admin access required';
  end if;

  if auth.uid() = target_user_id then
    perform public.write_audit_log(
      'email_change_denied',
      auth.uid(),
      target_user_id,
      jsonb_build_object('reason', 'self_change', 'attempted_email', new_email)
    );
    raise exception 'You cannot change your own email here. Use account settings or contact support.';
  end if;

  if normalized_new is null
    or normalized_new = ''
    or position('@' in normalized_new) = 0
    or position('.' in split_part(normalized_new, '@', 2)) = 0 then
    perform public.write_audit_log(
      'email_change_denied',
      auth.uid(),
      target_user_id,
      jsonb_build_object('reason', 'invalid_email', 'attempted_email', new_email)
    );
    raise exception 'Valid email is required';
  end if;

  select email into old_email
  from public.profiles
  where id = target_user_id;

  if not found then
    perform public.write_audit_log(
      'email_change_denied',
      auth.uid(),
      target_user_id,
      jsonb_build_object('reason', 'user_not_found', 'attempted_email', normalized_new)
    );
    raise exception 'User not found';
  end if;

  if lower(trim(old_email)) = normalized_new then
    select * into updated from public.profiles where id = target_user_id;
    return updated;
  end if;

  select id into conflict_profile
  from public.profiles
  where lower(email) = normalized_new
    and id <> target_user_id
  limit 1;

  if conflict_profile is not null then
    perform public.write_audit_log(
      'email_change_denied',
      auth.uid(),
      target_user_id,
      jsonb_build_object(
        'reason', 'email_taken',
        'attempted_email', normalized_new,
        'conflict_profile_id', conflict_profile
      )
    );
    raise exception 'Another user already uses this email';
  end if;

  update public.profiles
  set email = normalized_new
  where id = target_user_id
  returning * into updated;

  update public.project_users
  set email = normalized_new
  where lower(email) = lower(old_email);

  update public.invites
  set email = normalized_new
  where lower(email) = lower(old_email);

  update public.tasks
  set updated_by = normalized_new
  where lower(trim(updated_by)) = lower(trim(old_email));

  update public.audit_logs
  set metadata = jsonb_set(metadata, '{target_email}', to_jsonb(normalized_new))
  where metadata->>'target_email' = old_email;

  update public.audit_logs
  set metadata = jsonb_set(metadata, '{email}', to_jsonb(normalized_new))
  where metadata->>'email' = old_email;

  perform public.write_audit_log(
    'email_change',
    auth.uid(),
    target_user_id,
    jsonb_build_object(
      'old_email', old_email,
      'new_email', normalized_new
    )
  );

  return updated;
end;
$$;

grant execute on function public.admin_update_user_email(uuid, text) to authenticated;
