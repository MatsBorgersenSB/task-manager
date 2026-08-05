# Standard Bio Task Manager — AI Development Constitution

**Purpose:** Handover constitution for AI agents and human developers working on this codebase.  
**Product:** Standard Bio Task Manager (internal) + Project Portal (client).  
**Last updated:** 2026-08-03

Read this document before making non-trivial changes. Prefer matching existing patterns over inventing new ones.

---

## 1. Mission

Build and maintain a reliable collaboration system where:

- **Standard Bio (SB) internal staff** manage commissioning / plant tasks with full internal fields, owners, templates, and admin tools.
- **External clients** see only shared projects and **client-visible** tasks through the Project Portal.
- Security is enforced by **Supabase RLS + role gates**, not by UI hiding alone.

Company email domain: `standard.bio` (`NEXT_PUBLIC_COMPANY_EMAIL_DOMAIN`).

---

## 2. Non-negotiable principles

1. **Never trust the client for authorization.** Every privileged path must check role in middleware, server components/actions, and/or RLS.
2. **Never put `SUPABASE_SERVICE_ROLE_KEY` in browser code** or any `NEXT_PUBLIC_*` variable. Service role is server/scripts only.
3. **Preserve client/internal separation.** Do not leak SB-only fields into client views, exports, writes, or notifications.
4. **Do not invent a separate backend.** The app is Next.js ↔ Supabase. Prefer RPCs, RLS, and server actions.
5. **Assume production schema may lag.** New columns/tables need migrations *and* runtime fallbacks where the app already uses capability probes.
6. **Do not commit secrets.** `.env.local` is local only. Never print full API keys in logs or chat.
7. **Do not push/deploy or commit unless the user asks.** When asked to deploy, push `main` (Vercel Root Directory = `frontend`).
8. **Prefer small, focused diffs.** Match existing naming, UI (`@/lib/ui/classes`), and file placement.

---

## 3. System map

```
Task_manager/
  frontend/                 # Deployable Next.js 15 app (Vercel root)
    src/app/                # Routes: client, internal, admin, share, today…
    src/components/         # UI (tasks, projects, admin, chat)
    src/lib/                # Domain logic
    src/middleware.ts       # Session + route gates
  supabase/migrations/      # Numbered SQL (apply in Supabase SQL Editor)
  scripts/                  # Service-role CLI tools (tsx via frontend npm scripts)
  docs/                     # Migration matrix and ops notes
```

| Layer | Tech |
|-------|------|
| UI | Next.js 15 App Router, React 19, TypeScript, Tailwind |
| Data / Auth | Supabase Postgres + Auth + RLS + RPCs |
| Hosting | Vercel (`frontend/`), branch `main` |
| Optional AI | OpenAI (`OPENAI_API_KEY`) for in-app chat |

There is **no** Express/FastAPI service.

---

## 4. Roles and access

Roles (`frontend/src/lib/roles.ts`): **`admin` | `internal` | `external`**.

Assignment order (DB `ensure_user_profile`):

1. First user → `admin`
2. Pending invite → invited role
3. Email matches company domain → `internal`
4. Else → `external`

| Gate | Where |
|------|--------|
| Middleware | `frontend/src/middleware.ts` — `/admin` needs `is_admin()`, `/internal` needs admin\|internal |
| Server pages | `requireAdminAccess` / `requireInternalAccess` in `lib/profiles-server.ts` |
| Helpers | `isAdmin`, `isInternal` (admin counts as internal) |

**Views:**

- Internal → “Task Manager” (`/internal`, …)
- Client → “Project Portal” (`/client`)
- Access helpers: `lib/viewAccess.ts`

---

## 5. Domain model (learn these names)

| Concept | Rule |
|---------|------|
| **visibility_scope** | `internal` = hidden from clients; `internal_client` = client-visible. Enforce in RLS *and* `lib/tasks/visibility.ts` / API filters. |
| **SB Owners** | Multi-select of admin/internal profiles (`sb_owner`). UI: `SbOwnerSelect`. Load via `fetchAppUsers()`. |
| **project_users** | Project membership (`internal` \| `client`). There is **no** `project_members` / `client_invitations` table — use `project_users` and `invites`. |
| **invites** | Pre-assign role before signup (`public.invites`). |
| **Comments** | Types `client` \| `internal`. |
| **Field mapping** | UI labels (Issue, SB Status, …) ↔ DB columns only through `lib/tasks/db-mapper.ts` and `labels.ts`. |
| **Client-writable fields** | Strict subset; never overwrite SB fields from client mode (`CLIENT_WRITABLE_FIELDS`). |

---

## 6. Coding conventions for agents

### Supabase clients

- Browser: `lib/supabase/client.ts` (anon key)
- Server Components / actions: `lib/supabase/server.ts`
- Privileged Auth Admin (delete user, change email): `createServiceRoleClient()` in `lib/admin/delete-auth-user.ts`

### Admin mutations

- Use `"use server"` actions in `app/admin/actions.ts` with `assertAdmin()`.
- Prefer security-definer RPCs (`admin_update_user_role`, `admin_create_invite`, `admin_update_user_email`).
- Log sensitive admin actions via `write_audit_log`.

### Schema drift

- Probe optional features with `lib/supabase/schemaCapabilities.ts`.
- Use `schemaFallback.ts` (`isMissingColumnError`, write/select fallbacks) instead of hard-failing on missing columns.
- Migrations live in `supabase/migrations/NNN_snake_name.sql` (next number after latest). Prefer idempotent SQL (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `CREATE OR REPLACE`).
- Prefer `is_admin()` / `is_internal_user()` security-definer helpers in RLS — **never** recurse into `profiles` under RLS without those helpers (see migration `045`).

### UI / React

- Prefer existing `ui.*` classes from `lib/ui/classes.ts`.
- Interactive surfaces are client components; auth gates stay on the server.
- Task panel fields go through `panelFields` / `TaskPanelField` — don’t fork one-off editors without need.
- When adding filters/exports, respect internal vs client mode.

### Scripts

- Run from `frontend/` with `node --env-file=.env.local …` (see `package.json` scripts).
- Env file path is **`frontend/.env.local`**, not repo root.
- Service role must be a real key (`sb_secret_…` or full legacy JWT) — never dashboard masked `eyJ...KEY...` placeholders.

---

## 7. Security red lines

| Do | Don't |
|----|--------|
| Filter client tasks with `isClientVisibleTask` / sanitize | Rely on “hide column in UI” alone |
| Keep service role on server | Bundle service role into client |
| Apply migrations before depending on new RPCs/columns in prod | Assume Vercel deploy applies SQL |
| Use admin email-change flow (RPC + Auth Admin) for typos | Hand-edit `auth.users` inconsistently with `profiles` / `project_users` |
| Preserve UUID references (comments, feed, sessions) when changing emails | Create a second user and orphan history |

**Known caution:** Early migrations opened some task policies; later migrations (014, 037, …) tighten scoping. Production must have current migrations. See `docs/MIGRATION_DEPENDENCY_MATRIX.md`.

---

## 8. Deploy & ops handover

1. **Code deploy:** push to `main` → Vercel builds `frontend/`.
2. **DB deploy:** run new SQL in Supabase SQL Editor (not automatic with Vercel).
3. **Env (Vercel + local):**  
   - Required public: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_COMPANY_EMAIL_DOMAIN`  
   - Server: `SUPABASE_SERVICE_ROLE_KEY` (admin delete/email, scripts)  
   - Optional: `ADMIN_DELETE_SECRET`, `OPENAI_API_KEY`, reset-password redirect URL  
4. **Auth URLs:** Site URL + `/auth/callback` for production and localhost.
5. **Prod project ref** (documented): `albelxghvdxwooskyzfe`.

### Useful npm scripts (`frontend/`)

| Script | Purpose |
|--------|---------|
| `audit-user-email` | Find an email across auth + public tables |
| `fix-user-email` | Correct email (dry-run / `--confirm`) |
| `delete-user` / `reset-user-password` | Privileged auth ops |

---

## 9. Decision checklist (before shipping a change)

- [ ] Does this respect **role** and **visibility_scope**?
- [ ] Could a client user see or write SB-only data via API if they craft a request?
- [ ] If schema changed: migration added? Applied in Supabase? Fallback if column missing?
- [ ] Admin-only? Server action + `assertAdmin` / RPC?
- [ ] Field names go through **db-mapper / labels**?
- [ ] No secrets in git or client bundle?
- [ ] UI matches existing `ui` patterns (no random new design language)?

---

## 10. Where to look first

| Need | Start here |
|------|------------|
| Task CRUD / filters | `frontend/src/lib/tasks/` |
| Task UI / panel | `frontend/src/components/tasks/` |
| Roles / gates | `lib/roles.ts`, `middleware.ts`, `profiles-server.ts` |
| Admin users / invites / email | `app/admin/`, `lib/admin/`, migration `053` |
| Projects / sharing / lifecycle | `lib/projects/`, migrations `037`, `051` |
| Schema lag / capabilities | `lib/supabase/schemaCapabilities.ts`, `docs/MIGRATION_DEPENDENCY_MATRIX.md` |
| Product overview | `README.md`, `frontend/README.md` |

---

## 11. Amendment rule

Update this Constitution when:

- Auth/role model changes
- A new privileged script or env var is introduced
- Client/internal boundary rules change
- Deploy or migration process changes

Keep it actionable. Prefer linking to code over duplicating long implementation detail.
