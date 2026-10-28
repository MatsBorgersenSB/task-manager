---
name: sb-project-management
description: "Standard Bio Task Manager & Project Portal project management skill. Use when scoping features, breaking down epics into tasks, planning commissioning templates, designing client vs. internal task workflows, or writing implementation plans for this repository."
---

# Standard Bio Project Management (`sb-project-management`)

Use this skill whenever planning features, breaking down epics, designing commissioning/plant task templates, or managing delivery across the **Standard Bio Task Manager** (`/internal`) and **Project Portal** (`/client`).

## 1. Domain & Boundary Scoping Checklist

Every feature, epic, or task breakdown in this repository MUST explicitly declare its boundary rules before implementation begins:

1. **Role Matrix (`admin` | `internal` | `external`):**
   - Which roles can view, create, edit, or delete this resource?
   - Server gate required: `requireAdminAccess` / `requireInternalAccess` in `frontend/src/lib/profiles-server.ts` and `frontend/src/middleware.ts`.
   - RLS gate required: `is_admin()` / `is_internal_user()` security-definer helpers (never query `profiles` recursively in RLS).

2. **Visibility Scope (`internal` vs `internal_client`):**
   - Does this task, field, comment, or attachment cross into the Client Project Portal (`/client`)?
   - **SB-Only (`internal`):** Must be stripped/filtered via `lib/tasks/visibility.ts` (`isClientVisibleTask`, sanitization) AND blocked by RLS/column policies.
   - **Client-Writable Fields:** If clients can update a field, is it explicitly permitted in `CLIENT_WRITABLE_FIELDS` without allowing overwrites of `sb_owner`, `sb_status`, or internal notes?

3. **Data & Field Mapping:**
   - Any new task attribute must map cleanly between UI labels and DB columns in `frontend/src/lib/tasks/db-mapper.ts` and `labels.ts`.
   - Project membership uses `project_users` (`internal` | `client`) and pre-signup role assignment uses `invites` (never `project_members` or `client_invitations`).

4. **Schema Drift & Migration Plan:**
   - Does this require a new migration `supabase/migrations/NNN_snake_name.sql`?
   - What happens if production Vercel deploys before the SQL migration is manually executed in Supabase? Define the probe in `lib/supabase/schemaCapabilities.ts` and fallback in `schemaFallback.ts`.
   - Update `docs/MIGRATION_DEPENDENCY_MATRIX.md` when adding migrations.

---

## 2. Epic-to-Task Decomposition Template

When decomposing an epic or PRD for Standard Bio into executable tasks, structure each slice vertically so it is independently testable with TDD (`RED → GREEN → REFACTOR`):

```markdown
### Slice [N]: [Short Deliverable Name]

- **User Story:** As an [admin | internal SB staff | external client], I want [action] so that [commissioning/project outcome].
- **Visibility & Security Boundary:**
  - Route / Surface: `[/internal | /client | /admin]`
  - `visibility_scope` impact: `[internal only | internal_client shared]`
  - RLS / Server Gate: `[e.g., is_internal_user() + requireInternalAccess]`
- **Schema & Fallback:**
  - Migration: `[None | supabase/migrations/NNN_...sql]`
  - Capability Fallback: `[How the UI/query behaves if column/RPC is missing]`
- **Files Touched:**
  - Mapper/Lib: `frontend/src/lib/tasks/...`
  - UI Component: `frontend/src/components/...`
  - Test: `frontend/src/.../*.test.ts(x)`
- **Acceptance Criteria (TDD Gate):**
  - [ ] Failing test written and verified (RED)
  - [ ] Minimal implementation passing test (GREEN)
  - [ ] Client-boundary leak check verified (external user cannot read/write SB-only fields)
  - [ ] Verified locally on `http://localhost:3000`
```

---

## 3. Commissioning & Plant Project Workflow Guardrails

When assisting with commissioning templates, project lifecycle, or task batch operations:

- **Template Seeding & Cloning:** Ensure template tasks default to safe `visibility_scope` (`internal` unless explicitly marked client-shared) and preserve phase/section ordering.
- **SB Owners (`sb_owner`):** Multi-select of `admin`/`internal` profiles loaded via `fetchAppUsers()` and rendered with `SbOwnerSelect`. Never expose internal-only owner assignments or internal comments (`type = 'internal'`) to client exports or views.
- **Auditability:** Privileged user, role, email, or project lifecycle mutations must go through `"use server"` actions or security-definer RPCs and record entries via `write_audit_log`.
- **Release Gate:** Never commit, push to `main`, or publish SQL migrations unless explicitly requested by the user, and always verify locally (`npm run dev` in `frontend/`) first.
