# RBAC Matrix (T04) — single source of truth: `src/lib/auth/rbac-matrix.ts`

Roles: SUPER_ADMIN > BRANCH_MANAGER > FINANCE > CASHIER > STAFF (see `ROLE_RANK` in
`src/lib/auth/guards.ts`). Enforcement: `requireRole()` (APIs), `requirePageRole()` (pages),
role check in `src/middleware.ts` for `/pos` pages.

| Area | SUPER_ADMIN | BRANCH_MANAGER | FINANCE | CASHIER | STAFF |
|---|---|---|---|---|---|
| users (pages+APIs) | ✅ | ❌ | ❌ | ❌ | ❌ |
| branches, settings (pages+APIs) | ✅ | ❌ | ❌ | ❌ | ❌ |
| accounting, payroll, expenses | ✅ | ❌ | ✅ | ❌ | ❌ |
| orders, products, categories, brands, suppliers, customers, employees, inventory, transfers, purchasing, upload | ✅ | ✅ | ❌ | ❌ | ❌ |
| notifications | ✅ | ✅ | ✅ | ✅ | ✅ |
| POS pages + `/api/pos/*` | ✅ | ✅ | ❌ | ✅ | ❌ |
| storefront + `/api/orders/*` + `/api/auth/*` | public | public | public | public | public |

Anti-escalation (`/api/admin/users/[id]` + POST):
- Only SUPER_ADMIN can create users, and `canGrantRole` caps grants at the actor's own rank
  (so nobody creates a role above themselves; BRANCH_MANAGER can never make SUPER_ADMIN).
- Nobody can change their own role or deactivate themselves; nobody can delete themselves.
- Meta-test `tests/integration/rbac-matrix.test.ts` fails CI if any `route.ts` is unlisted.
