// tests/setup.ts
import '@testing-library/jest-dom'

import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'

import dotenv from 'dotenv'
import path from 'path'
import { server } from './mocks/server.ts'

// Load test environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') })
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

// Test database configuration
const TEST_DB_CONFIG = {
  maxConnections: 10,
  transactionIsolation: true,
  cleanupBetweenTests: true,
  realisticDataVolumes: {
    packages: 1000,
    residents: 500,
    organizations: 5,
    mailrooms: 10
  }
}

// Database transaction management for isolated tests
let testTransaction: any = null
let testDatabaseClient: any = null

// MSW setup
beforeAll(async () => {
  server.listen()
  // Setup test database connections
  process.env.NODE_ENV = 'test'
  
  // Initialize test database client with proper configuration
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      testDatabaseClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      
      // Verify connection
      const { error } = await testDatabaseClient.from('organizations').select('id').limit(1)
      if (error) {
        console.warn('Test database connection failed:', error.message)
      }
    } catch (error) {
      console.warn('Test database setup failed:', error)
    }
  }
})

// Database cleanup between tests for isolation
beforeEach(async () => {
  // Reset MSW handlers
  server.resetHandlers()
  
  if (TEST_DB_CONFIG.transactionIsolation && testDatabaseClient) {
    try {
      // Begin transaction for test isolation
      // Note: Supabase doesn't support explicit transactions in the same way as raw SQL
      // Instead, we'll track what we need to clean up
      testTransaction = {
        id: Math.random().toString(36),
        createdRecords: {
          packages: [],
          residents: [],
          users: [],
          organizations: [],
          mailrooms: []
        },
        startTime: Date.now()
      }
    } catch (error) {
      console.warn('Test transaction setup failed:', error)
    }
  }
  
  // Reset any mock data
  const { resetMockData } = await import('./mocks/handlers')
  resetMockData()
})

afterEach(async () => {
  if (TEST_DB_CONFIG.cleanupBetweenTests && testTransaction && testDatabaseClient) {
    try {
      // Clean up test data created during this test
      // This is a simplified cleanup - in production you'd want more robust cleanup
      const { createdRecords } = testTransaction
      
      // Clean up in reverse dependency order
      if (createdRecords.packages.length > 0) {
        await testDatabaseClient
          .from('packages')
          .delete()
          .in('id', createdRecords.packages)
      }
      
      if (createdRecords.residents.length > 0) {
        await testDatabaseClient
          .from('residents')
          .delete()
          .in('id', createdRecords.residents)
      }
      
      if (createdRecords.users.length > 0) {
        await testDatabaseClient
          .from('profiles')
          .delete()
          .in('id', createdRecords.users)
      }
      
      if (createdRecords.mailrooms.length > 0) {
        await testDatabaseClient
          .from('mailrooms')
          .delete()
          .in('id', createdRecords.mailrooms)
      }
      
      if (createdRecords.organizations.length > 0) {
        await testDatabaseClient
          .from('organizations')
          .delete()
          .in('id', createdRecords.organizations)
      }
      
    } catch (error) {
      console.warn('Test cleanup failed:', error)
    }
    
    testTransaction = null
  }
})

afterAll(async () => {
  server.close()
  
  // Close test database connections
  if (testDatabaseClient) {
    // Supabase clients don't need explicit closing
    testDatabaseClient = null
  }
})

// Test utilities for tracking created records
export const trackCreatedRecord = (table: string, id: string) => {
  if (testTransaction && testTransaction.createdRecords[table]) {
    testTransaction.createdRecords[table].push(id)
  }
}

export const getTestDatabaseClient = () => testDatabaseClient

// Mock Next.js router
vi.mock('next/router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    query: {},
    pathname: '/',
    asPath: '/',
    isReady: true
  })
}))

// Mock Supabase
vi.mock('@/lib/supabase', async () => {
  const mock = await import('./mocks/supabase.mock.ts')
  return {
    supabase: mock.mockSupabase,
    createAdminClient: mock.createAdminClient
  }
})

// Mock Nodemailer
vi.mock('nodemailer', async () => {
  const mock = await import('./mocks/email-service.mock.ts')
  return mock.default
})