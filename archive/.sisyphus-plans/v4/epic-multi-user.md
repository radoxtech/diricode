# Epic: Multi-User Collaboration — Auth, Permissions & Teams (v4.1)

> Package: `@diricode/server` + `@diricode/core` + `@diricode/web`
> Iteration: **v4.1**
> Issue IDs: **DC-MULTI-001..DC-MULTI-005**

## Summary

Transforms DiriCode from a single-user tool into a team-capable platform. Multiple users can connect to a shared DiriCode server, each with their own identity, permissions, and sessions — while sharing project configuration, agent memory, and plan progress.

This is the most complex feature in the entire roadmap and was deliberately placed last. It requires all prior infrastructure: Hono server (MVP), auth-capable HTTP layer, sandbox isolation (v3), managed config (v3), and stable plan backends. Multi-user support was identified in surveys but never as a high-priority feature — it's a "when everything else is solid" addition.

Source: Survey feature discussions (implicit in team/enterprise context), Wishlist 10.2 ("Bus factor > 1"), overview.md v4 "Multi-user collaboration (auth, permissions, teams)"
Ecosystem references: Plandex (multi-user server with team namespaces), OpenHands (Docker-based multi-tenant), GitLab/GitHub (team permission models)

## Architectural Baseline

- MVP: Hono HTTP server serves web UI and API — currently single-user, no auth
- MVP: SQLite stores session data, memory, EventStream — currently single user namespace
- v3: Sandbox provides agent isolation — reusable for user isolation
- v3: Managed config provides admin-enforced settings — reusable for team policies
- v3: Auto-advance with audit trail — essential for team accountability
- The server needs: authentication middleware, user identity on every request, permission checks on API endpoints, user-scoped data in SQLite

## Issues

### DC-MULTI-001 — Authentication system

**Goal**: Add user authentication to the DiriCode Hono server, supporting multiple auth methods for different deployment contexts (local team, corporate, open source contributors).

**Scope**
- Authentication methods:
  - **Local accounts** (email + password) — simplest, for small teams
    - Password hashing: bcrypt or argon2
    - Session tokens: JWT with configurable expiry
    - Self-registration: configurable (enabled/disabled by admin)
  - **OAuth 2.0 / OpenID Connect** — for corporate SSO
    - Providers: GitHub, GitLab, Google, Microsoft Entra ID (Azure AD)
    - Generic OIDC: any compliant provider (Okta, Auth0, Keycloak)
    - Configuration in managed config: `auth.oidc.issuer`, `auth.oidc.clientId`, `auth.oidc.clientSecret`
  - **SAML 2.0** — for enterprise with SAML-only IdP
    - Metadata URL configuration
    - Attribute mapping (email, name, groups)
  - **API Token** — for programmatic access (CI/CD, scripts)
    - Generate via web UI or CLI: `dc auth create-token --name "ci-token"`
    - Scoped permissions (read-only, full access)
    - Expiry: configurable or non-expiring
- Auth middleware:
  - Hono middleware that validates auth on every API request
  - Public endpoints: `/health`, `/auth/login`, `/auth/callback` (OAuth)
  - Protected endpoints: everything else
  - User identity attached to request context (`ctx.user`)
- Session management:
  - Server-side sessions in SQLite (session table with user_id, token, expiry)
  - Automatic session cleanup (expired sessions purged)
  - Multi-device: user can have multiple active sessions

**Acceptance criteria**
- [ ] Local account registration and login (email + password + JWT)
- [ ] OAuth 2.0 login with at least GitHub and generic OIDC provider
- [ ] API token generation and validation
- [ ] Auth middleware on all protected API endpoints
- [ ] Session management with automatic expiry cleanup
- [ ] `dc auth login` CLI command for interactive login
- [ ] `dc auth create-token` CLI command for API token generation
- [ ] Unauthenticated requests get 401 with clear error message
- [ ] Single-user mode preserved: if `auth.enabled: false` (default), no auth required (backward compatible)

**References**
- MVP `epic-server.md` DC-SRV-001..006 (Hono HTTP server — auth middleware plugs in here)
- Hono auth middleware: https://hono.dev/middleware/builtin/bearer-auth
- Iron Guideline: "Użytkownik ZAWSZE jest ostatecznym arbitrem"
- Wishlist 3.4: "Zero telemetrii domyślnej — opt-in only"

---

### DC-MULTI-002 — Role-based access control (RBAC)

**Goal**: Define team roles with granular permissions, controlling who can configure agents, approve plans, execute tasks, and manage team members.

**Scope**
- Roles:
  | Role | Description | Permissions |
  |------|------------|-------------|
  | **Admin** | Team administrator | All permissions + user management + managed config |
  | **Developer** | Full DiriCode user | Create/execute plans, configure agents, use all tools |
  | **Reviewer** | Read + review only | View sessions, approve plans, add comments — cannot execute |
  | **Viewer** | Read-only | View sessions, plans, dashboards — cannot modify anything |
- Permission matrix:
  | Permission | Admin | Developer | Reviewer | Viewer |
  |-----------|-------|-----------|----------|--------|
  | Create plans | ✅ | ✅ | ❌ | ❌ |
  | Execute plans | ✅ | ✅ | ❌ | ❌ |
  | Approve plan execution | ✅ | ✅ | ✅ | ❌ |
  | View sessions | ✅ | ✅ | ✅ | ✅ |
  | View dashboards | ✅ | ✅ | ✅ | ✅ |
  | Configure agents | ✅ | ✅ | ❌ | ❌ |
  | Configure hooks | ✅ | ✅ | ❌ | ❌ |
  | Manage team members | ✅ | ❌ | ❌ | ❌ |
  | Edit managed config | ✅ | ❌ | ❌ | ❌ |
  | Use destructive tools (bash, git push) | ✅ | ✅ | ❌ | ❌ |
  | Export data | ✅ | ✅ | ✅ | ❌ |
- Custom roles: admins can create custom roles with specific permission combinations
- Role assignment: admin assigns roles to users via web UI or CLI
- Permission enforcement: server-side middleware checks permissions before every API call
- Configuration:
  ```jsonc
  {
    "auth": {
      "enabled": true,
      "defaultRole": "developer",
      "roles": {
        "intern": {
          "extends": "developer",
          "deny": ["use-destructive-tools", "configure-hooks"]
        }
      }
    }
  }
  ```

**Acceptance criteria**
- [ ] 4 built-in roles: Admin, Developer, Reviewer, Viewer
- [ ] Permission matrix enforced server-side on all API endpoints
- [ ] Custom role creation with `extends` + `deny` pattern
- [ ] Role assignment via web UI (admin panel) and CLI (`dc auth assign-role`)
- [ ] Default role configurable (`auth.defaultRole`)
- [ ] Unauthorized actions return 403 with clear permission error
- [ ] Admin role can manage users and roles
- [ ] Viewer role is truly read-only (no mutations)

**References**
- v3 DC-ADVUX-001 (managed config — admin role maps to managed config access)
- Wishlist 3.1: "Żaden plan NIE jest wykonywany bez akceptacji użytkownika — nigdy, zero wyjątków" — Reviewer role enables approval without execution
- RBAC patterns: GitHub repository roles, GitLab project members

---

### DC-MULTI-003 — User-scoped data isolation

**Goal**: Ensure that in multi-user mode, each user's sessions, agent contexts, and preferences are isolated — while team-level data (plans, shared memory, config) is accessible to all authorized users.

**Scope**
- Data scoping:
  | Data Type | Scope | Visibility |
  |-----------|-------|-----------|
  | Sessions | Per-user | Only the user who created the session (+ admins) |
  | Agent contexts | Per-session (per-user) | Isolated per session — no cross-user leakage |
  | Plans / Issues | Team-shared | Visible to all team members (per role permissions) |
  | Memory (project) | Team-shared | Shared knowledge base — all members contribute and read |
  | Memory (personal) | Per-user | Personal notes, preferences — only visible to owner |
  | Config (global) | Per-user | Each user has their own global config on the server |
  | Config (project) | Team-shared | Shared project config — admins/developers can modify |
  | Config (managed) | Admin-only write | Applied to all users — admins set, users can't override |
  | Observability data | Per-session (per-user) | Session owner + admins can view |
  | Cost data | Per-user + aggregated | Users see own costs; admins see team aggregate |
- SQLite schema changes:
  - Add `user_id` column to sessions, events, memory tables
  - Team-scoped tables: plans, project_config, shared_memory
  - Index on `user_id` for efficient per-user queries
- API filtering: all list/query endpoints automatically filter by user_id (unless admin)
- Cross-user references: when an agent references a plan created by another user, it works (plans are team-shared) but session data is private

**Acceptance criteria**
- [ ] Sessions are user-scoped: users see only their own sessions
- [ ] Agent contexts isolated per session (no cross-user data leakage)
- [ ] Plans/issues shared across team (all members can read, developers+ can modify)
- [ ] Project memory shared; personal memory user-scoped
- [ ] SQLite schema includes `user_id` on user-scoped tables
- [ ] API endpoints automatically filter by authenticated user
- [ ] Admin can view any user's sessions (for support/audit)
- [ ] Cost aggregation: users see own costs; admins see team totals
- [ ] No regression for single-user mode (auth disabled = no scoping, backward compatible)

**References**
- MVP `epic-memory.md` DC-MEM-001..006 (SQLite memory — needs user_id column)
- v3 DC-SAND-001 (sandbox isolation — agent-level isolation complements user-level isolation)
- Wishlist 5.1: "Pamięć jest per-projekt (nie globalna)" — in multi-user, per-project + per-user

---

### DC-MULTI-004 — Concurrent session management

**Goal**: Handle multiple users running DiriCode sessions simultaneously on the same project — preventing conflicts, managing shared resources, and providing visibility into team activity.

**Scope**
- Concurrent session handling:
  - Multiple users can have active sessions on the same project simultaneously
  - File system conflicts: advisory file locking when agents write files (first-writer-wins, second writer gets warning)
  - Plan conflicts: optimistic locking on plan/issue updates (last-write-wins with conflict notification)
  - Git conflicts: if two sessions try to commit to the same branch → second session gets merge conflict resolution prompt
- Team activity feed:
  - Real-time feed showing what all team members are doing: "Alice is running code-writer on auth module", "Bob's plan was approved"
  - Visible in web UI sidebar (collapsible)
  - Data source: EventStream events with user_id, filtered for team visibility
- Session coordination:
  - "Claim" mechanism: user can claim a plan task to prevent others from working on it
  - Claimed tasks show lock icon in plan view with claimer's name
  - Automatic unclaim after configurable timeout (e.g., 30 minutes of inactivity)
- Resource management:
  - Shared model API rate limits: distribute rate limit budget across concurrent sessions
  - Shared cost budget: if team has cost limit, enforce across all sessions
  - Queue: if rate limit is hit, queue requests fairly across users (round-robin)

**Acceptance criteria**
- [ ] Multiple users can run sessions on same project simultaneously
- [ ] Advisory file locking prevents conflicting writes (warning to second writer)
- [ ] Plan task claiming mechanism (claim/unclaim/auto-timeout)
- [ ] Team activity feed visible in web UI (real-time via SSE)
- [ ] Git conflict detection when concurrent sessions commit to same branch
- [ ] Shared rate limit budget distributed fairly across sessions
- [ ] Shared cost budget enforced across all concurrent sessions
- [ ] No deadlocks or race conditions in concurrent access patterns

**References**
- MVP `epic-server.md` DC-SRV-001..006 (SSE event broadcasting — extend for multi-user)
- Wishlist 9.2: "Cancellation — można zatrzymać w dowolnym momencie" — applies per-user
- Plandex: multi-user server with plan locking

---

### DC-MULTI-005 — Team administration UI

**Goal**: Provide an admin panel in the web UI for managing team members, roles, usage, and team-wide settings — the operational backbone for multi-user DiriCode.

**Scope**
- User management:
  - Invite users (by email — generates invite link)
  - List team members with roles and last activity
  - Change user roles
  - Deactivate/reactivate users (soft delete — preserve data)
  - View user's sessions and cost history
- Team dashboard:
  - Total team cost (today/week/month)
  - Active sessions count and details
  - Most active agents (across team)
  - Most expensive tasks (across team)
  - Usage per user breakdown (tokens, cost, sessions)
- Team settings:
  - Default role for new members
  - Cost limit per user / per team
  - Allowed models per team
  - Required hooks per team
  - OIDC/SAML configuration (for admins to set up SSO)
- Audit log:
  - All admin actions logged: role changes, user deactivation, config changes
  - All plan executions logged: who approved, who executed, what changed
  - Filterable by user, action type, date range
  - Exportable as CSV/JSON

**Acceptance criteria**
- [ ] Invite user flow: email input → invite link generated → user signs up with invite
- [ ] User list with role, status, last activity columns
- [ ] Role change from admin panel (dropdown per user)
- [ ] User deactivation/reactivation (soft delete)
- [ ] Team dashboard with cost, usage, and activity metrics
- [ ] Team settings panel for defaults, limits, and models
- [ ] Audit log with filterable entries
- [ ] Audit log export as CSV/JSON
- [ ] All admin actions require Admin role (permission enforced)
- [ ] Responsive admin UI (works on tablet-sized screens)

**References**
- v3 `epic-observability-v3.md` DC-OBS-013 (cost analytics — team dashboard reuses these views)
- v3 DC-ADVUX-001 (managed config — team settings overlap with managed config)
- Wishlist 10.2: "Bus factor > 1 — nie jednoosobowy projekt" — multi-user enables team collaboration
- GitHub organization admin: team management patterns
