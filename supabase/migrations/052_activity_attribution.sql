-- Full user attribution on project feed, notifications, and comments.

alter table public.project_activity
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz;

alter table public.user_notifications
  add column if not exists actor_user_id uuid references auth.users(id) on delete set null,
  add column if not exists event_type text;

create index if not exists user_notifications_actor_user_id_idx
  on public.user_notifications (actor_user_id)
  where actor_user_id is not null;

alter table public.comments
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz;

comment on column public.user_notifications.actor_user_id is
  'User who performed the action that triggered this notification.';
comment on column public.user_notifications.event_type is
  'Machine-readable event key for formatting and deduplication.';
