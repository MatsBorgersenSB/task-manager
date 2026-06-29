-- Extend activity_logs for typed audit events and client-readable history.
-- Maps to the task_activity spec (event_type, old/new values, created_by).

alter table public.activity_logs
  add column if not exists event_type text not null default 'field_change';

create index if not exists activity_logs_task_id_event_type_idx
  on public.activity_logs (task_id, event_type);

comment on column public.activity_logs.event_type is
  'field_change | task_created | comment_added | link_added | subtask_created | converted_to_subtask | promoted_to_main';

-- Clients on shared projects can read activity (app filters internal-only entries).
drop policy if exists "Shared project users can read activity logs" on public.activity_logs;

create policy "Shared project users can read activity logs"
  on public.activity_logs for select
  to authenticated
  using (
    exists (
      select 1
      from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = activity_logs.task_id
        and p.is_shared = true
    )
  );
