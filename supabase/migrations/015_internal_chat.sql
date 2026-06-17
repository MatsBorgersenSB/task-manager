-- Internal team chat (admin + internal roles only).
-- Run after 014_visibility_scope.sql.

create table if not exists public.internal_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  message text not null check (char_length(trim(message)) > 0),
  mentioned_user_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists internal_chat_messages_created_at_idx
  on public.internal_chat_messages (created_at);

alter table public.internal_chat_messages enable row level security;

drop policy if exists "Internal users can read chat messages" on public.internal_chat_messages;
drop policy if exists "Internal users can send chat messages" on public.internal_chat_messages;

create policy "Internal users can read chat messages"
  on public.internal_chat_messages for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.role in ('admin', 'internal')
    )
  );

create policy "Internal users can send chat messages"
  on public.internal_chat_messages for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.role in ('admin', 'internal')
    )
  );

alter table public.internal_chat_messages replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'internal_chat_messages'
  ) then
    alter publication supabase_realtime add table public.internal_chat_messages;
  end if;
end $$;
