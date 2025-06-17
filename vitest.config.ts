// vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'path'
import react from '@vitejs/plugin-react'
import { DatabaseTestSequencer } from './tests/utils/test-sequencer'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    css: true,
    // Base timeout for regular tests (increased for performance tests via vi.setConfig)
    testTimeout: 30000, // Increased from 10s to 30s for performance tests
    // Custom test sequencer for database isolation
    sequence: {
      sequencer: DatabaseTestSequencer
    },
    // Allow parallel execution for non-database tests
    pool: 'forks',
    poolOptions: {
      forks: {
        // Limit concurrent processes for database performance tests to prevent connection pool exhaustion
        maxForks: 2, // Reduced from 4 to 2 for better connection management
        minForks: 1,
        // Ensure single fork for sequential performance tests
        singleFork: true
      }
    },
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['components/**/*', 'lib/**/*', 'pages/api/**/*'],
      exclude: ['**/*.d.ts', '**/*.config.*', '**/node_modules/**', 'tests/**/*'],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 80,
          statements: 80
        }
      }
    },
    // Environment variables for test isolation
    env: {
      NODE_ENV: 'test',
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_ANON_KEY: 'test-anon-key'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './')
    }
  }
})