import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    maxWorkers: 2,
    setupFiles: ['src/__tests__/setup/isolateEnv.js'],
    include: ['src/**/*.test.js'],
    exclude: ['node_modules/', 'dist/', 'coverage/'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'cobertura'],
      exclude: [
        'src/infrastructure/persistence/migrations/**',
        'src/infrastructure/persistence/seeders/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});
