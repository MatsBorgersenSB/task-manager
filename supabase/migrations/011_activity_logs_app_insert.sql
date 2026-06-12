-- Allow app-level activity logging from TaskPanel (replaces DB trigger).
-- Run after 010_activity_logs.sql.

drop trigger if exists tasks_activity_log_trigger on public.tasks;

drop policy if exists "Authenticated users can insert activity logs" on public.activity_logs;

create policy "Authenticated users can insert activity logs"
  on public.activity_logs for insert
  to authenticated
  with check (changed_by = auth.uid());

grant insert on public.activity_logs to authenticated;
