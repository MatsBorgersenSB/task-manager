-- Fix conversation_participants INSERT RLS so users can add themselves and mentioned users.
-- Run after 017_chat_unread.sql.

alter table public.conversation_participants enable row level security;

drop policy if exists "Allow adding participants" on public.conversation_participants;
drop policy if exists "Allow insert participants" on public.conversation_participants;
drop policy if exists "Users can add participants to conversations" on public.conversation_participants;

create policy "Users can add participants to conversations"
  on public.conversation_participants
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.conversations
      where conversations.id = conversation_participants.conversation_id
    )
  );

notify pgrst, 'reload schema';
