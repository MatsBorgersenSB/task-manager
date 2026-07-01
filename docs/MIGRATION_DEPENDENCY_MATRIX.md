# Supabase Migration Dependency Matrix

Operational reference for Standard Bio Task Manager schema synchronization.

## Production status (last audited)

Production (`albelxghvdxwooskyzfe`) is **behind** the deployed application. Core tables exist through ~041–043; migrations **036–051** are missing or partial.

| Migration | Production status |
|-----------|-------------------|
| 036 | Missing |
| 037 | Partial (`is_shared` only; `project_users` missing) |
| 038–040 | Missing |
| 041–043 | Applied |
| 044–046 | Missing |
| 047 | Partial (empty template tables, base schema only) |
| 048–051 | Missing |

## Dependency matrix (036–051)

| Migration | Purpose | Requires | Required by | Safe alone? |
|-----------|---------|----------|-------------|-------------|
| **036** | `tasks.parent_task_id` | 006 tasks | 046, 048 RPC, 051 RPC | Yes (additive) |
| **037** | `project_users`, sharing RLS | 006 projects, profiles | 038, 039, 050, 051 | Yes |
| **038** | Backfill `is_shared` | 037 | — | Yes (data only) |
| **039** | `is_shared` sync trigger | 037 | — | Yes |
| **040** | Rename default project | projects | — | Yes |
| **041** | `projects.links` | projects | — | Likely applied |
| **042** | `activity_logs.event_type` | activity_logs | — | Likely applied |
| **043** | Acknowledgements, `project_activity` | tasks, activity_logs | 051 impact RPC | Likely applied |
| **044** | Per-project `task_number` + trigger | tasks | — | Yes (renumbers data) |
| **045** | `is_internal_user()`, profiles RLS fix | 003 `is_admin`, profiles | 046 policies, 050, 051 | Yes |
| **046** | `validate_task_parent_hierarchy()` | **036** | — | No |
| **047** | Template tables (foundation) | areas | 048, 049 | Yes |
| **048** | Template versioning, deps, instantiate RPC | **047** | 049, 051 RPC | No |
| **049** | Seed Standard Bio templates | **048** (slug column) | — | No |
| **050** | Access Center sessions + RPCs | **045**, profiles, **037** | — | No |
| **051** | Project lifecycle columns + RPCs + RLS | **045**, **037**, **036**, **048** cols | — | No (DDL block safe alone) |

## Dependency chains

```
036 → 046
037 → 038 → 039
037 → 050
037 → 051 (RLS + impact RPC)
045 → 046, 050, 051
047 → 048 → 049
048 → 051 (source_template_id in impact RPC)
```

## Recommended execution order

Apply in Supabase SQL Editor **in this order**:

1. `036_parent_task_id.sql`
2. `037_project_sharing.sql`
3. `038_restore_project_sharing.sql`
4. `039_project_users_shared_trigger.sql`
5. `040_rename_default_project.sql`
6. `044_per_project_task_numbers.sql` *(skip if already on global serial and app fix deployed)*
7. `045_fix_profiles_rls_recursion.sql`
8. `046_task_hierarchy_protection.sql`
9. `047_project_templates_foundation.sql` *(idempotent if tables exist)*
10. `048_project_execution_platform.sql`
11. `049_seed_standard_bio_templates.sql`
12. `050_user_access_intelligence.sql`
13. `051_project_lifecycle.sql`

Skip 041–043 if already applied (verify columns first).

## Emergency fix (projects invisible)

If the app errors on `projects.deleted_at does not exist`, run **only** the `ALTER TABLE` block from `051` (lines 4–12). This is additive and does not delete data.

## Verification queries

```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'projects'
ORDER BY column_name;

SELECT proname FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN ('is_internal_user', 'instantiate_project_from_template', 'transition_project_lifecycle');
```

## Application resilience

The frontend detects schema capabilities at runtime and:

- Falls back when lifecycle columns are missing (`fetchProjects`)
- Hides lifecycle UI when migration 051 is not applied
- Skips Access Center session RPCs when migration 050 is missing
- Surfaces migration hints on invitation and lifecycle errors

---

## Phase 2 — Schema audit (app vs production)

Compares **what the deployed app expects** against **verified production state** (`albelxghvdxwooskyzfe`).

### Core tables (expected: present)

| Object | App expects | Production |
|--------|-------------|------------|
| `projects` | Yes | Present |
| `tasks` | Yes | Present |
| `profiles` | Yes | Present |
| `areas` | Yes | Present |
| `activity_logs` | Yes | Present |

### Columns — gaps blocking features

| Table | Column / object | Migration | Production |
|-------|-----------------|-----------|------------|
| `projects` | `deleted_at`, `project_status`, `archived_at`, lifecycle fields | 051 | **Missing** |
| `projects` | `source_template_id`, `slug` | 048 | **Missing** |
| `projects` | `links` | 041 | Present |
| `projects` | `is_shared` | 037 | Present |
| `tasks` | `parent_task_id` | 036 | **Missing** |
| `tasks` | per-project `task_number` trigger | 044 | **Missing** (global serial) |
| `project_users` | table + RLS | 037 | **Missing** |
| `project_templates` | `slug`, versioning | 048 | **Missing** |
| `user_login_sessions` | table + RPCs | 050 | **Missing** |

### Functions / RPCs

| Function | Migration | Production |
|----------|-----------|------------|
| `is_internal_user()` | 045 | **Missing** |
| `validate_task_parent_hierarchy()` | 046 | **Missing** |
| `instantiate_project_from_template()` | 048 | **Missing** |
| `transition_project_lifecycle()` | 051 | **Missing** |
| Access Center RPCs | 050 | **Missing** |

### App ↔ DB sync status

| Capability flag | Probe | Production | User impact if missing |
|-----------------|-------|------------|------------------------|
| `projectLifecycle` | `projects.deleted_at` | Off | Projects invisible (fixed by resilient query); lifecycle UI hidden |
| `projectUsers` | `project_users` table | Off | Client invite fails with migration hint |
| `taskHierarchy` | `tasks.parent_task_id` | Off | Subtask/move-under features error |
| `templatePlatform` | `project_templates.slug` | Off | Template wizard / instantiate broken |
| `accessCenter` | `user_login_sessions` | Off | Session tracking skipped (no 500) |

### Data integrity notes

- **Task numbers:** App no longer sends `task_number` on create (avoids duplicate-key errors on global serial). Migration 044 still recommended for per-project numbering.
- **Templates:** `047` tables exist but empty; `049` seed requires `048` columns.
- **Lifecycle:** Full `051` unsafe without 036, 037, 045, 048; emergency DDL-only block is safe.
