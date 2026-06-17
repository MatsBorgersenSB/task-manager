-- Internal-only task links (file/folder/URL attachments).
-- App layer strips links for client view; column stores JSON array.

alter table public.tasks
  add column if not exists links jsonb not null default '[]'::jsonb;

comment on column public.tasks.links is
  'Internal-only JSON array: [{ id, name, url, type }]';
