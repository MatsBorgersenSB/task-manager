-- conversation_participants RLS — idempotent, valid PostgreSQL syntax.
-- PostgreSQL does NOT support CREATE POLICY IF NOT EXISTS.
-- Run in Supabase SQL Editor (safe to re-run).

-- ---------------------------------------------------------------------------
-- conversations (required for participant inserts + chat bootstrap)
-- ---------------------------------------------------------------------------
alter table public.conversations enable row level security;

drop policy if exists "Allow authenticated users to create conversations" on public.conversations;
drop policy if exists "Allow users to read conversations" on public.conversations;
drop policy if exists "conversations_insert" on public.conversations;
drop policy if exists "conversations_select" on public.conversations;

create policy "conversations_insert"
  on public.conversations
  for insert
  to authenticated
  with check (true);

create policy "conversations_select"
  on public.conversations
  for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- conversation_participants
-- ---------------------------------------------------------------------------
alter table public.conversation_participants enable row level security;

-- Drop legacy policy names (partial runs / older migrations)
drop policy if exists "Allow adding participants" on public.conversation_participants;
drop policy if exists "Allow insert participants" on public.conversation_participants;
drop policy if exists "Users can add participants to conversations" on public.conversation_participants;
drop policy if exists "Allow users to read their participations" on public.conversation_participants;
drop policy if exists "Allow users to read conversation participants" on public.conversation_participants;
drop policy if exists "Allow users to update their read state" on public.conversation_participants;
drop policy if exists "conversation_participants_select" on public.conversation_participants;
drop policy if exists "conversation_participants_insert" on public.conversation_participants;
drop policy if exists "conversation_participants_update" on public.conversation_participants;

create policy "conversation_participants_select"
  on public.conversation_participants
  for select
  to authenticated
  using (true);

-- INSERT policies support WITH CHECK only (not USING).
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

notify pgrst, 'reload schema';
