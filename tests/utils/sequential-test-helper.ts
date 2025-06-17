// Sequential Test Helper for tests that need database isolation
import { DatabaseTestHelper } from './db-test-helper'

class SequentialTestHelper {
  private static instance: SequentialTestHelper
  private dbHelper: DatabaseTestHelper
  private testQueue: Array<() => Promise<void>> = []
  private isProcessing = false
  
  private constructor() {
    this.dbHelper = DatabaseTestHelper.createInstance()
  }
  
  static getInstance(): SequentialTestHelper {
    if (!this.instance) {
      this.instance = new SequentialTestHelper()
    }
    return this.instance
  }
  
  // Execute a test function with full database isolation
  async executeWithIsolation<T>(testFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.testQueue.push(async () => {
        try {
          // Full cleanup before test
          await this.dbHelper.resetTestEnvironment()
          
          // Execute test
          const result = await testFn()
          
          // Full cleanup after test
          await this.dbHelper.resetTestEnvironment()
          
          resolve(result)
        } catch (error) {
          // Cleanup even on failure
          try {
            await this.dbHelper.resetTestEnvironment()
          } catch (cleanupError) {
            console.warn('Cleanup after test failure:', cleanupError)
          }
          reject(error)
        }
      })
      
      this.processQueue()
    })
  }
  
  private async processQueue() {
    if (this.isProcessing || this.testQueue.length === 0) {
      return
    }
    
    this.isProcessing = true
    
    while (this.testQueue.length > 0) {
      const testFn = this.testQueue.shift()!
      await testFn()
    }
    
    this.isProcessing = false
  }
  
  // Get database helper for test setup
  getDbHelper(): DatabaseTestHelper {
    return this.dbHelper
  }
}

export { SequentialTestHelper }

// Helper function for tests that need sequential execution
export function withSequentialIsolation<T>(testFn: () => Promise<T>): Promise<T> {
  const helper = SequentialTestHelper.getInstance()
  return helper.executeWithIsolation(testFn)
}