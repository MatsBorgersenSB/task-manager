# Agent instructions

This repository uses **[`CONSTITUTION.md`](./CONSTITUTION.md)** as the AI development handover.

Before non-trivial work:

1. Read `CONSTITUTION.md`.
2. Follow its security, role, visibility, and schema-drift rules.
3. Prefer existing patterns in `frontend/src/lib/` and `frontend/src/components/`.

Do not commit, push, or deploy unless the user explicitly asks.

Make and check every change locally (`npm run dev` in `frontend`, http://localhost:3000) before it is published. Publish means push to `main` or running new SQL in Supabase.
