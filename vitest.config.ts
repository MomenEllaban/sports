import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 120000,
    hookTimeout: 120000,
    pool: 'forks',
    maxWorkers: 1,
    // Integration files share ONE test schema: never run them in parallel.
    fileParallelism: false,
    sequence: { shuffle: false },
    setupFiles: ['tests/setup-env.ts', 'tests/setup-mocks.ts'],
  },
});
