-- conversation_participants: allow SELECT for all rows in conversations the user belongs to.
-- Run after 021_conversation_participants_self_rls.sql.

drop policy if exists "participants_select_self" on public.conversation_participants;
drop policy if exists "participants_select_conversation" on public.conversation_participants;

create policy "participants_select_conversation"
  on public.conversation_participants
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or conversation_id in (
      select cp.conversation_id
      from public.conversation_participants cp
      where cp.user_id = auth.uid()
    )
  );

-- participants_insert_self and participants_update_self unchanged (021).

notify pgrst, 'reload schema';
