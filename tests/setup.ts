// tests/setup.ts
import '@testing-library/jest-dom'

import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'

import dotenv from 'dotenv'
import path from 'path'
import { server } from './mocks/server.ts'
import { createClient } from '@supabase/supabase-js'

// Load test environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') })
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

// Test database configuration with performance optimizations
const TEST_DB_CONFIG = {
  maxConnections: 5, // Reduced for performance tests to prevent pool exhaustion
  transactionIsolation: true,
  cleanupBetweenTests: true,
  connectionPoolTimeout: 30000, // 30 second timeout
  realisticDataVolumes: {
    packages: 1000,
    residents: 500,
    organizations: 5,
    mailrooms: 10
  },
  performance: {
    // Connection management for performance tests
    limitConcurrentConnections: true,
    sequentialDatabaseOperations: true,
    connectionTimeoutMs: 30000
  }
}

// Database transaction management for isolated tests
let testTransaction: any = null
let testDatabaseClient: any = null

// Singleton pattern for Supabase client to avoid multiple instances
let sharedSupabaseInstance: any = null
let sharedAdminInstance: any = null

// Create singleton instances early to prevent multiple GoTrueClient instances
const getSharedSupabaseInstance = () => {
  if (!sharedSupabaseInstance && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    sharedSupabaseInstance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        },
        // Connection pool settings for performance tests
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            'Connection': 'keep-alive'
          }
        }
      }
    )
  }
  return sharedSupabaseInstance
}

const getSharedAdminInstance = () => {
  if (!sharedAdminInstance && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    sharedAdminInstance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        },
        // Performance optimizations for admin operations
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            'Connection': 'keep-alive'
          }
        }
      }
    )
  }
  return sharedAdminInstance
}

// MSW setup - conditionally start based on test type
beforeAll(async () => {
  // Only start MSW for unit tests that don't use real database
  const shouldUseMSW = !(
    process.env.USE_REAL_DB === 'true' || 
    process.env.VITEST_FILE?.includes('integration/') ||
    process.env.VITEST_FILE?.includes('e2e/') ||
    process.env.VITEST_FILE?.includes('performance/') ||
    process.env.VITEST_FILE?.includes('database/') ||
    process.env.VITEST_FILE?.includes('critical-flows') ||
    process.env.VITEST_FILE?.includes('bulk-operations')
  )
  
  if (shouldUseMSW) {
    server.listen()
  }
  
  // Setup test database connections
  process.env.NODE_ENV = 'test'
  
  // Initialize test database client with singleton pattern
  testDatabaseClient = getSharedAdminInstance()
  
  // Verify connection with simpler approach
  if (testDatabaseClient) {
    try {
      const { error } = await testDatabaseClient.from('organizations').select('id').limit(1)
      if (error && !error.message.includes('JWT')) {
        console.warn('Test database connection failed:', error.message)
      }
    } catch (connError) {
      // Graceful handling of connection issues
    }
  }
})

// Database cleanup between tests for isolation
beforeEach(async () => {
  // Reset MSW handlers only if MSW is running
  const shouldUseMSW = !(
    process.env.USE_REAL_DB === 'true' || 
    process.env.VITEST_FILE?.includes('integration/') ||
    process.env.VITEST_FILE?.includes('e2e/') ||
    process.env.VITEST_FILE?.includes('performance/') ||
    process.env.VITEST_FILE?.includes('database/') ||
    process.env.VITEST_FILE?.includes('critical-flows') ||
    process.env.VITEST_FILE?.includes('bulk-operations')
  )
  
  if (shouldUseMSW) {
    server.resetHandlers()
  }
  
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
      // Enhanced cleanup with proper dependency handling
      const { createdRecords } = testTransaction
      
      // Clean up in reverse dependency order with better error handling
      if (createdRecords.packages.length > 0) {
        const { error } = await testDatabaseClient
          .from('packages')
          .delete()
          .in('id', createdRecords.packages)
        if (error && !error.message.includes('0 rows')) {
          console.warn('Package cleanup warning:', error.message)
        }
      }
      
      if (createdRecords.residents.length > 0) {
        const { error } = await testDatabaseClient
          .from('residents')
          .delete()
          .in('id', createdRecords.residents)
        if (error && !error.message.includes('0 rows')) {
          console.warn('Resident cleanup warning:', error.message)
        }
      }
      
      // Clear foreign key references before deleting
      if (createdRecords.users.length > 0) {
        // First clear mailroom assignments
        await testDatabaseClient
          .from('profiles')
          .update({ mailroom_id: null })
          .in('id', createdRecords.users)
        
        const { error } = await testDatabaseClient
          .from('profiles')
          .delete()
          .in('id', createdRecords.users)
        if (error && !error.message.includes('0 rows')) {
          console.warn('Profile cleanup warning:', error.message)
        }
      }
      
      if (createdRecords.mailrooms.length > 0) {
        // Clear created_by references
        await testDatabaseClient
          .from('mailrooms')
          .update({ created_by: null })
          .in('id', createdRecords.mailrooms)
        
        // Clean up package queues
        for (const mailroomId of createdRecords.mailrooms) {
          try {
            await testDatabaseClient
              .from('package_queue')
              .delete()
              .eq('mailroom_id', mailroomId)
          } catch (queueError) {
            // Ignore queue cleanup errors
          }
        }
        
        const { error } = await testDatabaseClient
          .from('mailrooms')
          .delete()
          .in('id', createdRecords.mailrooms)
        if (error && !error.message.includes('0 rows')) {
          console.warn('Mailroom cleanup warning:', error.message)
        }
      }
      
      if (createdRecords.organizations.length > 0) {
        // Clear any remaining organization references
        await testDatabaseClient
          .from('profiles')
          .update({ organization_id: null })
          .in('organization_id', createdRecords.organizations)
        
        const { error } = await testDatabaseClient
          .from('organizations')
          .delete()
          .in('id', createdRecords.organizations)
        if (error && !error.message.includes('0 rows')) {
          console.warn('Organization cleanup warning:', error.message)
        }
      }
      
      // Clean up any test auth users that might have been created
      try {
        const { data: authUsers } = await testDatabaseClient.auth.admin.listUsers()
        if (authUsers?.users) {
          const testUsers = authUsers.users.filter(user => 
            user.email?.includes('temp-admin-') ||
            user.email?.includes('test-') ||
            user.email?.includes('@example.com')
          )
          
          for (const user of testUsers) {
            try {
              await testDatabaseClient.auth.admin.deleteUser(user.id)
            } catch (authError) {
              // Ignore auth cleanup errors to avoid noise
            }
          }
        }
      } catch (authListError) {
        // Ignore auth listing errors
      }
      
    } catch (error) {
      console.warn('Test cleanup failed:', error)
    }
    
    testTransaction = null
  }
})

afterAll(async () => {
  // Only close MSW if it was started
  const shouldUseMSW = !(
    process.env.USE_REAL_DB === 'true' || 
    process.env.VITEST_FILE?.includes('integration/') ||
    process.env.VITEST_FILE?.includes('e2e/') ||
    process.env.VITEST_FILE?.includes('performance/') ||
    process.env.VITEST_FILE?.includes('database/') ||
    process.env.VITEST_FILE?.includes('critical-flows') ||
    process.env.VITEST_FILE?.includes('bulk-operations')
  );
  
  if (shouldUseMSW) {
    server.close()
  }
  
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

// Export singleton getters for use in tests
export { getSharedSupabaseInstance, getSharedAdminInstance }

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

// Conditionally mock Supabase - use real client for specific test types only
vi.mock('@/lib/supabase', () => {
  // Only use real database for specific database-focused tests
  if (process.env.USE_REAL_DB === 'true' || 
      process.env.VITEST_FILE?.includes('integration/') ||
      process.env.VITEST_FILE?.includes('e2e/') ||
      process.env.VITEST_FILE?.includes('performance/') ||
      process.env.VITEST_FILE?.includes('database/') ||
      process.env.VITEST_FILE?.includes('critical-flows') ||
      process.env.VITEST_FILE?.includes('bulk-operations')) {
    
    return {
      supabase: getSharedSupabaseInstance(),
      createAdminClient: () => getSharedAdminInstance()
    }
  }
  
  // For all other tests (component, contract, smoke), use mocks
  return import('./mocks/supabase.mock.ts').then(mock => ({
    supabase: mock.mockSupabase,
    createAdminClient: mock.createAdminClient
  }))
})

// Mock Nodemailer
vi.mock('nodemailer', async () => {
  const mock = await import('./mocks/email-service.mock.ts')
  return mock.default
})