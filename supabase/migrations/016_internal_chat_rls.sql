-- RLS policies for internal chat (conversations / conversation_participants / messages).
-- Run in Supabase SQL Editor if tables already exist outside migration history.

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.conversation_participants enable row level security;

-- ---------------------------------------------------------------------------
-- conversations
-- ---------------------------------------------------------------------------
drop policy if exists "Allow authenticated users to create conversations" on public.conversations;
drop policy if exists "Allow users to read conversations" on public.conversations;

create policy "Allow authenticated users to create conversations"
  on public.conversations
  for insert
  to authenticated
  with check (true);

create policy "Allow users to read conversations"
  on public.conversations
  for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
drop policy if exists "Allow users to send messages" on public.messages;
drop policy if exists "Allow users to read messages in their conversations" on public.messages;

create policy "Allow users to send messages"
  on public.messages
  for insert
  to authenticated
  with check (sender_id = auth.uid());

create policy "Allow users to read messages in their conversations"
  on public.messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.conversation_participants
      where conversation_participants.conversation_id = messages.conversation_id
        and conversation_participants.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- conversation_participants
-- ---------------------------------------------------------------------------
drop policy if exists "Allow adding participants" on public.conversation_participants;
drop policy if exists "Allow users to read their participations" on public.conversation_participants;

create policy "Allow adding participants"
  on public.conversation_participants
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- Required for the messages SELECT policy subquery to evaluate correctly.
create policy "Allow users to read their participations"
  on public.conversation_participants
  for select
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Realtime (safe to re-run)
-- ---------------------------------------------------------------------------
alter table public.messages replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

notify pgrst, 'reload schema';
