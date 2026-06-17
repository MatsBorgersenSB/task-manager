-- Task visibility: internal-only vs visible in client view.
alter table public.tasks
  add column if not exists visibility_scope text not null default 'internal_client';

alter table public.tasks
  drop constraint if exists tasks_visibility_scope_check;

alter table public.tasks
  add constraint tasks_visibility_scope_check
  check (visibility_scope in ('internal', 'internal_client'));

comment on column public.tasks.visibility_scope is
  'internal = internal view only; internal_client = visible in client view';

create index if not exists tasks_visibility_scope_idx
  on public.tasks (visibility_scope);

-- External users must not read internal-only tasks.
drop policy if exists "Authenticated users can read tasks" on public.tasks;

create policy "Authenticated users can read tasks"
  on public.tasks for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.role in ('admin', 'internal')
    )
    or coalesce(visibility_scope, 'internal_client') = 'internal_client'
  );
