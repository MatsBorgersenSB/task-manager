-- conversation_participants: self-only RLS (insert/select/update own rows).
-- Safe to re-run in Supabase SQL Editor.

grant usage on schema public to authenticated;
grant select, insert, update on public.conversation_participants to authenticated;

alter table public.conversation_participants enable row level security;

-- Drop every existing policy on this table (partial runs / legacy names).
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'conversation_participants'
  loop
    execute format(
      'drop policy if exists %I on public.conversation_participants',
      pol.policyname
    );
  end loop;
end $$;

drop policy if exists "conversation_participants_insert" on public.conversation_participants;
drop policy if exists "conversation_participants_select" on public.conversation_participants;
drop policy if exists "conversation_participants_update" on public.conversation_participants;
drop policy if exists "Allow adding participants" on public.conversation_participants;
drop policy if exists "Allow insert participants" on public.conversation_participants;
drop policy if exists "Users can add participants to conversations" on public.conversation_participants;
drop policy if exists "Allow users to read their participations" on public.conversation_participants;
drop policy if exists "Allow users to read conversation participants" on public.conversation_participants;
drop policy if exists "Allow users to update their read state" on public.conversation_participants;
drop policy if exists "participants_insert_self" on public.conversation_participants;
drop policy if exists "participants_select_self" on public.conversation_participants;
drop policy if exists "participants_update_self" on public.conversation_participants;

create policy "participants_insert_self"
  on public.conversation_participants
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "participants_select_self"
  on public.conversation_participants
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "participants_update_self"
  on public.conversation_participants
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

notify pgrst, 'reload schema';
