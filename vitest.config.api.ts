import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/api/**/*.test.ts'],
    exclude: ['tests/unit/**', 'tests/integration/**', 'tests/e2e/**', 'tests/scale/**'],
    globalSetup: ['tests/api/setup/global-setup.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/types/**', 'src/**/*.d.ts'],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 90,
        statements: 95,
      },
    },
    sequence: {
      shuffle: false, // Deterministic order for scenario tests
    },
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Run tests sequentially for state-dependent scenarios
      },
    },
    env: {
      API_BASE_URL: 'http://localhost:8787',
    },
  },
});
