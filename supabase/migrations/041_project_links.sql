-- Project-level SharePoint / OneDrive / Outlook links (URL-only, no uploads).
alter table public.projects
  add column if not exists links jsonb not null default '[]'::jsonb;

comment on column public.projects.links is
  'JSON array of {id, name, url, type} link objects for SharePoint, OneDrive, Outlook, etc.';
