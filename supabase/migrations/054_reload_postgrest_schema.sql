-- Reload PostgREST schema cache after template platform migrations.
-- Run this in the Supabase SQL Editor if the API still reports missing columns
-- (e.g. project_templates.is_latest) after 048/049 succeeded in SQL.

notify pgrst, 'reload schema';
