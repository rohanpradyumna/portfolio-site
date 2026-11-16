import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Opt-in runner for the scripts that talk to real services (the model
// provider, the database). `npm test` never loads this config.
//
//   npx vitest run --config scripts/council-live.vitest.config.mts council-eval
//   npx vitest run --config scripts/council-live.vitest.config.mts council-db-check
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    root: fileURLToPath(new URL('..', import.meta.url)),
    include: ['scripts/council-*.live.ts'],
    testTimeout: 600_000,
    fileParallelism: false,
  },
});
