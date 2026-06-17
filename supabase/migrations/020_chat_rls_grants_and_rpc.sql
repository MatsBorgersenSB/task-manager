-- Chat RLS + GRANTs + SECURITY DEFINER RPC (bypasses stubborn client-side RLS failures).
-- Safe to re-run in Supabase SQL Editor.

-- ---------------------------------------------------------------------------
-- GRANT table privileges (RLS alone is not enough without grants)
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;

grant select, insert on public.conversations to authenticated;
grant select, insert, update on public.conversation_participants to authenticated;
grant select, insert on public.messages to authenticated;

-- ---------------------------------------------------------------------------
-- Drop ALL existing policies on chat tables (unknown names from partial runs)
-- ---------------------------------------------------------------------------
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('conversations', 'conversation_participants', 'messages')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      pol.policyname,
      pol.schemaname,
      pol.tablename
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- conversations
-- ---------------------------------------------------------------------------
alter table public.conversations enable row level security;

create policy "conversations_select"
  on public.conversations
  for select
  to authenticated
  using (true);

create policy "conversations_insert"
  on public.conversations
  for insert
  to authenticated
  with check (true);

-- ---------------------------------------------------------------------------
-- conversation_participants
-- ---------------------------------------------------------------------------
alter table public.conversation_participants enable row level security;

create unique index if not exists conversation_participants_conversation_user_uidx
  on public.conversation_participants (conversation_id, user_id);

create policy "conversation_participants_select"
  on public.conversation_participants
  for select
  to authenticated
  using (true);

create policy "conversation_participants_insert"
  on public.conversation_participants
  for insert
  to authenticated
  with check (true);

create policy "conversation_participants_update"
  on public.conversation_participants
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
alter table public.messages enable row level security;

create policy "messages_select"
  on public.messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id
        and cp.user_id = auth.uid()
    )
  );

create policy "messages_insert"
  on public.messages
  for insert
  to authenticated
  with check (sender_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RPC: add participants (SECURITY DEFINER — reliable path for the app)
-- ---------------------------------------------------------------------------
create or replace function public.ensure_chat_participants(
  p_conversation_id uuid,
  p_user_ids uuid[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  participant uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_conversation_id is null then
    raise exception 'conversation_id is required';
  end if;

  if not exists (
    select 1 from public.conversations c where c.id = p_conversation_id
  ) then
    raise exception 'Conversation not found';
  end if;

  foreach participant in array coalesce(p_user_ids, '{}'::uuid[]) loop
    if participant is null then
      continue;
    end if;

    insert into public.conversation_participants (conversation_id, user_id)
    values (p_conversation_id, participant)
    on conflict do nothing;
  end loop;
end;
$$;

grant execute on function public.ensure_chat_participants(uuid, uuid[]) to authenticated;

-- Realtime
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
