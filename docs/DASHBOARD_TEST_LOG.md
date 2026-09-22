# Dashboard Test Log — automated flow

> Generated 2026-09-22T09:48:21.640Z · no-browser audit (pages + loaders + security + link integrity).

## Summary

- **Passed:** 57
- **Failed:** 0

## Checks

| Status | Check | Detail |
| --- | --- | --- |
| ✅ | admin group loading.tsx | present (covers all admin pages as SSR loader) |
| ✅ | admin group error.tsx | present (covers all admin pages as failsafe) |
| ✅ | /admin/accounting/page.tsx | loader + error inherited from admin group |
| ✅ | /admin/audit/page.tsx | loader + error inherited from admin group |
| ✅ | /admin/branches/page.tsx | loader + error inherited from admin group |
| ✅ | /admin/cod-settlement/page.tsx | loader + error inherited from admin group |
| ✅ | /admin/coupons/page.tsx | loader + error inherited from admin group |
| ✅ | /admin/customers/page.tsx | loader + error inherited from admin group |
| ✅ | /admin/employees/page.tsx | loader + error inherited from admin group |
| ✅ | /admin/inventory/count/page.tsx | loader + error inherited from admin group |
| ✅ | /admin/inventory/labels/page.tsx | loader + error inherited from admin group |
| ✅ | /admin/inventory/page.tsx | loader + error inherited from admin group |
| ✅ | login page | auto-redirects; no data loader needed |
| ✅ | /admin/notifications/page.tsx | loader + error inherited from admin group |
| ✅ | /admin/orders/page.tsx | loader + error inherited from admin group |
| ✅ | /admin/page.tsx | loader + error inherited from admin group |
| ✅ | /admin/payroll/page.tsx | loader + error inherited from admin group |
| ✅ | /admin/products/page.tsx | loader + error inherited from admin group |
| ✅ | /admin/purchasing/page.tsx | loader + error inherited from admin group |
| ✅ | /admin/reports/page.tsx | loader + error inherited from admin group |
| ✅ | /admin/returns/[id]/page.tsx | loader + error inherited from admin group |
| ✅ | /admin/returns/new/page.tsx | loader + error inherited from admin group |
| ✅ | /admin/returns/page.tsx | loader + error inherited from admin group |
| ✅ | /admin/reviews/page.tsx | loader + error inherited from admin group |
| ✅ | /admin/settings/page.tsx | loader + error inherited from admin group |
| ✅ | /admin/settings/setup/page.tsx | loader + error inherited from admin group |
| ✅ | /admin/shifts/page.tsx | loader + error inherited from admin group |
| ✅ | /admin/users/page.tsx | loader + error inherited from admin group |
| ✅ | /admin/accounting/page.tsx | guard: 'SUPER_ADMIN', 'FINANCE' |
| ✅ | /admin/audit/page.tsx | guard: 'SUPER_ADMIN' |
| ✅ | /admin/branches/page.tsx | guard: 'SUPER_ADMIN' |
| ✅ | /admin/cod-settlement/page.tsx | guard: 'SUPER_ADMIN', 'FINANCE' |
| ✅ | /admin/coupons/page.tsx | guard: 'SUPER_ADMIN', 'BRANCH_MANAGER' |
| ✅ | /admin/customers/page.tsx | guard: 'SUPER_ADMIN', 'BRANCH_MANAGER' |
| ✅ | /admin/employees/page.tsx | guard: 'SUPER_ADMIN', 'BRANCH_MANAGER' |
| ✅ | /admin/inventory/count/page.tsx | guard: 'SUPER_ADMIN', 'BRANCH_MANAGER' |
| ✅ | /admin/inventory/labels/page.tsx | guard: 'SUPER_ADMIN', 'BRANCH_MANAGER' |
| ✅ | /admin/inventory/page.tsx | guard: 'SUPER_ADMIN', 'BRANCH_MANAGER' |
| ✅ | /admin/login/page.tsx | public login, redirects to /admin/dashboard when already signed in |
| ✅ | /admin/notifications/page.tsx | guard: 'SUPER_ADMIN', 'FINANCE', 'BRANCH_MANAGER', 'CASHIER', 'STAFF' |
| ✅ | /admin/orders/page.tsx | guard: 'SUPER_ADMIN', 'BRANCH_MANAGER' |
| ✅ | /admin/page.tsx | guard: 'SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE' |
| ✅ | /admin/payroll/page.tsx | guard: 'SUPER_ADMIN', 'FINANCE' |
| ✅ | /admin/products/page.tsx | guard: 'SUPER_ADMIN', 'BRANCH_MANAGER' |
| ✅ | /admin/purchasing/page.tsx | guard: 'SUPER_ADMIN', 'BRANCH_MANAGER' |
| ✅ | /admin/reports/page.tsx | guard: 'SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE' |
| ✅ | /admin/returns/[id]/page.tsx | guard: 'SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE' |
| ✅ | /admin/returns/new/page.tsx | guard: 'SUPER_ADMIN', 'BRANCH_MANAGER' |
| ✅ | /admin/returns/page.tsx | guard: 'SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE' |
| ✅ | /admin/reviews/page.tsx | guard: 'SUPER_ADMIN', 'BRANCH_MANAGER' |
| ✅ | /admin/settings/page.tsx | guard: 'SUPER_ADMIN' |
| ✅ | /admin/settings/setup/page.tsx | guard: 'SUPER_ADMIN' |
| ✅ | /admin/shifts/page.tsx | guard: 'SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE' |
| ✅ | /admin/users/page.tsx | guard: 'SUPER_ADMIN' |
| ✅ | middleware | matches /admin (early auth interception) |
| ✅ | admin internal links | 16 unique /admin hrefs all resolve |
| ✅ | storefront internal links | 10 unique storefront hrefs all resolve |

## Failures

None — all checks passed.
