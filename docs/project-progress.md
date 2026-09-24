# Project Improvement Progress Tracker

> Reference Analysis: `docs/project-analysis.md`  
> Implementation Plan: `implementation_plan.md`  
> Execution Rule: Work incrementally by groups; verify each gate with tests and lint before committing.

---

## Task Group Overview & Status

| Group | Description | Status | Verification Gate |
|---|---|---|---|
| **Group 01** | Core UX, Navigation & Performance Foundations | **Done** | Unit tests (56/56) + Lint (0 errors) |
| **Group 02** | Dashboard Streaming & Suspense Boundaries | **Done** | `test:dashboard` (57/57) + Typecheck |
| **Group 03** | DataTables, Server-Side Pagination & Filters | **Done** | Typecheck + Unit tests |
| **Group 04** | Database Performance Indexes (`21_perf_indexes`) & Query Aggregations | **Done** | Migration + Prisma generate + Typecheck |
| **Group 05** | POS Multi-Tender Payment Support & Shift Refinements | **Done** | Unit tests + POS route audit |
| **Group 06** | Bulk Data Operations & Responsive Polish | Pending | CSV/Excel verify + Viewport audit |
| **Group 07** | Final QA, Regression Testing & Production Build | Pending | Full CI suite (`lint`, `typecheck`, `test`, `build`) |

---

## Detailed Task Checklist

### Group 01 — Core UX, Navigation & Performance Foundations
- [x] Convert internal `window.location` references to `router.push()` in `ReturnsManager.tsx` and `WishlistClient.tsx`
- [x] Add bilingual and SKU/barcode memoized search with `useDeferredValue` in POS terminal
- [x] Add Enter-key hardware barcode scanner instant add to ticket in POS search input
- [x] Fix missing `Button` import in storefront error boundary

### Group 02 — Dashboard Streaming & Suspense Boundaries
- [x] Deconstruct monolithic `admin/page.tsx` into decoupled Server Components:
  - `ActionQueuesSection`
  - `KpiCardsSection`
  - `RevenueChartSection`
  - `RecentActivitySection`
- [x] Add tailored shimmer skeletons in `DashboardSkeletons.tsx`
- [x] Wrap each section in independent `<Suspense>` boundaries for non-blocking TTFB

### Group 03 — DataTables, Server-Side Pagination & Filters
- [x] Extend `DataTable` in `src/components/ui/foundation.tsx` to support `totalCount` and `loading` skeleton states
- [x] Add instant search filter (order number, customer phone, customer name) to `OrdersManager.tsx`
- [x] Add optimistic status updates in `OrdersManager.tsx` to avoid full-tree refetch cascades

### Group 04 — Database Performance Indexes & Aggregations
- [x] Create migration `21_perf_indexes` with compound and foreign key indexes across:
  - `Order(orderStatus, createdAt)`, `Order(paymentStatus, createdAt)`, `Order(branchId, createdAt)`, `Order(customerId)`, `Order(createdAt)`
  - `OrderItem(orderId)`, `OrderItem(productId)`
  - `Sale(branchId, createdAt)`, `Sale(cashierId, createdAt)`, `Sale(createdAt)`, `Sale(shiftId)`
  - `SaleItem(saleId)`, `SaleItem(productId)`
  - `BranchInventory(stockQuantity)`, `BranchInventory(productId)`
  - `InventoryLog(branchId, productId, createdAt)`, `InventoryLog(referenceId)`, `InventoryLog(createdAt)`
  - `Product(isActive, categoryId)`, `Product(groupSlug)`, `Product(brandId)`, `Product(isFeatured)`
  - `Notification(branchId, isRead, createdAt)`
  - `AuditLog(createdAt, entity)`, `AuditLog(entityId)`
- [x] Refactor `shifts/service.ts` `expectedCashFor` to use Prisma SQL `_sum` aggregations instead of in-memory array scans

### Group 05 — POS Multi-Tender Payment Support & Shifts
- [x] Update `/api/pos/sale/route.ts` to allow all valid retail payment methods (`CASH`, `CARD`, `INSTAPAY`, `FAWRY`, `VODAFONE_CASH`)
- [x] Verify mathematical cash drawer invariant: only cash tender counts towards drawer balance

---

## Verification Log
- `npm run check:i18n`: PASS (207 keys each, 0 missing).
- `npm run check:images`: PASS (41 seed images, 1 static ref).
- `npm run test:dashboard`: PASS (57/57 passed, 0 failed).
- `npm run test:unit`: PASS (12 test files, 56/56 passed).
- `npm run typecheck`: PASS (0 errors).
- `npm run lint`: PASS (0 errors, 49 warnings).
