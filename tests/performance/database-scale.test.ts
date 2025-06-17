import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { DatabaseTestHelper } from '../utils/db-test-helper'
import { setupScaleTest, collectPerformanceMetrics } from '../utils/performance-config'

describe.sequential('Database Scale Performance Tests', () => {
  // Use createInstance for better isolation in performance tests
  const dbHelper = DatabaseTestHelper.createInstance()
  
  beforeAll(() => {
    // Configure scale test settings with extended timeouts and connection management
    const config = setupScaleTest()
    console.log(`Scale test configured with ${config.largeDatasetSize} records, timeout: 5 minutes`)
  })
  
  let org: any
  let mailroom: any
  
  beforeAll(async () => {
    await dbHelper.cleanup()
    
    // Use unique names to prevent conflicts
    const uniqueId = Date.now().toString()
    org = await dbHelper.createTestOrg(`Scale Test University ${uniqueId}`)
    mailroom = await dbHelper.createTestMailroom(org.id)
  })
  
  afterAll(async () => {
    // Ensure complete cleanup after performance tests
    await dbHelper.resetTestEnvironment()
  })
  
  describe('Multi-year Dataset Performance', () => {
    it('should handle queries on 50,000+ historical packages efficiently', async () => {
      const supabase = dbHelper.getClient()
      
      console.log('Creating large historical dataset...')
      
      // Create residents first
      const residents = []
      for (let batch = 0; batch < 50; batch++) {
        const timestamp = Date.now()
        const batchResidents = Array.from({ length: 100 }, (_, i) => ({
          mailroom_id: mailroom.id,
          first_name: `Historical${batch * 100 + i}`,
          last_name: `User${batch * 100 + i}`,
          email: `historical${batch * 100 + i}-${timestamp}@scale.edu`,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }))
        
        const { data } = await supabase
          .from('residents')
          .insert(batchResidents)
          .select()
        
        residents.push(...(data || []))
      }
      
      // Create 50,000 historical packages
      console.log('Inserting 50,000 historical packages...')
      const packageCount = 50000
      
      for (let batch = 0; batch < 500; batch++) {
        const batchPackages = Array.from({ length: 100 }, (_, i) => {
          const globalIndex = batch * 100 + i
          const createdDate = new Date()
          createdDate.setDate(createdDate.getDate() - Math.floor(Math.random() * 1095)) // Up to 3 years ago
          
          return {
            mailroom_id: mailroom.id,
            resident_id: residents[globalIndex % residents.length].id,
            package_id: (globalIndex % 999) + 1,
            status: ['RESOLVED', 'RETRIEVED'][globalIndex % 2],
            provider: ['FedEx', 'UPS', 'USPS', 'Amazon'][globalIndex % 4],
            created_at: createdDate,
            updated_at: createdDate,
            retrieved_timestamp: createdDate
          }
        })
        
        await supabase
          .from('packages')
          .insert(batchPackages)
      }
      
      console.log('Testing large dataset query performance...')
      
      // Test historical search
      const startTime = performance.now()
      
      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
      
      const { data: yearData, count } = await supabase
        .from('packages')
        .select('*', { count: 'exact' })
        .eq('mailroom_id', mailroom.id)
        .gte('created_at', oneYearAgo.toISOString())
        .limit(1000)
      
      const queryTime = performance.now() - startTime
      
      expect(queryTime).toBeLessThan(5000) // Under 5 seconds
      expect(count).toBeGreaterThan(0)
      
      console.log(`Large dataset query (${count} records) completed in ${queryTime.toFixed(2)}ms`)
    }, 900000) // 15 minute timeout for large dataset creation and testing
  })
})