-- Client Collaboration Sprint: acknowledgements, client-visible activity, project feed, notifications.

-- Task acknowledgements (client users)
alter table public.tasks
  add column if not exists acknowledged_by uuid references auth.users(id) on delete set null,
  add column if not exists acknowledged_at timestamptz;

-- Explicit client visibility on audit log entries
alter table public.activity_logs
  add column if not exists client_visible boolean not null default true;

create index if not exists activity_logs_client_visible_idx
  on public.activity_logs (task_id, client_visible);

-- Project-level activity feed (newest first in app)
create table if not exists public.project_activity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  event_type text not null,
  summary text not null,
  detail text,
  client_visible boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists project_activity_project_id_created_at_idx
  on public.project_activity (project_id, created_at desc);

create index if not exists project_activity_project_id_client_visible_idx
  on public.project_activity (project_id, client_visible, created_at desc);

comment on table public.project_activity is
  'Centralized project feed: task changes, client comments, acknowledgements, sharing events.';

-- In-app notifications (no email)
create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_user_id_created_at_idx
  on public.user_notifications (user_id, created_at desc);

create index if not exists user_notifications_user_id_unread_idx
  on public.user_notifications (user_id)
  where read_at is null;

-- RLS: project_activity
alter table public.project_activity enable row level security;

drop policy if exists "Internal users read all project activity" on public.project_activity;
create policy "Internal users read all project activity"
  on public.project_activity for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'internal')
    )
  );

drop policy if exists "Shared project users read client-visible activity" on public.project_activity;
create policy "Shared project users read client-visible activity"
  on public.project_activity for select
  to authenticated
  using (
    client_visible = true
    and exists (
      select 1 from public.projects pr
      where pr.id = project_activity.project_id
        and pr.is_shared = true
    )
  );

drop policy if exists "Authenticated users insert project activity" on public.project_activity;
create policy "Authenticated users insert project activity"
  on public.project_activity for insert
  to authenticated
  with check (true);

-- RLS: user_notifications
alter table public.user_notifications enable row level security;

drop policy if exists "Users read own notifications" on public.user_notifications;
create policy "Users read own notifications"
  on public.user_notifications for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users update own notification read state" on public.user_notifications;
create policy "Users update own notification read state"
  on public.user_notifications for update
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Authenticated insert notifications" on public.user_notifications;
create policy "Authenticated insert notifications"
  on public.user_notifications for insert
  to authenticated
  with check (true);

-- Backfill: mark known internal-only activity as not client-visible
update public.activity_logs
set client_visible = false
where field_name in (
  'Response or Action taken by SB',
  'SB Status',
  'SB Priority',
  'SB Owner',
  'Risk',
  'Risk Comment',
  'SB Note',
  'Priority',
  'Visibility',
  'Internal Comment'
)
or (event_type = 'comment_added' and field_name = 'Internal Comment');
