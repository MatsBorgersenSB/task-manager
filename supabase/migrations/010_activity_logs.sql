-- Task field change history for internal audit log in TaskPanel.
-- Run after 009_task_comments.sql.

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

-- Rows are inserted only by the trigger below.
revoke insert, update, delete on public.activity_logs from anon, authenticated;

create or replace function public.log_task_field_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if TG_OP <> 'UPDATE' then
    return NEW;
  end if;

  if OLD.title is distinct from NEW.title then
    insert into activity_logs (task_id, field_name, old_value, new_value, changed_by)
    values (NEW.id, 'Issue', OLD.title, NEW.title, uid);
  end if;

  if OLD.status is distinct from NEW.status then
    insert into activity_logs (task_id, field_name, old_value, new_value, changed_by)
    values (NEW.id, 'status', OLD.status, NEW.status, uid);
  end if;

  if OLD.priority is distinct from NEW.priority then
    insert into activity_logs (task_id, field_name, old_value, new_value, changed_by)
    values (NEW.id, 'Priority', OLD.priority, NEW.priority, uid);
  end if;

  if OLD.responsible is distinct from NEW.responsible then
    insert into activity_logs (task_id, field_name, old_value, new_value, changed_by)
    values (NEW.id, 'Responsible', OLD.responsible, NEW.responsible, uid);
  end if;

  if OLD.description is distinct from NEW.description then
    insert into activity_logs (task_id, field_name, old_value, new_value, changed_by)
    values (NEW.id, 'CE Comments', OLD.description, NEW.description, uid);
  end if;

  if OLD.response_sb is distinct from NEW.response_sb then
    insert into activity_logs (task_id, field_name, old_value, new_value, changed_by)
    values (NEW.id, 'Response or Action taken by SB', OLD.response_sb, NEW.response_sb, uid);
  end if;

  if OLD.date_due is distinct from NEW.date_due then
    insert into activity_logs (task_id, field_name, old_value, new_value, changed_by)
    values (NEW.id, 'Date Due', OLD.date_due::text, NEW.date_due::text, uid);
  end if;

  if OLD.date_completed is distinct from NEW.date_completed then
    insert into activity_logs (task_id, field_name, old_value, new_value, changed_by)
    values (NEW.id, 'Date Completed', OLD.date_completed::text, NEW.date_completed::text, uid);
  end if;

  if OLD.registration_date is distinct from NEW.registration_date then
    insert into activity_logs (task_id, field_name, old_value, new_value, changed_by)
    values (NEW.id, 'Registration Date', OLD.registration_date::text, NEW.registration_date::text, uid);
  end if;

  if OLD.risk is distinct from NEW.risk then
    insert into activity_logs (task_id, field_name, old_value, new_value, changed_by)
    values (NEW.id, 'Risk', OLD.risk, NEW.risk, uid);
  end if;

  if OLD.risk_comment is distinct from NEW.risk_comment then
    insert into activity_logs (task_id, field_name, old_value, new_value, changed_by)
    values (NEW.id, 'Risk Comment', OLD.risk_comment, NEW.risk_comment, uid);
  end if;

  if OLD.sb_status is distinct from NEW.sb_status then
    insert into activity_logs (task_id, field_name, old_value, new_value, changed_by)
    values (NEW.id, 'SB Status', OLD.sb_status, NEW.sb_status, uid);
  end if;

  if OLD.sb_owner is distinct from NEW.sb_owner then
    insert into activity_logs (task_id, field_name, old_value, new_value, changed_by)
    values (NEW.id, 'SB Owner', OLD.sb_owner, NEW.sb_owner, uid);
  end if;

  if OLD.sb_note is distinct from NEW.sb_note then
    insert into activity_logs (task_id, field_name, old_value, new_value, changed_by)
    values (NEW.id, 'SB Note', OLD.sb_note, NEW.sb_note, uid);
  end if;

  return NEW;
end;
$$;

drop trigger if exists tasks_activity_log_trigger on public.tasks;

create trigger tasks_activity_log_trigger
  after update on public.tasks
  for each row
  execute function public.log_task_field_changes();
