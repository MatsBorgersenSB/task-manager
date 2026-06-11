# Task Manager

Next.js task manager with Supabase auth, roles, and PostgreSQL storage.

## Project structure

```
task_manager/
  frontend/          Next.js app (deploy this to Vercel)
  supabase/
    migrations/      SQL migrations (run in Supabase SQL Editor)
    seeds/           Optional seed data (e.g. commissioning tasks)
```

## Local development

1. Run Supabase migrations `001`–`006` in your project SQL Editor (see `supabase/migrations/`).
2. Copy environment variables:

   ```bash
   cd frontend
   copy .env.local.example .env.local   # Windows
   # Edit .env.local with your Supabase values
   ```

3. Install and start:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   Open http://localhost:3000

## Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Prepare task manager for Vercel"
git remote add origin https://github.com/YOUR_ORG/task_manager.git
git push -u origin main
```

### 2. Import project in Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import your GitHub repository.
2. Set **Root Directory** to `frontend`.
3. Framework preset: **Next.js** (auto-detected).
4. Build command: `npm run build` (default).
5. Output directory: `.next` (default).

### 3. Add environment variables in Vercel

In **Project Settings → Environment Variables**, add these for **Production**, **Preview**, and **Development**:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL (`https://xxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `NEXT_PUBLIC_COMPANY_EMAIL_DOMAIN` | Yes | Email domain for `internal` role (e.g. `standard.bio`) |

No other environment variables are required.

### 4. Configure Supabase for production

In **Supabase Dashboard → Authentication → URL Configuration**:

1. **Site URL**: `https://YOUR_APP.vercel.app`
2. **Redirect URLs** (add both):
   - `https://YOUR_APP.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback` (local dev)

Enable auth providers you use (Email, Google, Microsoft) under **Authentication → Providers**.

### 5. Deploy

Click **Deploy**. After the first deploy, sign up / log in on your production URL and verify:

- `/login`, `/dashboard`, `/client`, `/internal`, `/admin`, `/auth/callback`

### 6. Seed tasks (optional)

If the database is empty, run `supabase/seeds/commissioning_2026.sql` in the Supabase SQL Editor.

## Routes

| Route | Access |
|-------|--------|
| `/login` | Public |
| `/signup` | Public |
| `/dashboard` | Authenticated |
| `/client` | Authenticated |
| `/internal` | Admin + internal roles |
| `/admin` | Admin only |
| `/auth/callback` | OAuth / email confirmation |

## Supabase migrations

Run in order in the SQL Editor:

1. `001_profiles.sql`
2. `002_admin_role.sql` (only if upgrading an old DB)
3. `003_harden_auth.sql`
4. `004_production_finalize.sql`
5. `005_ensure_profile_auto.sql`
6. `006_tasks_and_projects.sql`

See `frontend/README.md` for auth, roles, and app details.
