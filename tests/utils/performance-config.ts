// tests/utils/performance-config.ts
import { vi } from 'vitest'

/**
 * Performance test configuration utilities for timeout and connection management
 */

export const PerformanceTestConfig = {
  // Timeout configurations for different test categories
  timeouts: {
    unit: 30000,           // 30 seconds for unit tests
    concurrent: 120000,    // 2 minutes for concurrent operations
    database: 180000,      // 3 minutes for database performance tests
    scale: 300000,         // 5 minutes for scale tests
    email: 180000,         // 3 minutes for email performance
    comprehensive: 600000,  // 10 minutes for comprehensive tests
    large_dataset: 900000  // 15 minutes for large dataset tests
  },

  // Connection management settings
  connections: {
    maxConcurrent: 2,      // Limit concurrent database connections
    sequentialExecution: true, // Force sequential execution for database-heavy tests
    poolTimeout: 30000     // Connection pool timeout
  },

  // Test execution patterns
  patterns: {
    sequential: true,      // Run performance tests sequentially to avoid conflicts
    isolation: true,       // Enable test isolation for data cleanup
    retries: 1            // Number of retries for flaky performance tests
  }
}

/**
 * Configure timeout for performance test categories
 */
export const configurePerformanceTimeout = (category: keyof typeof PerformanceTestConfig.timeouts) => {
  const timeout = PerformanceTestConfig.timeouts[category]
  vi.setConfig({ testTimeout: timeout })
  return timeout
}

/**
 * Setup for concurrent operation tests with connection limits
 */
export const setupConcurrentTest = () => {
  configurePerformanceTimeout('concurrent')
  // Additional setup for concurrent tests
  return {
    maxOperations: 50,     // Limit concurrent operations to prevent connection exhaustion
    batchSize: 10,         // Process operations in smaller batches
    delayBetweenBatches: 100 // Small delay between batches
  }
}

/**
 * Setup for database performance tests with optimizations
 */
export const setupDatabasePerformanceTest = () => {
  configurePerformanceTimeout('database')
  return {
    batchSize: 100,        // Insert records in batches of 100
    maxRecords: 10000,     // Limit total records for performance tests
    indexOptimization: true, // Enable index-aware query patterns
    cleanupAfterTest: true   // Ensure cleanup of large datasets
  }
}

/**
 * Setup for scale tests with extended timeouts and connection management
 */
export const setupScaleTest = () => {
  configurePerformanceTimeout('scale')
  return {
    largeDatasetSize: 50000, // 50k records for scale testing
    batchSize: 100,          // Smaller batches for better memory management
    connectionLimit: 1,      // Single connection for scale tests
    memoryMonitoring: true   // Enable memory usage monitoring
  }
}

/**
 * Setup for email performance tests
 */
export const setupEmailPerformanceTest = () => {
  configurePerformanceTimeout('email')
  return {
    bulkEmailLimit: 200,   // Limit bulk email tests to 200 emails
    batchSize: 50,         // Send emails in batches of 50
    mockingEnabled: true,  // Ensure email mocking is active
    timeoutPerEmail: 1000  // 1 second timeout per email
  }
}

/**
 * Performance test metrics collection
 */
export const collectPerformanceMetrics = (operationName: string, startTime: number) => {
  const endTime = performance.now()
  const duration = endTime - startTime
  
  const metrics = {
    operation: operationName,
    duration: Math.round(duration),
    timestamp: new Date().toISOString(),
    memoryUsage: process.memoryUsage(),
    isWithinBudget: (expectedDuration: number) => duration < expectedDuration
  }
  
  console.log(`Performance: ${operationName} completed in ${metrics.duration}ms`)
  return metrics
}

/**
 * Sequential execution helper for database-heavy operations
 */
export const executeSequentially = async <T>(
  operations: (() => Promise<T>)[],
  delayMs: number = 100
): Promise<T[]> => {
  const results: T[] = []
  
  for (const operation of operations) {
    const result = await operation()
    results.push(result)
    
    // Small delay to prevent connection pool exhaustion
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
  
  return results
}