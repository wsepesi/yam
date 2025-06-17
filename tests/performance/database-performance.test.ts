import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { DatabaseTestHelper } from '../utils/db-test-helper'
import { setupDatabasePerformanceTest, collectPerformanceMetrics } from '../utils/performance-config'

describe.sequential('Database Performance Tests', () => {
  const dbHelper = DatabaseTestHelper.getInstance()
  
  beforeAll(() => {
    // Configure database performance test settings
    const config = setupDatabasePerformanceTest()
    console.log(`Database performance test configured with ${config.maxRecords} max records, timeout: 3 minutes`)
  })
  
  let org: any
  let mailroom: any
  let staff: any
  
  beforeAll(async () => {
    await dbHelper.cleanup()
    
    org = await dbHelper.createTestOrg('Performance Test University')
    mailroom = await dbHelper.createTestMailroom(org.id)
    staff = await dbHelper.createTestUser(org.id, mailroom.id, 'manager')
  })
  
  afterAll(async () => {
    await dbHelper.cleanup()
  })
  
  describe('Large Dataset Query Performance', () => {
    it('should maintain sub-second response times with 10,000+ packages', async () => {
      const supabase = dbHelper.getClient()
      
      console.log('Creating large dataset for performance testing...')
      
      // Create residents first
      const residentCount = 1000
      const residents = []
      
      // Batch create residents
      for (let batch = 0; batch < 10; batch++) {
        const batchResidents = Array.from({ length: 100 }, (_, i) => ({
          mailroom_id: mailroom.id,
          first_name: `Test${batch * 100 + i}`,
          last_name: `User${batch * 100 + i}`,
          email: `test${batch * 100 + i}@perf.edu`,
          student_id: `STU${String(batch * 100 + i).padStart(6, '0')}`,
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
      
      // Create packages with varied statuses and dates
      const packageCount = 10000
      const statuses = ['WAITING', 'RETRIEVED', 'RESOLVED']
      const providers = ['FedEx', 'UPS', 'USPS', 'Amazon', 'DHL']
      
      console.log('Inserting 10,000 packages...')
      
      // Insert packages in batches to avoid timeouts
      for (let batch = 0; batch < 100; batch++) {
        const batchPackages = Array.from({ length: 100 }, (_, i) => {
          const globalIndex = batch * 100 + i
          return {
            mailroom_id: mailroom.id,
            resident_id: residents[globalIndex % residentCount].id,
            package_id: (globalIndex % 999) + 1,
            status: statuses[globalIndex % 3],
            provider: providers[globalIndex % 5],
            // notes field doesn't exist in schema - using provider for test data variation
            created_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
            updated_at: new Date(),
            retrieved_timestamp: globalIndex % 3 > 0 ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) : null,
            pickup_staff_id: globalIndex % 3 > 0 ? staff.id : null
          }
        })
        
        await supabase
          .from('packages')
          .insert(batchPackages)
      }
      
      console.log('Testing query performance with large dataset...')
      
      // Test 1: Query waiting packages with pagination
      const startTime1 = performance.now()
      
      const { data: waitingPackages, error: error1 } = await supabase
        .from('packages')
        .select('*, residents!inner(*)')
        .eq('mailroom_id', mailroom.id)
        .eq('status', 'WAITING')
        .order('created_at', { ascending: false })
        .limit(50)
      
      const queryTime1 = performance.now() - startTime1
      
      expect(error1).toBeNull()
      expect(waitingPackages).toBeDefined()
      expect(queryTime1).toBeLessThan(1000) // Should complete within 1 second
      console.log(`Waiting packages query time: ${queryTime1.toFixed(2)}ms`)
      
      // Test 2: Search by resident name
      const startTime2 = performance.now()
      
      const { data: searchResults, error: error2 } = await supabase
        .from('packages')
        .select('*, residents!inner(*)')
        .eq('mailroom_id', mailroom.id)
        .ilike('residents.last_name', 'User5%')
        .limit(20)
      
      const queryTime2 = performance.now() - startTime2
      
      expect(error2).toBeNull()
      expect(searchResults).toBeDefined()
      expect(queryTime2).toBeLessThan(1000)
      console.log(`Name search query time: ${queryTime2.toFixed(2)}ms`)
      
      // Test 3: Date range query
      const startTime3 = performance.now()
      
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const { data: recentPackages, error: error3 } = await supabase
        .from('packages')
        .select('*')
        .eq('mailroom_id', mailroom.id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(100)
      
      const queryTime3 = performance.now() - startTime3
      
      expect(error3).toBeNull()
      expect(recentPackages).toBeDefined()
      expect(queryTime3).toBeLessThan(1000)
      console.log(`Date range query time: ${queryTime3.toFixed(2)}ms`)
      
      // Test 4: Aggregate query
      const startTime4 = performance.now()
      
      const { count, error: error4 } = await supabase
        .from('packages')
        .select('*', { count: 'exact', head: true })
        .eq('mailroom_id', mailroom.id)
        .eq('status', 'WAITING')
      
      const queryTime4 = performance.now() - startTime4
      
      expect(error4).toBeNull()
      expect(count).toBeGreaterThan(0)
      expect(queryTime4).toBeLessThan(500) // Count should be fast
      console.log(`Count query time: ${queryTime4.toFixed(2)}ms`)
    }, 180000) // 3 minute timeout for large dataset test
    
    it('should handle complex joins efficiently', async () => {
      const supabase = dbHelper.getClient()
      
      // Complex query with multiple joins
      const startTime = performance.now()
      
      const { data, error } = await supabase
        .from('packages')
        .select(`
          *,
          residents!inner(
            id,
            first_name,
            last_name,
            email,
            student_id
          ),
          profiles!pickup_staff_id(
            id,
            email,
            first_name,
            last_name
          ),
          mailrooms!inner(
            id,
            name,
            organizations!inner(
              id,
              name
            )
          )
        `)
        .eq('mailroom_id', mailroom.id)
        .eq('status', 'RETRIEVED')
        .order('retrieved_timestamp', { ascending: false })
        .limit(50)
      
      const queryTime = performance.now() - startTime
      
      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(queryTime).toBeLessThan(2000) // 2 seconds for complex join
      console.log(`Complex join query time: ${queryTime.toFixed(2)}ms`)
    })
  })
  
  describe('Index Performance Validation', () => {
    it('should utilize indexes for common query patterns', async () => {
      const supabase = dbHelper.getClient()
      
      // Test index on mailroom_id + status
      const startTime1 = performance.now()
      
      const { data: indexedQuery1 } = await supabase
        .from('packages')
        .select('id, package_id, status')
        .eq('mailroom_id', mailroom.id)
        .eq('status', 'WAITING')
      
      const indexTime1 = performance.now() - startTime1
      
      // Test index on resident_id
      const startTime2 = performance.now()
      
      const { data: someResidents } = await supabase
        .from('residents')
        .select('id')
        .eq('mailroom_id', mailroom.id)
        .limit(1)
      
      if (someResidents && someResidents.length > 0) {
        const { data: indexedQuery2 } = await supabase
          .from('packages')
          .select('*')
          .eq('resident_id', someResidents[0].id)
        
        const indexTime2 = performance.now() - startTime2
        
        expect(indexTime2).toBeLessThan(100) // Should be very fast with index
        console.log(`Resident lookup query time: ${indexTime2.toFixed(2)}ms`)
      }
      
      // Test index on created_at
      const startTime3 = performance.now()
      
      const { data: indexedQuery3 } = await supabase
        .from('packages')
        .select('id, created_at')
        .eq('mailroom_id', mailroom.id)
        .order('created_at', { ascending: false })
        .limit(100)
      
      const indexTime3 = performance.now() - startTime3
      
      expect(indexTime3).toBeLessThan(200)
      console.log(`Created_at index query time: ${indexTime3.toFixed(2)}ms`)
    })
  })
  
  describe('Write Performance Under Load', () => {
    it('should handle rapid package creation', async () => {
      // Create residents for testing
      const residents = await Promise.all(
        Array.from({ length: 50 }, (_, i) => 
          dbHelper.createTestResident(mailroom.id, `LoadTest${i}`, `loadtest${i}@perf.edu`)
        )
      )
      
      // Measure time to create 100 packages
      const startTime = performance.now()
      
      const packagePromises = []
      for (let i = 0; i < 100; i++) {
        packagePromises.push(
          dbHelper.createTestPackage(mailroom.id, residents[i % 50].id, staff.profile.id)
            .then(async pkg => {
              // Update with provider after creation
              const supabase = dbHelper.getClient()
              await supabase.from('packages').update({ provider: 'LoadTest Express' }).eq('id', pkg.id)
              return pkg
            })
        )
      }
      
      const packages = await Promise.all(packagePromises)
      const totalTime = performance.now() - startTime
      
      expect(packages.every(p => p.id)).toBe(true)
      expect(totalTime).toBeLessThan(10000) // 100 packages in under 10 seconds
      
      const avgTime = totalTime / 100
      console.log(`Average package creation time: ${avgTime.toFixed(2)}ms`)
      console.log(`Total time for 100 packages: ${totalTime.toFixed(2)}ms`)
    })
    
    it('should handle rapid status updates', async () => {
      // Create packages to update
      const residents = await Promise.all(
        Array.from({ length: 20 }, () => dbHelper.createTestResident(mailroom.id))
      )
      
      const packages = await Promise.all(
        residents.map(r => dbHelper.createTestPackage(mailroom.id, r.id, staff.profile.id))
      )
      
      // Measure time to update all packages
      const startTime = performance.now()
      
      const updatePromises = packages.map(pkg =>
        dbHelper.updatePackageStatus(pkg.id, 'RETRIEVED')
      )
      
      await Promise.all(updatePromises)
      const totalTime = performance.now() - startTime
      
      expect(totalTime).toBeLessThan(5000) // 20 updates in under 5 seconds
      
      const avgTime = totalTime / packages.length
      console.log(`Average status update time: ${avgTime.toFixed(2)}ms`)
    })
  })
  
  describe('Memory Efficiency', () => {
    it('should handle large result sets without memory issues', async () => {
      const supabase = dbHelper.getClient()
      
      // Get initial memory usage
      const initialMemory = process.memoryUsage().heapUsed
      
      // Query large dataset
      const { data: largeDataset, error } = await supabase
        .from('packages')
        .select('*')
        .eq('mailroom_id', mailroom.id)
        .limit(5000)
      
      expect(error).toBeNull()
      expect(largeDataset).toBeDefined()
      
      // Check memory usage after query
      const afterQueryMemory = process.memoryUsage().heapUsed
      const memoryIncrease = (afterQueryMemory - initialMemory) / 1024 / 1024
      
      console.log(`Memory increase for 5000 records: ${memoryIncrease.toFixed(2)}MB`)
      
      // Memory increase should be reasonable (less than 100MB for 5000 records)
      expect(memoryIncrease).toBeLessThan(100)
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc()
        const afterGCMemory = process.memoryUsage().heapUsed
        const retainedMemory = (afterGCMemory - initialMemory) / 1024 / 1024
        console.log(`Retained memory after GC: ${retainedMemory.toFixed(2)}MB`)
      }
    })
  })
  
  describe('Connection Pool Performance', () => {
    it('should handle concurrent database connections efficiently', async () => {
      const supabase = dbHelper.getClient()
      
      // Create 50 concurrent queries
      const concurrentQueries = 50
      const queries = Array.from({ length: concurrentQueries }, (_, i) => ({
        id: i,
        promise: supabase
          .from('packages')
          .select('*')
          .eq('mailroom_id', mailroom.id)
          .eq('status', ['WAITING', 'RETRIEVED', 'RESOLVED'][i % 3])
          .limit(10)
      }))
      
      const startTime = performance.now()
      
      const results = await Promise.all(queries.map(q => q.promise))
      
      const totalTime = performance.now() - startTime
      const avgTime = totalTime / concurrentQueries
      
      expect(results.every(r => r.data)).toBe(true)
      expect(totalTime).toBeLessThan(5000) // 50 queries in under 5 seconds
      
      console.log(`Total time for ${concurrentQueries} concurrent queries: ${totalTime.toFixed(2)}ms`)
      console.log(`Average query time: ${avgTime.toFixed(2)}ms`)
    })
  })
  
  describe('Database Maintenance Performance', () => {
    it('should handle cleanup operations efficiently', async () => {
      const supabase = dbHelper.getClient()
      
      // Create old packages to clean up
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
      
      // First, create some old resolved packages
      const oldResidents = await Promise.all(
        Array.from({ length: 100 }, (_, i) => dbHelper.createTestResident(mailroom.id, `OldResident${i}`, `old${i}@perf.edu`))
      )
      
      // Insert old packages directly for faster setup
      const oldPackages = Array.from({ length: 100 }, (_, i) => ({
        mailroom_id: mailroom.id,
        resident_id: oldResidents[i].id,
        package_id: (i % 999) + 1,
        status: 'RESOLVED',
        provider: 'Old Provider',
        created_at: sixMonthsAgo,
        updated_at: sixMonthsAgo,
        retrieved_timestamp: sixMonthsAgo,
        pickup_staff_id: staff.profile.id
      }))
      
      await supabase.from('packages').insert(oldPackages)
      
      // Measure cleanup query performance
      const startTime = performance.now()
      
      // Simulate archival query (finding old resolved packages)
      const { data: packagesToArchive, count } = await supabase
        .from('packages')
        .select('*', { count: 'exact' })
        .eq('mailroom_id', mailroom.id)
        .eq('status', 'RESOLVED')
        .lt('retrieved_timestamp', sixMonthsAgo.toISOString())
      
      const queryTime = performance.now() - startTime
      
      expect(queryTime).toBeLessThan(1000)
      console.log(`Archive query found ${count} packages in ${queryTime.toFixed(2)}ms`)
      
      // Measure bulk update performance
      if (packagesToArchive && packagesToArchive.length > 0) {
        const updateStartTime = performance.now()
        
        // Simulate marking packages as archived
        const { error } = await supabase
          .from('packages')
          .update({ status: 'STAFF_RESOLVED' })
          .in('id', packagesToArchive.map(p => p.id))
        
        const updateTime = performance.now() - updateStartTime
        
        expect(error).toBeNull()
        expect(updateTime).toBeLessThan(5000)
        console.log(`Bulk update of ${packagesToArchive.length} packages took ${updateTime.toFixed(2)}ms`)
      }
    })
  })
  
  describe('Real-world Scenario Performance', () => {
    it('should handle typical daily operations efficiently', async () => {
      const operationTimes: Record<string, number[]> = {
        packageCreation: [],
        residentSearch: [],
        packagePickup: [],
        statusCheck: []
      }
      
      // Simulate a day's worth of operations
      console.log('Simulating daily operations...')
      
      // Morning: Staff creates many packages
      for (let i = 0; i < 50; i++) {
        const resident = await dbHelper.createTestResident(mailroom.id, `DailyResident${i}`, `daily${i}@perf.edu`)
        
        const startTime = performance.now()
        await dbHelper.createTestPackage(mailroom.id, resident.id, staff.profile.id)
        operationTimes.packageCreation.push(performance.now() - startTime)
      }
      
      // Throughout day: Search operations
      const supabase = dbHelper.getClient()
      for (let i = 0; i < 100; i++) {
        const startTime = performance.now()
        await supabase
          .from('packages')
          .select('*, residents!inner(*)')
          .eq('mailroom_id', mailroom.id)
          .ilike('residents.last_name', `User${i % 10}%`)
          .limit(10)
        operationTimes.residentSearch.push(performance.now() - startTime)
      }
      
      // Afternoon: Package pickups
      const { data: waitingPackages } = await supabase
        .from('packages')
        .select('*')
        .eq('mailroom_id', mailroom.id)
        .eq('status', 'WAITING')
        .limit(30)
      
      if (waitingPackages) {
        for (const pkg of waitingPackages) {
          const startTime = performance.now()
          await dbHelper.updatePackageStatus(pkg.id, 'RETRIEVED')
          operationTimes.packagePickup.push(performance.now() - startTime)
        }
      }
      
      // End of day: Status checks
      for (let i = 0; i < 20; i++) {
        const startTime = performance.now()
        const { count } = await supabase
          .from('packages')
          .select('*', { count: 'exact', head: true })
          .eq('mailroom_id', mailroom.id)
          .eq('status', 'WAITING')
        operationTimes.statusCheck.push(performance.now() - startTime)
      }
      
      // Calculate and display statistics
      Object.entries(operationTimes).forEach(([operation, times]) => {
        if (times.length > 0) {
          const avg = times.reduce((a, b) => a + b, 0) / times.length
          const max = Math.max(...times)
          const min = Math.min(...times)
          
          console.log(`\n${operation}:`)
          console.log(`  Average: ${avg.toFixed(2)}ms`)
          console.log(`  Min: ${min.toFixed(2)}ms`)
          console.log(`  Max: ${max.toFixed(2)}ms`)
          
          // All operations should average under 500ms
          expect(avg).toBeLessThan(500)
        }
      })
    }, 240000) // 4 minute timeout for comprehensive daily operations test
  })
})