import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { DatabaseTestHelper } from '../utils/db-test-helper'
import { setupConcurrentTest, collectPerformanceMetrics } from '../utils/performance-config'

describe.sequential('Concurrent Package Operations Performance Tests', () => {
  const dbHelper = DatabaseTestHelper.getInstance()
  
  let org: any
  let mailroom: any
  let staff: any
  
  beforeAll(() => {
    // Configure concurrent package operations performance tests
    const config = setupConcurrentTest()
    console.log(`Concurrent package ops configured with ${config.maxOperations} max operations, timeout: 2 minutes`)
  })
  
  beforeAll(async () => {
    await dbHelper.cleanup()
    
    org = await dbHelper.createTestOrg('Concurrent Ops University')
    mailroom = await dbHelper.createTestMailroom(org.id)
    staff = await dbHelper.createTestUser(org.id, mailroom.id, 'manager')
  })
  
  afterAll(async () => {
    await dbHelper.cleanup()
  })
  
  describe('Package Number Assignment Race Conditions', () => {
    it('should handle 50 concurrent package creations without conflicts', async () => {
      // Create residents for testing
      const residents = await Promise.all(
        Array.from({ length: 50 }, (_, i) => 
          dbHelper.createTestResident(mailroom.id, `ConcurrentUser${i}`, `user${i}@concurrent.edu`)
        )
      )
      
      const startTime = performance.now()
      
      // Create packages concurrently
      const packagePromises = residents.map(resident =>
        dbHelper.createTestPackage(mailroom.id, resident.id, staff.profile.id)
      )
      
      const packages = await Promise.all(packagePromises)
      const totalTime = performance.now() - startTime
      
      // All packages should be created successfully
      expect(packages.every(pkg => pkg.id)).toBe(true)
      
      // No duplicate package numbers
      const packageNumbers = packages.map(pkg => pkg.package_id)
      const uniqueNumbers = new Set(packageNumbers)
      expect(uniqueNumbers.size).toBe(packageNumbers.length)
      
      // Performance check
      expect(totalTime).toBeLessThan(15000) // Under 15 seconds
      
      console.log(`50 concurrent package creations: ${totalTime.toFixed(2)}ms`)
      console.log(`Average creation time: ${(totalTime / 50).toFixed(2)}ms`)
    })
  })
  
  describe('Concurrent Pickup Operations', () => {
    it('should handle multiple staff picking up packages simultaneously', async () => {
      // Create test packages
      const residents = await Promise.all(
        Array.from({ length: 20 }, () => dbHelper.createTestResident(mailroom.id))
      )
      
      const packages = await Promise.all(
        residents.map(r => dbHelper.createTestPackage(mailroom.id, r.id, staff.profile.id))
      )
      
      const startTime = performance.now()
      
      // Concurrent pickups
      const pickupPromises = packages.map(pkg =>
        dbHelper.updatePackageStatus(pkg.id, 'RETRIEVED')
      )
      
      await Promise.all(pickupPromises)
      const totalTime = performance.now() - startTime
      
      // Verify all packages picked up
      const supabase = dbHelper.getClient()
      const { data: retrievedPackages } = await supabase
        .from('packages')
        .select('*')
        .in('id', packages.map(p => p.id))
        .eq('status', 'RETRIEVED')
      
      expect(retrievedPackages).toHaveLength(20)
      expect(totalTime).toBeLessThan(10000)
      
      console.log(`20 concurrent pickups: ${totalTime.toFixed(2)}ms`)
    })
  })
})