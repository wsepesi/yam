// vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    css: true,
    // Increase timeout for database operations
    testTimeout: 10000,
    // Run tests sequentially for database safety
    pool: 'forks',
    poolOptions: {
      forks: {
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