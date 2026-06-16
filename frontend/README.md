# Task Manager — Frontend

Next.js 15 app with Supabase auth and task management.

## Stack

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS**
- **Supabase** — auth, profiles, tasks (PostgreSQL + RLS)

## Environment variables

Only these three variables are used (local and production):

| Variable | Required | Purpose |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `NEXT_PUBLIC_COMPANY_EMAIL_DOMAIN` | Yes | Domain for internal role assignment |

Copy `.env.local.example` to `.env.local` for local development.  
On Vercel, set the same three variables under **Project Settings → Environment Variables**.

## Local setup

```bash
npm install
npm run dev
```

**Windows:** run `start-dev.cmd` in this folder (or `..\start-dev.cmd` from the repo root).

Open http://localhost:3000

## Production build

```bash
npm run build
npm start
```

## Routes

| Route | Description |
|-------|-------------|
| `/` | Redirects to `/dashboard` or `/login` |
| `/login` | Sign in |
| `/signup` | Create account |
| `/dashboard` | Protected home |
| `/client` | Client task view (all authenticated users) |
| `/internal` | Internal task view (admin + internal) |
| `/admin` | Admin panel |
| `/auth/callback` | OAuth / email redirect handler |

All navigation uses relative paths (`/client`, `/internal`, etc.) — no backend URL configuration.

## Tasks

Tasks are loaded and saved via Supabase:

```ts
supabase.from("tasks").select()
```

Run migration `006_tasks_and_projects.sql` before using task views.  
Optional seed: `../supabase/seeds/commissioning_2026.sql`

## Supabase setup

1. Run migrations `001`–`006` from `../supabase/migrations/` in the SQL Editor.
2. Enable auth providers (Email, Google, Microsoft) as needed.
3. Add redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://YOUR_PRODUCTION_DOMAIN/auth/callback`

## Roles

Set `NEXT_PUBLIC_COMPANY_EMAIL_DOMAIN` to your company domain:

| Role | Assignment |
|------|------------|
| **admin** | First user, or via invite |
| **internal** | `@yourcompany.com` email, or invite |
| **external** | Other email domains |

## Deploy to Vercel

See the root [README.md](../README.md) for full deployment steps.

**Summary:** Import repo with **Root Directory** = `frontend`, add the three env vars, configure Supabase redirect URL to `/auth/callback`.

## Project structure

```
src/
  app/              Pages (login, dashboard, client, internal, admin)
  components/       UI (AppShell, TaskManager, …)
  lib/
    auth.ts         Client auth helpers
    profiles-server.ts  Server auth + role gates
    tasks/api.ts    Supabase task CRUD
    tasks/db-mapper.ts  DB ↔ UI field mapping
  middleware.ts     Route protection
```
