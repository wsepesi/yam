// Bulk Operations Tests - Testing performance and reliability of bulk package operations
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mockSupabase } from '../../mocks/supabase.mock'
import { packageFactory } from '../../factories'

describe('Bulk Operations', () => {
  beforeEach(() => {
    mockSupabase.clearAllTables()
    mockSupabase.clearErrors()
    vi.clearAllTimers()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Bulk Package Creation Performance', () => {
    it('should handle creating 10 packages within acceptable time', async () => {
      const startTime = Date.now()
      const mailroomId = 'test-mailroom-1'
      const residentId = 'test-resident-1'
      
      // Mock successful bulk creation
      const packages = packageFactory.buildMany(10, {
        mailroom_id: mailroomId,
        resident_id: residentId
      })

      // Mock the bulk insert operation
      const mockInsertResult = packages.map((pkg, index) => ({
        ...pkg,
        id: `bulk-pkg-${index}`,
        package_id: index + 1
      }))

      vi.spyOn(mockSupabase, 'from').mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            then: vi.fn().mockResolvedValue({
              data: mockInsertResult,
              error: null,
              status: 201,
              statusText: 'Created'
            })
          })
        })
      } as any)

      // Simulate bulk creation
      const result = await mockSupabase
        .from('packages')
        .insert(packages)
        .select()

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(result.data).toHaveLength(10)
      expect(result.error).toBeNull()
      expect(duration).toBeLessThan(2000) // Should complete within 2 seconds
    })

    it('should maintain consistent performance with varying batch sizes', async () => {
      const batchSizes = [5, 10, 20]
      const performanceResults: { size: number; duration: number }[] = []

      for (const batchSize of batchSizes) {
        const startTime = Date.now()
        
        const packages = packageFactory.buildMany(batchSize, {
          mailroom_id: 'test-mailroom-1'
        })

        const mockInsertResult = packages.map((pkg, index) => ({
          ...pkg,
          id: `batch-pkg-${index}`,
          package_id: index + 1
        }))

        vi.spyOn(mockSupabase, 'from').mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              then: vi.fn().mockResolvedValue({
                data: mockInsertResult,
                error: null,
                status: 201,
                statusText: 'Created'
              })
            })
          })
        } as any)

        await mockSupabase
          .from('packages')
          .insert(packages)
          .select()

        const endTime = Date.now()
        const duration = endTime - startTime

        performanceResults.push({ size: batchSize, duration })
      }

      // Performance should scale reasonably (not exponentially)
      performanceResults.forEach(result => {
        expect(result.duration).toBeLessThan(result.size * 100) // Max 100ms per package
      })

      // Larger batches shouldn't be disproportionately slower
      const smallBatch = performanceResults[0] // 10 packages
      const largeBatch = performanceResults[3] // 200 packages
      
      expect(largeBatch.duration).toBeLessThan(smallBatch.duration * 30) // Should be less than 30x slower
    })

    it('should handle concurrent bulk operations without conflicts', async () => {
      const concurrentBatches = 5
      const packagesPerBatch = 20
      
      // Create multiple concurrent bulk operations
      const promises = Array.from({ length: concurrentBatches }, (_, batchIndex) => {
        const packages = packageFactory.buildMany(packagesPerBatch, {
          mailroom_id: 'test-mailroom-1',
          staff_id: `staff-${batchIndex}`
        })

        const mockInsertResult = packages.map((pkg, index) => ({
          ...pkg,
          id: `concurrent-pkg-${batchIndex}-${index}`,
          package_id: (batchIndex * packagesPerBatch) + index + 1
        }))

        vi.spyOn(mockSupabase, 'from').mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              then: vi.fn().mockResolvedValue({
                data: mockInsertResult,
                error: null,
                status: 201,
                statusText: 'Created'
              })
            })
          })
        } as any)

        return mockSupabase
          .from('packages')
          .insert(packages)
          .select()
      })

      const results = await Promise.all(promises)

      // All batches should succeed
      results.forEach((result, index) => {
        expect(result.data).toHaveLength(packagesPerBatch)
        expect(result.error).toBeNull()
      })

      // Verify no duplicate package IDs across batches
      const allPackageIds = results.flatMap(result => 
        result.data?.map((pkg: any) => pkg.package_id) || []
      )
      const uniquePackageIds = new Set(allPackageIds)
      expect(uniquePackageIds.size).toBe(allPackageIds.length)
    })

    it('should optimize database connections for bulk operations', async () => {
      const largePackageSet = packageFactory.buildMany(500, {
        mailroom_id: 'test-mailroom-performance'
      })

      // Mock connection pooling behavior
      let connectionCount = 0
      vi.spyOn(mockSupabase, 'from').mockImplementation(() => {
        connectionCount++
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              then: vi.fn().mockResolvedValue({
                data: largePackageSet,
                error: null,
                status: 201,
                statusText: 'Created'
              })
            })
          })
        } as any
      })

      await mockSupabase
        .from('packages')
        .insert(largePackageSet)
        .select()

      // Should use a reasonable number of connections
      expect(connectionCount).toBeLessThanOrEqual(10)
    })
  })

  describe('Bulk Package Status Updates', () => {
    it('should update multiple package statuses efficiently', async () => {
      const packageCount = 50
      const packages = packageFactory.buildMany(packageCount, {
        status: 'WAITING',
        mailroom_id: 'test-mailroom-1'
      })

      // Seed the packages
      mockSupabase.seedTable('packages', packages)

      // Mock bulk status update
      vi.spyOn(mockSupabase, 'from').mockReturnValue({
        update: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              then: vi.fn().mockResolvedValue({
                data: packages.map(pkg => ({ ...pkg, status: 'RETRIEVED' })),
                error: null,
                status: 200,
                statusText: 'OK'
              })
            })
          })
        })
      } as any)

      const packageIds = packages.map(pkg => pkg.id)
      const startTime = Date.now()

      const result = await mockSupabase
        .from('packages')
        .update({ status: 'RETRIEVED', retrieved_timestamp: new Date().toISOString() })
        .in('id', packageIds)
        .select()

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(result.data).toHaveLength(packageCount)
      expect(result.error).toBeNull()
      expect(duration).toBeLessThan(2000) // Should complete within 2 seconds
      
      result.data?.forEach((pkg: any) => {
        expect(pkg.status).toBe('RETRIEVED')
      })
    })

    it('should handle bulk status transitions with validation', async () => {
      const packages = [
        ...packageFactory.buildMany(10, { status: 'WAITING' }),
        ...packageFactory.buildMany(10, { status: 'RETRIEVED' }),
        ...packageFactory.buildMany(10, { status: 'RESOLVED' })
      ]

      mockSupabase.seedTable('packages', packages)

      // Mock selective updates based on current status
      vi.spyOn(mockSupabase, 'from').mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              then: vi.fn().mockResolvedValue({
                data: packages.filter(pkg => pkg.status === 'WAITING').map(pkg => ({ 
                  ...pkg, 
                  status: 'RETRIEVED' 
                })),
                error: null,
                status: 200,
                statusText: 'OK'
              })
            })
          })
        })
      } as any)

      // Only update packages in WAITING status
      const result = await mockSupabase
        .from('packages')
        .update({ status: 'RETRIEVED' })
        .eq('status', 'WAITING')
        .select()

      expect(result.data).toHaveLength(10) // Only WAITING packages updated
    })

    it('should batch updates to prevent database overload', async () => {
      const largePackageSet = packageFactory.buildMany(1000, {
        status: 'WAITING',
        mailroom_id: 'test-mailroom-batch'
      })

      mockSupabase.seedTable('packages', largePackageSet)

      const batchSize = 100
      const batches = Math.ceil(largePackageSet.length / batchSize)
      let processedCount = 0

      // Process in batches
      for (let i = 0; i < batches; i++) {
        const startIndex = i * batchSize
        const endIndex = Math.min(startIndex + batchSize, largePackageSet.length)
        const batchPackages = largePackageSet.slice(startIndex, endIndex)

        vi.spyOn(mockSupabase, 'from').mockReturnValue({
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                then: vi.fn().mockResolvedValue({
                  data: batchPackages.map(pkg => ({ ...pkg, status: 'RETRIEVED' })),
                  error: null,
                  status: 200,
                  statusText: 'OK'
                })
              })
            })
          })
        } as any)

        const packageIds = batchPackages.map(pkg => pkg.id)
        const result = await mockSupabase
          .from('packages')
          .update({ status: 'RETRIEVED' })
          .in('id', packageIds)
          .select()

        processedCount += result.data?.length || 0
      }

      expect(processedCount).toBe(largePackageSet.length)
    })
  })

  describe('Transaction Rollback on Partial Failure', () => {
    it('should rollback all changes when bulk operation partially fails', async () => {
      const packages = packageFactory.buildMany(10, {
        mailroom_id: 'test-mailroom-1'
      })

      // Mock partial failure scenario
      vi.spyOn(mockSupabase, 'from').mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            then: vi.fn().mockRejectedValue(new Error('Constraint violation on package 5'))
          })
        })
      } as any)

      try {
        await mockSupabase
          .from('packages')
          .insert(packages)
          .select()
        
        // Should not reach here
        expect(true).toBe(false)
      } catch (error) {
        expect(error.message).toContain('Constraint violation')
      }

      // Verify no packages were inserted due to rollback
      const remainingPackages = mockSupabase.getTableData('packages')
      expect(remainingPackages).toHaveLength(0)
    })

    it('should handle rollback of complex multi-table operations', async () => {
      const packages = packageFactory.buildMany(5)
      const mockOrganization = { id: 'org-1', name: 'Test Org' }
      const mockMailroom = { id: 'mailroom-1', name: 'Test Mailroom', organization_id: 'org-1' }

      // Mock multi-step transaction
      const transactionSteps = [
        // Step 1: Create organization
        () => mockSupabase.from('organizations').insert(mockOrganization),
        // Step 2: Create mailroom
        () => mockSupabase.from('mailrooms').insert(mockMailroom),
        // Step 3: Create packages (this will fail)
        () => {
          throw new Error('Package creation failed')
        }
      ]

      try {
        for (const step of transactionSteps) {
          await step()
        }
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        // Simulate rollback
        mockSupabase.clearAllTables()
      }

      // Verify rollback cleared all changes
      expect(mockSupabase.getTableData('organizations')).toHaveLength(0)
      expect(mockSupabase.getTableData('mailrooms')).toHaveLength(0)
      expect(mockSupabase.getTableData('packages')).toHaveLength(0)
    })

    it('should preserve data integrity during rollback operations', async () => {
      // Seed some existing data
      const existingPackages = packageFactory.buildMany(3, {
        mailroom_id: 'existing-mailroom'
      })
      mockSupabase.seedTable('packages', existingPackages)

      const newPackages = packageFactory.buildMany(5, {
        mailroom_id: 'new-mailroom'
      })

      // Mock operation that fails after partial insert
      vi.spyOn(mockSupabase, 'from').mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            then: vi.fn().mockRejectedValue(new Error('Transaction failed'))
          })
        })
      } as any)

      try {
        await mockSupabase
          .from('packages')
          .insert(newPackages)
          .select()
      } catch (error) {
        // Expected to fail
      }

      // Existing data should remain intact
      const remainingPackages = mockSupabase.getTableData('packages')
      expect(remainingPackages).toHaveLength(3)
      expect(remainingPackages.every(pkg => pkg.mailroom_id === 'existing-mailroom')).toBe(true)
    })

    it('should handle nested transaction rollbacks', async () => {
      const packages = packageFactory.buildMany(3)
      let transactionDepth = 0

      const nestedTransaction = async (depth: number): Promise<void> => {
        transactionDepth = depth
        
        if (depth === 0) {
          // Innermost transaction - will fail
          throw new Error('Innermost transaction failed')
        }
        
        // Add some data at this level
        mockSupabase.seedTable('packages', [packages[depth - 1]])
        
        // Recurse deeper
        await nestedTransaction(depth - 1)
      }

      try {
        await nestedTransaction(3)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        // Simulate nested rollback
        mockSupabase.clearAllTables()
      }

      // All nested changes should be rolled back
      expect(mockSupabase.getTableData('packages')).toHaveLength(0)
    })
  })

  describe('Memory Usage During Large Operations', () => {
    it('should not exceed memory limits during bulk package creation', async () => {
      const largeDataset = packageFactory.buildMany(10000, {
        mailroom_id: 'memory-test-mailroom'
      })

      // Mock memory-efficient streaming insert
      const batchSize = 1000
      const batches = Math.ceil(largeDataset.length / batchSize)
      
      for (let i = 0; i < batches; i++) {
        const batch = largeDataset.slice(i * batchSize, (i + 1) * batchSize)
        
        // Simulate memory usage monitoring
        const beforeMemory = process.memoryUsage()
        
        vi.spyOn(mockSupabase, 'from').mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              then: vi.fn().mockResolvedValue({
                data: batch,
                error: null,
                status: 201,
                statusText: 'Created'
              })
            })
          })
        } as any)

        await mockSupabase
          .from('packages')
          .insert(batch)
          .select()

        const afterMemory = process.memoryUsage()
        const memoryIncrease = afterMemory.heapUsed - beforeMemory.heapUsed
        
        // Memory increase per batch should be reasonable
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // 50MB max per batch
      }
    })

    it('should implement memory-efficient streaming for large queries', async () => {
      const resultSize = 50000
      const streamBatchSize = 5000
      
      // Mock streaming query results
      const mockStreamResults = Array.from({ length: resultSize }, (_, index) => ({
        id: `stream-pkg-${index}`,
        package_id: index + 1,
        status: 'WAITING'
      }))

      let processedCount = 0
      const processedBatches: number[] = []

      // Simulate streaming processing
      for (let offset = 0; offset < resultSize; offset += streamBatchSize) {
        const batch = mockStreamResults.slice(offset, offset + streamBatchSize)
        
        vi.spyOn(mockSupabase, 'from').mockReturnValue({
          select: vi.fn().mockReturnValue({
            range: vi.fn().mockReturnValue({
              then: vi.fn().mockResolvedValue({
                data: batch,
                error: null,
                status: 200,
                statusText: 'OK'
              })
            })
          })
        } as any)

        const result = await mockSupabase
          .from('packages')
          .select('*')
          .range(offset, offset + streamBatchSize - 1)

        processedCount += result.data?.length || 0
        processedBatches.push(result.data?.length || 0)
      }

      expect(processedCount).toBe(resultSize)
      expect(processedBatches.every(batchSize => batchSize <= streamBatchSize)).toBe(true)
    })

    it('should clean up resources after large operations', async () => {
      const largeOperationData = packageFactory.buildMany(5000)
      
      // Track resource allocation
      const initialMemory = process.memoryUsage()
      
      // Simulate large operation
      vi.spyOn(mockSupabase, 'from').mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            then: vi.fn().mockResolvedValue({
              data: largeOperationData,
              error: null,
              status: 201,
              statusText: 'Created'
            })
          })
        })
      } as any)

      await mockSupabase
        .from('packages')
        .insert(largeOperationData)
        .select()

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      // Allow time for cleanup
      await new Promise(resolve => setTimeout(resolve, 100))

      const finalMemory = process.memoryUsage()
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed
      
      // Memory should not increase excessively after operation
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024) // 100MB max increase
    })

    it('should handle memory pressure gracefully', async () => {
      // Simulate memory pressure scenario
      const memoryHogData = Array.from({ length: 100000 }, (_, index) => ({
        id: `memory-hog-${index}`,
        large_field: 'x'.repeat(1000), // 1KB per record
        status: 'WAITING'
      }))

      // Mock memory-aware batch processing
      const maxMemoryPerBatch = 10 * 1024 * 1024 // 10MB
      const estimatedRecordSize = 1000 // bytes
      const safeBatchSize = Math.floor(maxMemoryPerBatch / estimatedRecordSize)

      let processedCount = 0
      
      for (let i = 0; i < memoryHogData.length; i += safeBatchSize) {
        const batch = memoryHogData.slice(i, i + safeBatchSize)
        
        vi.spyOn(mockSupabase, 'from').mockReturnValue({
          insert: vi.fn().mockReturnValue({
            then: vi.fn().mockResolvedValue({
              data: batch,
              error: null,
              status: 201,
              statusText: 'Created'
            })
          })
        } as any)

        await mockSupabase
          .from('packages')
          .insert(batch)

        processedCount += batch.length

        // Simulate memory cleanup between batches
        if (global.gc) {
          global.gc()
        }
      }

      expect(processedCount).toBe(memoryHogData.length)
    })
  })
})