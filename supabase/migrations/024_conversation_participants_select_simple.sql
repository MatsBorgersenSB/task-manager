-- conversation_participants SELECT: remove recursive subquery policy.
-- Run after 023_conversation_participants_insert_using.sql.

drop policy if exists "participants_select_conversation" on public.conversation_participants;
drop policy if exists "participants_select_self" on public.conversation_participants;
drop policy if exists "participants_select_simple" on public.conversation_participants;

create policy "participants_select_simple"
  on public.conversation_participants
  for select
  to authenticated
  using (true);

-- participants_insert_self unchanged (023):
--   using (true) with check (user_id = auth.uid())

notify pgrst, 'reload schema';
