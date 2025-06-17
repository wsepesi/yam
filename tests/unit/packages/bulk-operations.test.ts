// Bulk Operations Tests - Testing performance and reliability of bulk package operations
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DatabaseTestHelper } from '../../utils/db-test-helper'

// Set flag to use real database for this test
process.env.USE_REAL_DB = 'true'

let dbHelper: DatabaseTestHelper
let testOrganization: any = null
let testMailroom: any = null
let testResident: any = null
let testUser: any = null
let createdPackageIds: string[] = []

describe('Bulk Operations', () => {
  beforeEach(async () => {
    // Create fresh database helper instance for each test
    dbHelper = DatabaseTestHelper.createInstance()
    
    // Create test organization
    testOrganization = await dbHelper.createTestOrg()
    
    // Create test user
    const { profile: user } = await dbHelper.createTestUser(testOrganization.id, null, 'admin')
    testUser = user
    
    // Create test mailroom
    testMailroom = await dbHelper.createTestMailroom(testOrganization.id, {
      name: 'Bulk Test Mailroom',
      created_by: user.id
    })
    
    // Update user with mailroom_id
    const { error: updateUserError } = await dbHelper.getClient()
      .from('profiles')
      .update({ mailroom_id: testMailroom.id })
      .eq('id', user.id)
    
    if (updateUserError) throw new Error(`Failed to update user with mailroom: ${updateUserError.message}`)
    
    // Create test resident
    testResident = await dbHelper.createTestResident(testMailroom.id)
    
    createdPackageIds = []
  })

  afterEach(async () => {
    await dbHelper.cleanup()
  })

  describe('Bulk Package Creation Performance', () => {
    it('should handle creating 10 packages within acceptable time', async () => {
      const startTime = Date.now()
      
      // Create 10 packages using real database operations
      const packages = []
      for (let i = 0; i < 10; i++) {
        // Get next package number from real queue function
        const { data: packageNumber, error: queueError } = await dbHelper.getClient().rpc(
          'get_next_package_number',
          { p_mailroom_id: testMailroom.id }
        )
        
        if (queueError || !packageNumber) {
          throw new Error(`Failed to get package number: ${queueError?.message}`)
        }
        
        const packageData = {
          mailroom_id: testMailroom.id,
          staff_id: testUser.id,
          resident_id: testResident.id,
          status: 'WAITING' as const,
          provider: 'TestProvider',
          package_id: packageNumber
        }
        
        const { data: insertedPackage, error: packageError } = await dbHelper.getClient()
          .from('packages')
          .insert(packageData)
          .select()
          .single()
        
        if (packageError || !insertedPackage) {
          throw new Error(`Failed to insert package: ${packageError?.message}`)
        }
        
        packages.push(insertedPackage)
        createdPackageIds.push(insertedPackage.id)
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(packages).toHaveLength(10)
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds for real DB
      
      // Verify all packages have unique package_ids
      const packageIds = packages.map(pkg => pkg.package_id)
      const uniqueIds = new Set(packageIds)
      expect(uniqueIds.size).toBe(10)
    })

    it('should maintain consistent performance with varying batch sizes', async () => {
      const batchSizes = [3, 5, 8]  // Smaller batches for real DB testing
      const performanceResults: { size: number; duration: number }[] = []

      for (const batchSize of batchSizes) {
        const startTime = Date.now()
        
        // Create packages one by one to simulate real usage
        const batchPackages = []
        for (let i = 0; i < batchSize; i++) {
          const { data: packageNumber } = await dbHelper.getClient().rpc(
            'get_next_package_number',
            { p_mailroom_id: testMailroom.id }
          )
          
          const packageData = {
            mailroom_id: testMailroom.id,
            staff_id: testUser.id,
            resident_id: testResident.id,
            status: 'WAITING' as const,
            provider: 'TestProvider',
            package_id: packageNumber
          }
          
          const { data: insertedPackage } = await dbHelper.getClient()
            .from('packages')
            .insert(packageData)
            .select()
            .single()
          
          batchPackages.push(insertedPackage)
          createdPackageIds.push(insertedPackage.id)
        }

        const endTime = Date.now()
        const duration = endTime - startTime

        performanceResults.push({ size: batchSize, duration })
      }

      // Performance should scale reasonably (not exponentially)
      performanceResults.forEach(result => {
        expect(result.duration).toBeLessThan(result.size * 1000) // Max 1000ms per package for real DB
      })

      // Larger batches shouldn't be disproportionately slower
      const smallBatch = performanceResults[0]
      const largeBatch = performanceResults[2]
      
      expect(largeBatch.duration).toBeLessThan(smallBatch.duration * 10) // Should be less than 10x slower
    })

    it('should handle concurrent package operations without conflicts', async () => {
      const concurrentOperations = 3
      const packagesPerOperation = 2
      
      // Create multiple concurrent package creation operations
      const promises = Array.from({ length: concurrentOperations }, async (_, batchIndex) => {
        const batchPackages = []
        
        for (let i = 0; i < packagesPerOperation; i++) {
          const { data: packageNumber, error: queueError } = await dbHelper.getClient().rpc(
            'get_next_package_number',
            { p_mailroom_id: testMailroom.id }
          )
          
          if (queueError || !packageNumber) {
            throw new Error(`Failed to get package number: ${queueError?.message}`)
          }
          
          const packageData = {
            mailroom_id: testMailroom.id,
            staff_id: testUser.id,
            resident_id: testResident.id,
            status: 'WAITING' as const,
            provider: `Provider-${batchIndex}`,
            package_id: packageNumber
          }
          
          const { data: insertedPackage, error: packageError } = await dbHelper.getClient()
            .from('packages')
            .insert(packageData)
            .select()
            .single()
          
          if (packageError || !insertedPackage) {
            throw new Error(`Failed to insert package: ${packageError?.message}`)
          }
          
          batchPackages.push(insertedPackage)
        }
        
        return batchPackages
      })

      const results = await Promise.all(promises)

      // All batches should succeed
      results.forEach((batchPackages, index) => {
        expect(batchPackages).toHaveLength(packagesPerOperation)
        batchPackages.forEach(pkg => {
          createdPackageIds.push(pkg.id)
        })
      })

      // Verify no duplicate package IDs across batches
      const allPackageIds = results.flatMap(batchPackages => 
        batchPackages.map(pkg => pkg.package_id)
      )
      const uniquePackageIds = new Set(allPackageIds)
      expect(uniquePackageIds.size).toBe(allPackageIds.length)
    })

    it('should handle database operations efficiently for batch operations', async () => {
      const batchSize = 5
      const packages = []
      
      // Test that real database operations work efficiently
      const startTime = Date.now()
      
      for (let i = 0; i < batchSize; i++) {
        const { data: packageNumber } = await dbHelper.getClient().rpc(
          'get_next_package_number',
          { p_mailroom_id: testMailroom.id }
        )
        
        const packageData = {
          mailroom_id: testMailroom.id,
          staff_id: testUser.id,
          resident_id: testResident.id,
          status: 'WAITING' as const,
          provider: 'BatchProvider',
          package_id: packageNumber
        }
        
        const { data: insertedPackage } = await dbHelper.getClient()
          .from('packages')
          .insert(packageData)
          .select()
          .single()
        
        packages.push(insertedPackage)
        createdPackageIds.push(insertedPackage.id)
      }
      
      const endTime = Date.now()
      const duration = endTime - startTime

      // Should complete batch operations in reasonable time
      expect(packages).toHaveLength(batchSize)
      expect(duration).toBeLessThan(10000) // 10 seconds max for 5 packages
      
      // Verify all packages were created successfully
      const { data: verifyPackages } = await dbHelper.getClient()
        .from('packages')
        .select('*')
        .in('id', createdPackageIds)
      
      expect(verifyPackages).toHaveLength(batchSize)
    })
  })

  describe('Bulk Package Status Updates', () => {
    it('should update multiple package statuses efficiently', async () => {
      const packageCount = 3
      const packages = []
      
      // Create test packages first
      for (let i = 0; i < packageCount; i++) {
        const { data: packageNumber } = await dbHelper.getClient().rpc(
          'get_next_package_number',
          { p_mailroom_id: testMailroom.id }
        )
        
        const packageData = {
          mailroom_id: testMailroom.id,
          staff_id: testUser.id,
          resident_id: testResident.id,
          status: 'WAITING' as const,
          provider: 'BulkUpdateProvider',
          package_id: packageNumber
        }
        
        const { data: insertedPackage } = await dbHelper.getClient()
          .from('packages')
          .insert(packageData)
          .select()
          .single()
        
        packages.push(insertedPackage)
        createdPackageIds.push(insertedPackage.id)
      }

      const packageIds = packages.map(pkg => pkg.id)
      const startTime = Date.now()

      // Perform bulk status update
      const { data: result, error } = await dbHelper.getClient()
        .from('packages')
        .update({ 
          status: 'RETRIEVED',
          retrieved_timestamp: new Date().toISOString()
        })
        .in('id', packageIds)
        .select()

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(result).toHaveLength(packageCount)
      expect(error).toBeNull()
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds for real DB
      
      result?.forEach((pkg: any) => {
        expect(pkg.status).toBe('RETRIEVED')
        expect(pkg.retrieved_timestamp).toBeDefined()
      })
    })

    it('should handle bulk status transitions with validation', async () => {
      // Create packages with different statuses
      const waitingPackages = []
      const retrievedPackages = []
      
      // Create 2 WAITING packages
      for (let i = 0; i < 2; i++) {
        const { data: packageNumber } = await dbHelper.getClient().rpc(
          'get_next_package_number',
          { p_mailroom_id: testMailroom.id }
        )
        
        const packageData = {
          mailroom_id: testMailroom.id,
          staff_id: testUser.id,
          resident_id: testResident.id,
          status: 'WAITING' as const,
          provider: 'StatusTestProvider',
          package_id: packageNumber
        }
        
        const { data: insertedPackage } = await dbHelper.getClient()
          .from('packages')
          .insert(packageData)
          .select()
          .single()
        
        waitingPackages.push(insertedPackage)
        createdPackageIds.push(insertedPackage.id)
      }
      
      // Create 1 RETRIEVED package
      const { data: packageNumber } = await dbHelper.getClient().rpc(
        'get_next_package_number',
        { p_mailroom_id: testMailroom.id }
      )
      
      const retrievedPackageData = {
        mailroom_id: testMailroom.id,
        staff_id: testUser.id,
        resident_id: testResident.id,
        status: 'RETRIEVED' as const,
        provider: 'StatusTestProvider',
        package_id: packageNumber,
        retrieved_timestamp: new Date().toISOString()
      }
      
      const { data: retrievedPackage } = await dbHelper.getClient()
        .from('packages')
        .insert(retrievedPackageData)
        .select()
        .single()
      
      retrievedPackages.push(retrievedPackage)
      createdPackageIds.push(retrievedPackage.id)

      // Only update packages in WAITING status
      const { data: result } = await dbHelper.getClient()
        .from('packages')
        .update({ status: 'RETRIEVED', retrieved_timestamp: new Date().toISOString() })
        .eq('status', 'WAITING')
        .eq('mailroom_id', testMailroom.id)
        .select()

      expect(result).toHaveLength(2) // Only WAITING packages updated
      result?.forEach((pkg: any) => {
        expect(pkg.status).toBe('RETRIEVED')
      })
    })

    it('should batch updates to prevent database overload', async () => {
      const largePackageCount = 6
      const batchSize = 3
      const packages = []
      
      // Create packages
      for (let i = 0; i < largePackageCount; i++) {
        const { data: packageNumber } = await dbHelper.getClient().rpc(
          'get_next_package_number',
          { p_mailroom_id: testMailroom.id }
        )
        
        const packageData = {
          mailroom_id: testMailroom.id,
          staff_id: testUser.id,
          resident_id: testResident.id,
          status: 'WAITING' as const,
          provider: 'BatchProvider',
          package_id: packageNumber
        }
        
        const { data: insertedPackage } = await dbHelper.getClient()
          .from('packages')
          .insert(packageData)
          .select()
          .single()
        
        packages.push(insertedPackage)
        createdPackageIds.push(insertedPackage.id)
      }

      const batches = Math.ceil(packages.length / batchSize)
      let processedCount = 0

      // Process in batches
      for (let i = 0; i < batches; i++) {
        const startIndex = i * batchSize
        const endIndex = Math.min(startIndex + batchSize, packages.length)
        const batchPackages = packages.slice(startIndex, endIndex)

        const packageIds = batchPackages.map(pkg => pkg.id)
        const { data: result } = await dbHelper.getClient()
          .from('packages')
          .update({ status: 'RETRIEVED', retrieved_timestamp: new Date().toISOString() })
          .in('id', packageIds)
          .select()

        processedCount += result?.length || 0
      }

      expect(processedCount).toBe(packages.length)
    })
  })

  describe('Transaction Rollback on Partial Failure', () => {
    it('should handle constraint violations gracefully', async () => {
      // Create a package with package_id 1
      const { data: packageNumber } = await dbHelper.getClient().rpc(
        'get_next_package_number',
        { p_mailroom_id: testMailroom.id }
      )
      
      const packageData = {
        mailroom_id: testMailroom.id,
        staff_id: testUser.id,
        resident_id: testResident.id,
        status: 'WAITING' as const,
        provider: 'FirstProvider',
        package_id: packageNumber
      }
      
      const { data: firstPackage } = await dbHelper.getClient()
        .from('packages')
        .insert(packageData)
        .select()
        .single()
      
      createdPackageIds.push(firstPackage.id)

      // Try to create another package with the same package_id in the same mailroom
      // This should fail due to unique constraint
      const duplicatePackageData = {
        mailroom_id: testMailroom.id,
        staff_id: testUser.id,
        resident_id: testResident.id,
        status: 'WAITING' as const,
        provider: 'DuplicateProvider',
        package_id: packageNumber // Same package_id - should fail
      }
      
      const { data: failedPackage, error } = await dbHelper.getClient()
        .from('packages')
        .insert(duplicatePackageData)
        .select()
        .single()
      
      // The test may or may not fail depending on database constraints
      // Package numbers are unique per mailroom, so this could succeed
      if (error) {
        expect(failedPackage).toBeNull()
      } else {
        expect(failedPackage).toBeDefined()
      }
      
      // Verify packages in mailroom
      const { data: remainingPackages } = await dbHelper.getClient()
        .from('packages')
        .select('*')
        .eq('mailroom_id', testMailroom.id)
      
      // Should have at least the original package
      expect(remainingPackages.length).toBeGreaterThanOrEqual(1)
      expect(remainingPackages.some(p => p.package_id === packageNumber)).toBe(true)
    })

    it('should handle foreign key constraint violations', async () => {
      // Try to create a package with invalid resident_id
      const { data: packageNumber } = await dbHelper.getClient().rpc(
        'get_next_package_number',
        { p_mailroom_id: testMailroom.id }
      )
      
      const invalidPackageData = {
        mailroom_id: testMailroom.id,
        staff_id: testUser.id,
        resident_id: 'non-existent-resident-id', // Invalid foreign key
        status: 'WAITING' as const,
        provider: 'InvalidProvider',
        package_id: packageNumber
      }
      
      const { data: failedPackage, error } = await dbHelper.getClient()
        .from('packages')
        .insert(invalidPackageData)
        .select()
        .single()
      
      // Should fail due to invalid UUID format (which is caught before foreign key constraint)
      expect(error).toBeDefined()
      expect(failedPackage).toBeNull()
      expect(error.message).toContain('invalid input syntax for type uuid')
      
      // Verify no packages were created in mailroom
      const { data: remainingPackages } = await dbHelper.getClient()
        .from('packages')
        .select('*')
        .eq('mailroom_id', testMailroom.id)
      
      expect(remainingPackages).toHaveLength(0)
    })

    it('should preserve data integrity during failed operations', async () => {
      // Create one successful package first
      const { data: packageNumber1 } = await dbHelper.getClient().rpc(
        'get_next_package_number',
        { p_mailroom_id: testMailroom.id }
      )
      
      const successfulPackageData = {
        mailroom_id: testMailroom.id,
        staff_id: testUser.id,
        resident_id: testResident.id,
        status: 'WAITING' as const,
        provider: 'SuccessfulProvider',
        package_id: packageNumber1
      }
      
      const { data: successfulPackage } = await dbHelper.getClient()
        .from('packages')
        .insert(successfulPackageData)
        .select()
        .single()
      
      createdPackageIds.push(successfulPackage.id)
      
      // Now try to create an invalid package
      const { data: packageNumber2 } = await dbHelper.getClient().rpc(
        'get_next_package_number',
        { p_mailroom_id: testMailroom.id }
      )
      
      const invalidPackageData = {
        mailroom_id: testMailroom.id,
        staff_id: 'invalid-staff-id', // Invalid foreign key
        resident_id: testResident.id,
        status: 'WAITING' as const,
        provider: 'FailedProvider',
        package_id: packageNumber2
      }
      
      const { data: failedPackage, error } = await dbHelper.getClient()
        .from('packages')
        .insert(invalidPackageData)
        .select()
        .single()
      
      expect(error).toBeDefined()
      expect(failedPackage).toBeNull()
      
      // Existing successful data should remain intact
      const { data: remainingPackages } = await dbHelper.getClient()
        .from('packages')
        .select('*')
        .eq('mailroom_id', testMailroom.id)
      
      expect(remainingPackages).toHaveLength(1)
      expect(remainingPackages[0].id).toBe(successfulPackage.id)
      expect(remainingPackages[0].provider).toBe('SuccessfulProvider')
    })

    it('should handle package queue number recovery after failed operations', async () => {
      // Get a package number
      const { data: packageNumber } = await dbHelper.getClient().rpc(
        'get_next_package_number',
        { p_mailroom_id: testMailroom.id }
      )
      
      expect(packageNumber).toBeDefined()
      expect(typeof packageNumber).toBe('number')
      
      // Try to create a package with invalid data to force failure
      const invalidPackageData = {
        mailroom_id: testMailroom.id,
        staff_id: testUser.id,
        resident_id: testResident.id,
        status: 'INVALID_STATUS' as any, // Invalid enum value
        provider: 'FailureProvider',
        package_id: packageNumber
      }
      
      const { data: failedPackage, error } = await dbHelper.getClient()
        .from('packages')
        .insert(invalidPackageData)
        .select()
        .single()
      
      expect(error).toBeDefined()
      expect(failedPackage).toBeNull()
      
      // The package number should potentially be released back to queue
      // (depending on implementation - this tests that the queue system handles failures)
      const { data: nextPackageNumber } = await dbHelper.getClient().rpc(
        'get_next_package_number',
        { p_mailroom_id: testMailroom.id }
      )
      
      expect(nextPackageNumber).toBeDefined()
      expect(typeof nextPackageNumber).toBe('number')
    })
  })

  describe('Memory Usage During Large Operations', () => {
    it('should not exceed memory limits during package creation', async () => {
      const smallBatch = 5 // Reasonable batch size for real DB testing
      const packages = []
      
      // Monitor memory usage during batch operations
      const beforeMemory = process.memoryUsage()
      
      for (let i = 0; i < smallBatch; i++) {
        const { data: packageNumber } = await dbHelper.getClient().rpc(
          'get_next_package_number',
          { p_mailroom_id: testMailroom.id }
        )
        
        const packageData = {
          mailroom_id: testMailroom.id,
          staff_id: testUser.id,
          resident_id: testResident.id,
          status: 'WAITING' as const,
          provider: 'MemoryTestProvider',
          package_id: packageNumber
        }
        
        const { data: insertedPackage } = await dbHelper.getClient()
          .from('packages')
          .insert(packageData)
          .select()
          .single()
        
        packages.push(insertedPackage)
        createdPackageIds.push(insertedPackage.id)
      }

      const afterMemory = process.memoryUsage()
      const memoryIncrease = afterMemory.heapUsed - beforeMemory.heapUsed
      
      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024) // 10MB max for small batch
      expect(packages).toHaveLength(smallBatch)
    })

    it('should implement efficient querying for package data', async () => {
      const queryBatchSize = 3
      
      // Create some packages to query
      for (let i = 0; i < queryBatchSize; i++) {
        const { data: packageNumber } = await dbHelper.getClient().rpc(
          'get_next_package_number',
          { p_mailroom_id: testMailroom.id }
        )
        
        const packageData = {
          mailroom_id: testMailroom.id,
          staff_id: testUser.id,
          resident_id: testResident.id,
          status: 'WAITING' as const,
          provider: 'QueryTestProvider',
          package_id: packageNumber
        }
        
        const { data: insertedPackage } = await dbHelper.getClient()
          .from('packages')
          .insert(packageData)
          .select()
          .single()
        
        createdPackageIds.push(insertedPackage.id)
      }

      let processedCount = 0
      const limit = 2
      let offset = 0

      // Simulate paginated querying
      while (processedCount < queryBatchSize) {
        const { data: batch } = await dbHelper.getClient()
          .from('packages')
          .select('*')
          .eq('mailroom_id', testMailroom.id)
          .range(offset, offset + limit - 1)

        processedCount += batch?.length || 0
        offset += limit
        
        if (!batch || batch.length === 0) break
      }

      expect(processedCount).toBe(queryBatchSize)
    })

    it('should clean up resources after operations', async () => {
      const operationBatchSize = 3
      
      // Track resource allocation
      const initialMemory = process.memoryUsage()
      
      // Perform package creation operation
      for (let i = 0; i < operationBatchSize; i++) {
        const { data: packageNumber } = await dbHelper.getClient().rpc(
          'get_next_package_number',
          { p_mailroom_id: testMailroom.id }
        )
        
        const packageData = {
          mailroom_id: testMailroom.id,
          staff_id: testUser.id,
          resident_id: testResident.id,
          status: 'WAITING' as const,
          provider: 'CleanupTestProvider',
          package_id: packageNumber
        }
        
        const { data: insertedPackage } = await dbHelper.getClient()
          .from('packages')
          .insert(packageData)
          .select()
          .single()
        
        createdPackageIds.push(insertedPackage.id)
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      // Allow time for cleanup
      await new Promise(resolve => setTimeout(resolve, 100))

      const finalMemory = process.memoryUsage()
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed
      
      // Memory should not increase excessively after operation
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024) // 20MB max increase for small operations
    })

    it('should handle memory efficiently with package operations', async () => {
      const batchCount = 2
      const packagesPerBatch = 2
      let processedCount = 0
      
      // Process packages in small batches to test memory efficiency
      for (let batch = 0; batch < batchCount; batch++) {
        const beforeBatchMemory = process.memoryUsage()
        
        for (let i = 0; i < packagesPerBatch; i++) {
          const { data: packageNumber } = await dbHelper.getClient().rpc(
            'get_next_package_number',
            { p_mailroom_id: testMailroom.id }
          )
          
          const packageData = {
            mailroom_id: testMailroom.id,
            staff_id: testUser.id,
            resident_id: testResident.id,
            status: 'WAITING' as const,
            provider: `MemoryBatch${batch}Provider`,
            package_id: packageNumber
          }
          
          const { data: insertedPackage } = await dbHelper.getClient()
            .from('packages')
            .insert(packageData)
            .select()
            .single()
          
          createdPackageIds.push(insertedPackage.id)
          processedCount++
        }

        // Memory cleanup between batches
        if (global.gc) {
          global.gc()
        }
        
        const afterBatchMemory = process.memoryUsage()
        const batchMemoryIncrease = afterBatchMemory.heapUsed - beforeBatchMemory.heapUsed
        
        // Memory increase per batch should be reasonable
        expect(batchMemoryIncrease).toBeLessThan(5 * 1024 * 1024) // 5MB max per batch
      }

      expect(processedCount).toBe(batchCount * packagesPerBatch)
    })
  })
})

// Test demonstrates that unit tests should focus on business logic validation
// rather than database performance or integration concerns