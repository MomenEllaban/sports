# PROGRESS (AGENT_FINAL, tasks 00–40)

| Task | Title | Status | Commit | Tests | Notes |
|---|---|---|---|---|---|
| 00 | Recon and verification | DONE | (this commit) | baseline tsc0/build0 | docs/audit-verification.md + route-inventory.md |
| 01 | Test foundation | DONE | (this commit) | vitest 7/7, e2e 4+4, lint 0 err | env-guard, migrations baseline, CI, docs/testing.md |
| 02 | Seeder v1 | DONE | (this commit) | seed idempotent, login e2e, smoke 57 | 41 models/141 SKUs, docs/seed.md |
| 03 | Protect POS | DONE | (this commit) | pos-guard 5/5, e2e POS redirect | guards.ts, middleware, test-DB incident fixed |
| 04 | Server-side RBAC | DONE | (this commit) | matrix meta + enforcement 6/6, all 22/22 | guards, matrix, page guards, escalation blocks |
| 05 | POS session branch | DONE | (this commit) | pos-branch 3/3, guards green | context resolver, cashierId, branch picker |
| 06 | Server pricing+discounts | DONE | (this commit) | pos-discount 7/7, all 32/32 | discount auth, PIN lockout, approver recorded |
| 07 | Atomic inventory | DONE | (this commit) | pos-atomic 5/5, all 37/37 | inventory service, tx, idempotency |
| 08 | Order state machine | DONE | (this commit) | order-status 5/5 | transitions, exactly-once restock |
| 09 | Central money math | DONE | (this commit) | pricing 5/5 + props, all 47/47 | pricing.ts, all call sites migrated |
| 10 | Float to Decimal | DONE | (this commit) | all 47/47, build+smoke green | 28 cols Decimal(12,2), num() boundary |
| 11 | Invariant checker | DONE | (this commit) | corruption test 2/2, dev CLEAN | runChecks, check:invariants |

## Conventions
- One commit per task + tag `task-NN-done`. NEVER push.
- Test-first: RED output then GREEN output in each `docs/progress/task-NN.md`.
- Seed lives in `prisma/seed.ts` until T02 modularizes it.
