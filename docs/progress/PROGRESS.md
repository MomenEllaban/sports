# PROGRESS (AGENT_FINAL, tasks 00–40)

| Task | Title | Status | Commit | Tests | Notes |
|---|---|---|---|---|---|
| 00 | Recon and verification | DONE | (this commit) | baseline tsc0/build0 | docs/audit-verification.md + route-inventory.md |
| 01 | Test foundation | DONE | (this commit) | vitest 7/7, e2e 4+4, lint 0 err | env-guard, migrations baseline, CI, docs/testing.md |
| 02 | Seeder v1 | DONE | (this commit) | seed idempotent, login e2e, smoke 57 | 41 models/141 SKUs, docs/seed.md |
| 03 | Protect POS | DONE | (this commit) | pos-guard 5/5, e2e POS redirect | guards.ts, middleware, test-DB incident fixed |

## Conventions
- One commit per task + tag `task-NN-done`. NEVER push.
- Test-first: RED output then GREEN output in each `docs/progress/task-NN.md`.
- Seed lives in `prisma/seed.ts` until T02 modularizes it.
