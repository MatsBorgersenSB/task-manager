-- conversation_participants INSERT: add USING clause alongside WITH CHECK.
-- Run after 022_conversation_participants_select_conversation.sql.

drop policy if exists "participants_insert_self" on public.conversation_participants;

create policy "participants_insert_self"
  on public.conversation_participants
  for insert
  to authenticated
  using (true)
  with check (user_id = auth.uid());

notify pgrst, 'reload schema';
