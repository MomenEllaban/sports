import fs from 'node:fs';

// Loads .env.test (if present) then .env into process.env for vitest (Node 22+).
for (const f of ['.env.test', '.env']) {
  try {
    if (fs.existsSync(f)) process.loadEnvFile?.(f);
  } catch {
    /* ignore */
  }
}
