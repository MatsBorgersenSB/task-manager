-- Threaded task comments (client + internal).
-- Run after 008_tasks_updated_tracking.sql.

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('client', 'internal')),
  message text not null check (char_length(trim(message)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists comments_task_id_idx on public.comments (task_id);
create index if not exists comments_task_id_type_idx on public.comments (task_id, type);
create index if not exists comments_created_at_idx on public.comments (created_at);

alter table public.comments enable row level security;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated users can read client comments" on public.comments;
drop policy if exists "Internal users can read internal comments" on public.comments;
drop policy if exists "Authenticated users can insert client comments" on public.comments;
drop policy if exists "Internal users can insert internal comments" on public.comments;

create policy "Authenticated users can read client comments"
  on public.comments for select
  to authenticated
  using (type = 'client');

create policy "Internal users can read internal comments"
  on public.comments for select
  to authenticated
  using (
    type = 'internal'
    and exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.role in ('admin', 'internal')
    )
  );

create policy "Authenticated users can insert client comments"
  on public.comments for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and type = 'client'
  );

create policy "Internal users can insert internal comments"
  on public.comments for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and type = 'internal'
    and exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.role in ('admin', 'internal')
    )
  );

-- Allow reading comment author emails when the comment is visible to the viewer.
drop policy if exists "Read profiles for visible comments" on public.profiles;

create policy "Read profiles for visible comments"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1
      from public.comments c
      where c.user_id = profiles.id
        and (
          c.type = 'client'
          or exists (
            select 1
            from public.profiles me
            where me.id = auth.uid()
              and me.role in ('admin', 'internal')
          )
        )
    )
  );

-- Realtime (safe to re-run)
alter table public.comments replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'comments'
  ) then
    alter publication supabase_realtime add table public.comments;
  end if;
end $$;
