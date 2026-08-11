-- Allow permanent delete from active/completed (auto-archives first).
-- Safe to re-run.

create or replace function public.permanently_delete_project(
  p_project_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects%rowtype;
  v_impact jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if nullif(trim(p_reason), '') is null then
    raise exception 'Delete reason is required' using errcode = '23514';
  end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if not found or v_project.deleted_at is not null then
    raise exception 'Project not found' using errcode = '23503';
  end if;

  if v_project.project_status <> 'archived' then
    update public.projects
    set project_status = 'archived',
        archived_at = coalesce(archived_at, now()),
        archived_by = coalesce(archived_by, auth.uid())
    where id = p_project_id
    returning * into v_project;
  end if;

  v_impact := public.get_project_delete_impact(p_project_id);

  perform public.log_project_lifecycle_event(
    p_project_id,
    v_project.name,
    'project_deleted',
    v_project.project_status,
    'deleted',
    p_reason,
    v_impact
  );

  update public.projects
  set deleted_at = now(),
      deleted_by = auth.uid()
  where id = p_project_id;
end;
$$;

grant execute on function public.permanently_delete_project(uuid, text) to authenticated;

notify pgrst, 'reload schema';
