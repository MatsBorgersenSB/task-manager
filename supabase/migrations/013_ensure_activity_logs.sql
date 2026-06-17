-- Ensure activity_logs exists (safe to re-run on production).
-- Combines 010_activity_logs.sql + 011_activity_logs_app_insert.sql.
-- App inserts logs from TaskPanel; no DB trigger.

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  field_name text not null,
  old_value text,
  new_value text,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_task_id_idx
  on public.activity_logs (task_id);

create index if not exists activity_logs_task_id_created_at_idx
  on public.activity_logs (task_id, created_at desc);

alter table public.activity_logs enable row level security;

drop policy if exists "Internal users can read activity logs" on public.activity_logs;

create policy "Internal users can read activity logs"
  on public.activity_logs for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.role in ('admin', 'internal')
    )
  );

drop policy if exists "Authenticated users can insert activity logs" on public.activity_logs;

create policy "Authenticated users can insert activity logs"
  on public.activity_logs for insert
  to authenticated
  with check (changed_by = auth.uid());

-- App-level inserts only (no trigger).
drop trigger if exists tasks_activity_log_trigger on public.tasks;

revoke insert, update, delete on public.activity_logs from anon;
grant insert on public.activity_logs to authenticated;

comment on table public.activity_logs is 'Field-level task change history (TaskPanel Activity section)';
