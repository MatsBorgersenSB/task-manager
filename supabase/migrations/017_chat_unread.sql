-- Unread tracking for internal chat.
-- Run after 016_internal_chat_rls.sql.

alter table public.conversation_participants
  add column if not exists last_read_at timestamptz;

create index if not exists conversation_participants_last_read_at_idx
  on public.conversation_participants (user_id, conversation_id, last_read_at);

drop policy if exists "Allow users to update their read state" on public.conversation_participants;

create policy "Allow users to update their read state"
  on public.conversation_participants
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

notify pgrst, 'reload schema';
