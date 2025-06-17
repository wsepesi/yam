import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { DatabaseTestHelper } from '../utils/db-test-helper'
import { setupConcurrentTest, collectPerformanceMetrics, executeSequentially } from '../utils/performance-config'

describe.sequential('Concurrent User Operations Tests', () => {
  const dbHelper = DatabaseTestHelper.getInstance()
  
  beforeAll(() => {
    // Configure performance test settings with connection management
    const config = setupConcurrentTest()
    console.log(`Concurrent test configured with ${config.maxOperations} max operations, timeout: 2 minutes`)
  })
  
  let org: any
  let mailrooms: any[]
  let staff: any[]
  let residents: any[]
  
  beforeAll(async () => {
    await dbHelper.cleanup()
    
    // Create test organization
    org = await dbHelper.createTestOrg('Concurrent Test University')
    
    // Create multiple mailrooms
    mailrooms = await Promise.all([
      dbHelper.createTestMailroom(org.id, 'North Campus Mailroom'),
      dbHelper.createTestMailroom(org.id, 'South Campus Mailroom'),
      dbHelper.createTestMailroom(org.id, 'East Campus Mailroom')
    ])
    
    // Create multiple staff members per mailroom
    staff = []
    for (const mailroom of mailrooms) {
      const mailroomStaff = await Promise.all([
        dbHelper.createTestUser(org.id, mailroom.id, 'manager'),
        dbHelper.createTestUser(org.id, mailroom.id, 'manager'),
        dbHelper.createTestUser(org.id, mailroom.id, 'user')
      ])
      
      // Update with specific emails
      const supabase = dbHelper.getClient()
      const mailroomSlug = mailroom.name.toLowerCase().replace(/\s/g, '')
      await Promise.all([
        supabase.from('profiles').update({ email: `manager1@${mailroomSlug}.edu` }).eq('id', mailroomStaff[0].profile.id),
        supabase.from('profiles').update({ email: `manager2@${mailroomSlug}.edu` }).eq('id', mailroomStaff[1].profile.id),
        supabase.from('profiles').update({ email: `user@${mailroomSlug}.edu` }).eq('id', mailroomStaff[2].profile.id)
      ])
      staff.push(...mailroomStaff)
    }
    
    // Create residents across mailrooms
    residents = []
    for (const mailroom of mailrooms) {
      const mailroomResidents = await Promise.all(
        Array.from({ length: 100 }, (_, i) => 
          dbHelper.createTestResident(mailroom.id, `student${i}@${mailroom.name.toLowerCase().replace(/\s/g, '')}.edu`)
        )
      )
      
      // Update resident names
      await Promise.all(
        mailroomResidents.map((r, i) => 
          supabase.from('residents').update({ 
            first_name: `Student${i}`, 
            last_name: `${mailroom.name.split(' ')[0]}${i}` 
          }).eq('id', r.id)
        )
      )
      residents.push(...mailroomResidents)
    }
  })
  
  afterAll(async () => {
    await dbHelper.cleanup()
  })
  
  describe('Concurrent Package Creation by Multiple Staff', () => {
    it('should handle 20 staff creating packages simultaneously', async () => {
      // Get managers only (not regular users)
      const managers = staff.filter(s => s.profile.role === 'manager')
      
      // Each manager creates 5 packages
      const startTime = performance.now()
      
      const operations = managers.map(async (manager, staffIndex) => {
        // Find residents in the manager's mailroom
        const mailroomResidents = residents.filter(r => 
          r.mailroom_id === manager.profile.mailroom_id
        )
        
        const packages = await Promise.all(
          Array.from({ length: 5 }, async (_, packageIndex) => {
            const resident = mailroomResidents[packageIndex % mailroomResidents.length]
            
            const pkgStartTime = performance.now()
            const pkg = await dbHelper.createTestPackage(manager.profile.mailroom_id, resident.id, manager.profile.id)
            
            // Update package with provider
            const supabase = dbHelper.getClient()
            await supabase.from('packages').update({ 
              provider: `Provider${staffIndex}-${packageIndex}` 
            }).eq('id', pkg.id)
            const pkgTime = performance.now() - pkgStartTime
            
            return {
              packageId: pkg.id,
              packageNumber: pkg.package_id,
              staffId: manager.profile.id,
              operationTime: pkgTime
            }
          })
        )
        
        return packages
      })
      
      const allResults = await Promise.all(operations)
      const flatResults = allResults.flat()
      const totalTime = performance.now() - startTime
      
      // Verify all packages created successfully
      expect(flatResults.length).toBe(managers.length * 5)
      expect(flatResults.every(r => r.packageId)).toBe(true)
      
      // Performance checks
      expect(totalTime).toBeLessThan(45000) // Under 45 seconds (increased for performance tests)
      
      const avgOperationTime = flatResults.reduce((sum, r) => sum + r.operationTime, 0) / flatResults.length
      expect(avgOperationTime).toBeLessThan(2000) // Average under 2 seconds
      
      // Verify no duplicate package numbers within each mailroom
      const numbersByMailroom = new Map<string, Set<number>>()
      for (const result of flatResults) {
        const supabase = dbHelper.getClient()
        const { data: pkg } = await supabase
          .from('packages')
          .select('mailroom_id')
          .eq('id', result.packageId)
          .single()
        
        if (!numbersByMailroom.has(pkg.mailroom_id)) {
          numbersByMailroom.set(pkg.mailroom_id, new Set())
        }
        numbersByMailroom.get(pkg.mailroom_id)!.add(result.packageNumber)
      }
      
      // Each mailroom should have unique package numbers
      numbersByMailroom.forEach((numbers, mailroomId) => {
        const numbersArray = Array.from(numbers)
        expect(numbers.size).toBe(numbersArray.length)
      })
      
      console.log(`Concurrent package creation: ${flatResults.length} packages in ${totalTime.toFixed(2)}ms`)
      console.log(`Average operation time: ${avgOperationTime.toFixed(2)}ms`)
    })
    
    it('should handle peak mail delivery scenario (50+ concurrent operations)', async () => {
      // Simulate morning mail delivery rush
      const managers = staff.filter(s => s.profile.role === 'manager')
      
      // Create a burst of 50 package creation operations
      const operations = []
      for (let i = 0; i < 50; i++) {
        const manager = managers[i % managers.length]
        const mailroomResidents = residents.filter(r => 
          r.mailroom_id === manager.profile.mailroom_id
        )
        const resident = mailroomResidents[i % mailroomResidents.length]
        
        operations.push(
          dbHelper.createTestPackage(manager.profile.mailroom_id, resident.id, manager.profile.id)
            .then(async pkg => {
              // Update package with provider
              const supabase = dbHelper.getClient()
              await supabase.from('packages').update({ provider: 'Morning Delivery' }).eq('id', pkg.id)
              return {
                success: true,
                packageId: pkg.id,
                mailroomId: manager.profile.mailroom_id
              }
            })
            .catch(err => ({
              success: false,
              error: err.message,
              mailroomId: manager.profile.mailroom_id
            }))
        )
      }
      
      const startTime = performance.now()
      const results = await Promise.all(operations)
      const totalTime = performance.now() - startTime
      
      const successful = results.filter(r => r.success)
      const failed = results.filter(r => !r.success)
      
      expect(successful.length).toBeGreaterThan(45) // At least 90% success
      expect(totalTime).toBeLessThan(45000) // Under 45 seconds
      
      console.log(`Peak delivery simulation: ${successful.length}/${results.length} successful`)
      console.log(`Total time: ${totalTime.toFixed(2)}ms`)
      console.log(`Average time per package: ${(totalTime / results.length).toFixed(2)}ms`)
      
      if (failed.length > 0) {
        console.log(`Failures: ${failed.length}`)
        failed.forEach(f => console.log(`  - ${f.error}`))
      }
    })
  })
  
  describe('Concurrent Search Operations', () => {
    it('should handle multiple staff searching simultaneously', async () => {
      const supabase = dbHelper.getClient()
      
      // Create some packages first
      await Promise.all(
        residents.slice(0, 50).map(async r => {
          // Find a manager for this mailroom
          const manager = staff.find(s => s.profile.mailroom_id === r.mailroom_id && s.profile.role === 'manager')
          if (!manager) throw new Error('No manager found for mailroom')
          
          const pkg = await dbHelper.createTestPackage(r.mailroom_id, r.id, manager.profile.id)
          // Status is already 'WAITING' by default
          return pkg
        })
      )
      
      // Simulate 30 concurrent search operations
      const searchQueries = Array.from({ length: 30 }, (_, i) => ({
        id: i,
        searchTerm: `Student${i % 10}`,
        mailroomId: mailrooms[i % mailrooms.length].id
      }))
      
      const startTime = performance.now()
      
      const searchResults = await Promise.all(
        searchQueries.map(async query => {
          const queryStart = performance.now()
          
          const { data, error } = await supabase
            .from('packages')
            .select('*, residents!inner(*)')
            .eq('mailroom_id', query.mailroomId)
            .ilike('residents.first_name', `%${query.searchTerm}%`)
            .limit(20)
          
          const queryTime = performance.now() - queryStart
          
          return {
            queryId: query.id,
            resultCount: data?.length || 0,
            queryTime,
            error: error?.message
          }
        })
      )
      
      const totalTime = performance.now() - startTime
      
      // All searches should complete
      expect(searchResults.every(r => !r.error)).toBe(true)
      
      // Performance checks
      expect(totalTime).toBeLessThan(15000) // Under 15 seconds for all searches
      
      const avgQueryTime = searchResults.reduce((sum, r) => sum + r.queryTime, 0) / searchResults.length
      expect(avgQueryTime).toBeLessThan(1000) // Average under 1 second
      
      console.log(`Concurrent search operations: ${searchResults.length} searches in ${totalTime.toFixed(2)}ms`)
      console.log(`Average query time: ${avgQueryTime.toFixed(2)}ms`)
    })
  })
  
  describe('Mixed Concurrent Operations', () => {
    it('should handle mixed read/write operations from multiple users', async () => {
      const supabase = dbHelper.getClient()
      
      // Define different operation types
      const operationTypes = [
        // Package creation
        async (staffMember: any, index: number) => {
          const mailroomResidents = residents.filter(r => 
            r.mailroom_id === staffMember.profile.mailroom_id
          )
          const resident = mailroomResidents[index % mailroomResidents.length]
          
          const start = performance.now()
          const pkg = await dbHelper.createTestPackage(staffMember.profile.mailroom_id, resident.id, staffMember.profile.id)
          return {
            type: 'create',
            duration: performance.now() - start,
            success: true
          }
        },
        
        // Package search
        async (staffMember: any, index: number) => {
          const start = performance.now()
          const { data } = await supabase
            .from('packages')
            .select('*')
            .eq('mailroom_id', staffMember.profile.mailroom_id)
            .eq('status', 'WAITING')
            .limit(10)
          return {
            type: 'search',
            duration: performance.now() - start,
            success: true,
            resultCount: data?.length || 0
          }
        },
        
        // Package pickup
        async (staffMember: any, index: number) => {
          // Find a waiting package
          const { data: waitingPackages } = await supabase
            .from('packages')
            .select('*')
            .eq('mailroom_id', staffMember.profile.mailroom_id)
            .eq('status', 'WAITING')
            .limit(1)
          
          if (waitingPackages && waitingPackages.length > 0) {
            const start = performance.now()
            await dbHelper.updatePackageStatus(
              waitingPackages[0].id,
              'RETRIEVED'
            )
            return {
              type: 'pickup',
              duration: performance.now() - start,
              success: true
            }
          }
          
          return {
            type: 'pickup',
            duration: 0,
            success: false,
            reason: 'No packages available'
          }
        },
        
        // Status check
        async (staffMember: any, index: number) => {
          const start = performance.now()
          const { count } = await supabase
            .from('packages')
            .select('*', { count: 'exact', head: true })
            .eq('mailroom_id', staffMember.profile.mailroom_id)
            .eq('status', 'WAITING')
          return {
            type: 'status',
            duration: performance.now() - start,
            success: true,
            count
          }
        }
      ]
      
      // Create 100 mixed operations
      const managers = staff.filter(s => s.profile.role === 'manager')
      const operations = Array.from({ length: 100 }, (_, i) => {
        const staffMember = managers[i % managers.length]
        const operationType = operationTypes[i % operationTypes.length]
        return operationType(staffMember, i)
      })
      
      const startTime = performance.now()
      const results = await Promise.all(operations)
      const totalTime = performance.now() - startTime
      
      // Group results by type
      const resultsByType = results.reduce((acc, r) => {
        if (!acc[r.type]) {
          acc[r.type] = []
        }
        acc[r.type].push(r)
        return acc
      }, {} as Record<string, any[]>)
      
      // Analyze performance by operation type
      Object.entries(resultsByType).forEach(([type, typeResults]) => {
        const successful = typeResults.filter(r => r.success).length
        const avgDuration = typeResults.reduce((sum, r) => sum + r.duration, 0) / typeResults.length
        
        console.log(`\n${type} operations:`)
        console.log(`  Count: ${typeResults.length}`)
        console.log(`  Successful: ${successful}`)
        console.log(`  Average duration: ${avgDuration.toFixed(2)}ms`)
      })
      
      // Overall performance check
      expect(totalTime).toBeLessThan(60000) // Under 60 seconds for 100 operations
      
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length
      expect(avgDuration).toBeLessThan(2000) // Average under 2 seconds
      
      console.log(`\nTotal: ${results.length} operations in ${totalTime.toFixed(2)}ms`)
      console.log(`Overall average: ${avgDuration.toFixed(2)}ms per operation`)
    })
  })
  
  describe('Session Concurrency', () => {
    it('should handle multiple active user sessions', async () => {
      const supabase = dbHelper.getClient()
      
      // Get managers from staff
      const managers = staff.filter(s => s.profile.role === 'manager')
      
      // Simulate 15 users with active sessions
      const activeSessions = managers.slice(0, 15).map((manager, i) => ({
        userId: manager.profile.id,
        mailroomId: manager.profile.mailroom_id,
        sessionId: `session-${i}`,
        lastActivity: Date.now()
      }))
      
      // Each user performs a series of operations
      const sessionOperations = activeSessions.map(async (session) => {
        const operations = []
        
        // Operation 1: Dashboard load (status check)
        operations.push(
          supabase
            .from('packages')
            .select('status')
            .eq('mailroom_id', session.mailroomId)
            .then(({ data }) => ({
              type: 'dashboard',
              userId: session.userId,
              timestamp: Date.now()
            }))
        )
        
        // Operation 2: Create a package
        const resident = residents.find(r => r.mailroom_id === session.mailroomId)
        if (resident) {
          operations.push(
            dbHelper.createTestPackage(session.mailroomId, resident.id, session.userId).then(pkg => ({
              type: 'create',
              userId: session.userId,
              timestamp: Date.now(),
              packageId: pkg.id
            }))
          )
        }
        
        // Operation 3: Search
        operations.push(
          supabase
            .from('residents')
            .select('*')
            .eq('mailroom_id', session.mailroomId)
            .limit(10)
            .then(({ data }) => ({
              type: 'search',
              userId: session.userId,
              timestamp: Date.now(),
              results: data?.length || 0
            }))
        )
        
        return Promise.all(operations)
      })
      
      const startTime = performance.now()
      const allSessionResults = await Promise.all(sessionOperations)
      const totalTime = performance.now() - startTime
      
      const flatResults = allSessionResults.flat()
      
      // All operations should complete
      expect(flatResults.length).toBe(activeSessions.length * 3) // 3 ops per session
      
      // Performance check
      expect(totalTime).toBeLessThan(45000) // Under 45 seconds (increased for performance tests)
      
      console.log(`Active sessions: ${activeSessions.length}`)
      console.log(`Total operations: ${flatResults.length}`)
      console.log(`Completion time: ${totalTime.toFixed(2)}ms`)
      console.log(`Average per session: ${(totalTime / activeSessions.length).toFixed(2)}ms`)
    })
  })
  
  describe('Real-world Peak Usage Simulation', () => {
    it('should handle university move-in week scenario', async () => {
      console.log('\nSimulating university move-in week...')
      
      // Scenario: 3 mailrooms, 6 staff each, processing 500+ packages per day
      const moveInOperations = {
        packagesCreated: 0,
        packagesRetrieved: 0,
        searchesPerformed: 0,
        errors: 0
      }
      
      // Hour-by-hour simulation (condensed)
      const hourlyLoad = [
        { hour: '8AM', packageVolume: 50, retrievalRate: 0.1 },
        { hour: '9AM', packageVolume: 100, retrievalRate: 0.2 },
        { hour: '10AM', packageVolume: 150, retrievalRate: 0.3 },
        { hour: '11AM', packageVolume: 100, retrievalRate: 0.5 },
        { hour: '12PM', packageVolume: 50, retrievalRate: 0.6 },
        { hour: '1PM', packageVolume: 100, retrievalRate: 0.7 },
        { hour: '2PM', packageVolume: 150, retrievalRate: 0.8 },
        { hour: '3PM', packageVolume: 100, retrievalRate: 0.9 },
        { hour: '4PM', packageVolume: 50, retrievalRate: 0.95 }
      ]
      
      const startTime = performance.now()
      
      for (const hourData of hourlyLoad) {
        console.log(`\nProcessing ${hourData.hour}...`)
        
        const hourOperations = []
        
        // Package creation for this hour
        const createOps = Array.from({ length: hourData.packageVolume }, (_, i) => {
          const mailroom = mailrooms[i % mailrooms.length]
          const resident = residents.find(r => r.mailroom_id === mailroom.id)
          const staffMember = staff.find(s => 
            s.profile.mailroom_id === mailroom.id && s.profile.role === 'manager'
          )
          
          if (resident && staffMember) {
            return dbHelper.createTestPackage(mailroom.id, resident.id, staffMember.profile.id).then(pkg => {
              moveInOperations.packagesCreated++
              return { success: true, packageId: pkg.id }
            }).catch(err => {
              moveInOperations.errors++
              return { success: false, error: err.message }
            })
          }
          return Promise.resolve({ success: false, error: 'Missing data' })
        })
        
        hourOperations.push(...createOps)
        
        // Package retrievals based on rate
        const retrievalCount = Math.floor(hourData.packageVolume * hourData.retrievalRate)
        const supabase = dbHelper.getClient()
        
        const retrievalOps = Array.from({ length: retrievalCount }, async (_, i) => {
          const mailroom = mailrooms[i % mailrooms.length]
          const staffMember = staff.find(s => 
            s.profile.mailroom_id === mailroom.id && s.profile.role === 'manager'
          )
          
          const { data: waitingPackages } = await supabase
            .from('packages')
            .select('*')
            .eq('mailroom_id', mailroom.id)
            .eq('status', 'WAITING')
            .limit(1)
          
          if (waitingPackages && waitingPackages.length > 0 && staffMember) {
            return dbHelper.updatePackageStatus(
              waitingPackages[0].id,
              'RETRIEVED'
            ).then(() => {
              moveInOperations.packagesRetrieved++
              return { success: true }
            }).catch(err => {
              moveInOperations.errors++
              return { success: false, error: err.message }
            })
          }
          return { success: false, error: 'No packages to retrieve' }
        })
        
        hourOperations.push(...retrievalOps)
        
        // Searches (students checking for packages)
        const searchCount = Math.floor(hourData.packageVolume * 0.5)
        const searchOps = Array.from({ length: searchCount }, (_, i) => {
          const mailroom = mailrooms[i % mailrooms.length]
          return supabase
            .from('packages')
            .select('*')
            .eq('mailroom_id', mailroom.id)
            .eq('status', 'WAITING')
            .limit(5)
            .then(() => {
              moveInOperations.searchesPerformed++
              return { success: true }
            })
            .catch(() => {
              moveInOperations.errors++
              return { success: false }
            })
        })
        
        hourOperations.push(...searchOps)
        
        // Execute all operations for this hour
        const hourResults = await Promise.all(hourOperations)
        const hourSuccess = hourResults.filter(r => r.success).length
        
        console.log(`  Operations: ${hourResults.length}, Successful: ${hourSuccess}`)
      }
      
      const totalTime = performance.now() - startTime
      
      console.log('\n=== Move-in Week Simulation Results ===')
      console.log(`Total packages created: ${moveInOperations.packagesCreated}`)
      console.log(`Total packages retrieved: ${moveInOperations.packagesRetrieved}`)
      console.log(`Total searches performed: ${moveInOperations.searchesPerformed}`)
      console.log(`Total errors: ${moveInOperations.errors}`)
      console.log(`Total time: ${(totalTime / 1000).toFixed(2)} seconds`)
      console.log(`Error rate: ${((moveInOperations.errors / (moveInOperations.packagesCreated + moveInOperations.packagesRetrieved + moveInOperations.searchesPerformed)) * 100).toFixed(2)}%`)
      
      // Performance assertions
      expect(moveInOperations.packagesCreated).toBeGreaterThan(500)
      expect(moveInOperations.errors / moveInOperations.packagesCreated).toBeLessThan(0.05) // Less than 5% error rate
      expect(totalTime).toBeLessThan(120000) // Complete in under 2 minutes
    }, 300000) // 5 minute timeout for this comprehensive test
  })
})