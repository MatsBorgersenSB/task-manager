-- SB Priority for internal task management (Task Details panel).
alter table public.tasks
  add column if not exists sb_priority text;

comment on column public.tasks.sb_priority is 'Internal SB priority: Low, Medium, High, Urgent';
