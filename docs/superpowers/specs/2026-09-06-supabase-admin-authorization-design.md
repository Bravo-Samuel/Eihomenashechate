# Supabase-Only Authentication and Scoped Admin Authorization

**Status:** Approved for implementation

## Context

The MENASHE platform currently has two authentication providers:

- The web calendar uses Supabase Auth.
- The Expo mobile app uses Clerk and sends Clerk bearer tokens to the same API.

The API currently verifies Supabase bearer tokens and already has partial authorization
support through `app_admin_assignments`, `branch_admin_roles`, `requireAdmin`,
`requireRegionalAdmin`, and `requireNationalAdmin`.

The goal is to make Supabase the only authentication provider, organize
administration around explicit server-side roles and scopes, and make the existing
admin UI consume the same authorization decisions as the API.

## Decisions

### Authentication provider

Supabase Auth is the single provider for web, mobile, and API authentication.

- Web continues using `@supabase/supabase-js`.
- Mobile replaces Clerk with Supabase Auth and persists sessions through Expo
  SecureStore.
- The API accepts Supabase access tokens only and verifies them against Supabase
  Auth's `/auth/v1/user` endpoint.
- Clerk packages, provider setup, token cache, and login screens are removed from
  the mobile artifact once the Supabase flow is working.
- No service-role or secret key is sent to either client.

### Existing account migration

The migration starts fresh Supabase accounts.

- Existing Clerk passwords are not imported.
- Existing Clerk users are not automatically linked by email.
- Existing Clerk identity rows remain historical data during the transition but do
  not authenticate new sessions.
- A new Supabase subject receives a new stable application account identity.
- Existing Clerk-owned application data is not silently reassigned to a new
  Supabase account.

This boundary is intentional: it avoids accidental cross-provider account
takeover or unexpected merging of users who share an email address.

### Roles

The application recognizes these roles:

- `member`: ordinary authenticated user.
- `moderator`: community moderation without administrator-management access.
- `branch_admin`: manages explicitly assigned branches.
- `regional_admin`: manages branches in explicitly assigned regions.
- `national_admin`: manages the whole platform except top-level administrator
  governance.
- `super_admin`: manages administrator assignments and system-level controls.

Roles are application authorization data. They are not derived from Supabase
`user_metadata`, client state, or arbitrary JWT claims.

### Role assignments and scopes

Use one application-owned assignment model for global and scoped roles. The
implementation should evolve the existing `app_admin_assignments` and
`branch_admin_roles` structures without leaving two competing authorization
resolvers.

Each active assignment needs:

- application account ID
- role
- scope type (`global`, `region`, or `branch`)
- optional scope ID
- assigning actor
- status
- created and updated timestamps

Existing branch role records should be migrated into the unified model or
adapted behind one repository/resolver. The route layer must not query role tables
directly.

`ADMIN_USER_ID` must not be a normal authorization bypass. It may remain as
non-authorizing operational configuration, but it must not grant administrator
permissions.

## Authorization architecture

The request flow is:

```text
Supabase access token
  → verified Supabase user
  → stable application account
  → active role assignments
  → permission + resource scope check
  → route handler
```

Add a central authorization module that exposes:

- `getCurrentApplicationAccount(req)`
- `getCurrentPermissions(req)`
- `requirePermission(permission)`
- `requireScopedPermission(permission, resourceResolver)`

Route handlers should use permission checks rather than generic `isAdmin`
branches. Existing helpers remain as compatibility wrappers while routes are
migrated.

Every protected action must verify authorization on the server. Frontend checks
only control navigation and presentation.

## Permission model

Initial permissions include:

- `users.read`
- `users.manage`
- `roles.read`
- `roles.manage`
- `feedback.moderate`
- `announcements.manage`
- `directory.moderate`
- `branches.read`
- `branches.edit`
- `branches.approve`
- `branches.activate`
- `census.review`
- `push.broadcast`
- `books.manage`
- `chat.use`

The resolver maps roles to permissions and then applies scope. For example, a
branch admin may have `branches.edit` only when the target branch is assigned to
that administrator. A moderator may have `feedback.moderate` but not
`roles.manage`.

## Account and session behavior

### Web

Keep the existing Supabase browser client and session refresh behavior. Replace
the current generic admin boolean response with a server-provided authorization
summary containing:

- stable application account ID
- display identity
- active roles
- effective permissions
- scope summaries

The client must treat this summary as display state only; API calls remain the
security boundary.

### Mobile

Replace Clerk sign-in, sign-up, password recovery, OAuth provider setup, and
session hooks with Supabase equivalents. Use SecureStore on native platforms and
the existing web-compatible storage behavior for Expo web.

All mobile API clients should obtain the Supabase access token from one shared
helper and attach it as a bearer token. Remove per-screen Clerk token plumbing.

### Sign-out and failures

- Sign-out clears the Supabase session and application-scoped cached data.
- An expired or invalid access token results in a signed-out state, not an
  administrator state.
- A temporary API/account-resolution failure is shown as unavailable and does not
  grant access.

## Admin interface

Retain the existing admin modal and feature surfaces, but make them permission
driven.

Add administrator-management views for:

- listing active assignments
- assigning a role and scope
- revoking or suspending an assignment
- viewing assignment history

Only `super_admin` can manage administrator assignments. The UI must handle
loading, empty, error, and forbidden states separately.

## Data protection changes

Persistent personal remembrance data should no longer use an IP-derived anonymous
identity. Require a verified application account for persistence, or explicitly
keep guest data temporary and isolated behind a signed guest session. This work
will use authenticated persistence for the initial implementation.

Public submission endpoints that are intentionally anonymous, such as the
community census intake, remain public but keep strict schema validation,
rate-limiting, and moderation status.

## API changes

Update or add endpoints for:

- authenticated account authorization summary
- administrator assignment listing
- administrator assignment creation
- administrator assignment suspension/revocation
- role/permission history

All administrator-management endpoints require `roles.manage`.

Existing protected routes should be migrated in groups:

1. identity and profile
2. community moderation and feedback
3. branch and census workflows
4. books, announcements, push, and payments
5. legacy auth-migration administration

## Error handling

- `401` means no valid Supabase identity.
- `403` means authenticated but lacking the required permission or scope.
- `404` is used where resource existence should not be disclosed.
- `409` is used for conflicting role changes, such as removing the last
  super-admin.
- `503` is reserved for explicitly unavailable dependencies, not invalid tokens.

Do not return raw provider tokens or secret configuration in errors.

## Testing and verification

### Unit tests

Test:

- role-to-permission mapping
- global versus scoped assignments
- branch and region boundary checks
- revoked and suspended assignments
- last-super-admin protection
- invalid and missing bearer tokens
- fresh Supabase accounts not linking to legacy Clerk identities

### API tests

For every sensitive route, verify:

- anonymous user receives `401`
- authenticated member receives `403` where appropriate
- correctly scoped administrator succeeds
- out-of-scope administrator receives `403`
- national/super admin behavior matches the permission matrix

### Client checks

Verify on web and mobile:

- sign-up
- email confirmation handling
- sign-in
- session refresh
- sign-out
- expired-session behavior
- protected API calls
- admin navigation after reload

Run web, API, and mobile typechecks plus the existing API security test suite.

## Non-goals

- Importing or recovering Clerk passwords
- Automatically linking old Clerk users to Supabase accounts
- Building a separate administrator product
- Moving the existing application database to Supabase
- Replacing family-level memorial roles with platform administrator roles