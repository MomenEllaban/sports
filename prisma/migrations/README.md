# Database migrations

The schema is versioned here and applied by `prisma migrate deploy` as the
first step of `npm run build`. **Do not use `prisma db push` for a schema
change** — it mutates the database without recording anything, which leaves
`schema.prisma` and the migration history disagreeing and gives you no way back.

## Making a change

1. Edit `prisma/schema.prisma`.
2. `npm run db:migrate` — Prisma writes the next numbered folder and applies it.
3. Commit the schema change **and** the new migration folder together.
4. Push. The build runs `migrate deploy`, so the database follows the code.

To see where things stand: `npm run db:status`.

## Naming

Folders are a hand-numbered sequence (`NN_description`), not the
`YYYYMMDDHHMMSS_description` timestamps Prisma generates by default. Keep going
from the highest number already present. Prisma only requires the names to sort
correctly, and this repo has always used zero-padded counters, so continuing
that way keeps the history readable.

`0_baseline` is the original full schema. Never edit an already-applied
migration — add a new one.

## If the database is already ahead of the history

This happens when a schema change was applied with `db push`. Record it instead
of re-running it:

```
npx prisma migrate resolve --applied <migration_folder_name>
```

That marks the migration as applied without executing its SQL. Use it only when
you have confirmed the objects already exist with the expected shape —
`migrate resolve` records the fact, it does not verify it.

## Test database

`npm run test:int` uses a separate database; see `tests/helpers`. Apply
migrations there with `migrate deploy` against that database's URL rather than
sharing the production one.
