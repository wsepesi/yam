// Package Queue Stress Testing with Real Database
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest'
import { DatabaseTestHelper } from '../utils/db-test-helper'
import { getSharedAdminInstance } from '../setup'
import { server } from '../mocks/server'
import { http } from 'msw'

describe('Package Queue Under Load', () => {
  let dbHelper: DatabaseTestHelper
  let supabase: any
  let testOrg: any
  let testMailroom: any
  let testUser: any
  let testResidents: any[]
  
  beforeAll(() => {
    process.env.USE_REAL_DB = 'true'
    
    // Disable MSW for real database tests to prevent request interception
    server.close()
    
    supabase = getSharedAdminInstance()
    dbHelper = DatabaseTestHelper.getInstance()
  })
  
  beforeEach(async () => {
    // Setup test environment
    testOrg = await dbHelper.createTestOrg('Queue Test Org')
    testMailroom = await dbHelper.createTestMailroom(testOrg.id, 'Queue Test Mailroom')
    testUser = await dbHelper.createTestUser(testOrg.id, testMailroom.id, 'user')
    // Create multiple residents for testing
    testResidents = await dbHelper.createTestResidents(testMailroom.id, 5)
  })
  
  afterEach(async () => {
    await dbHelper.cleanup()
  })
  
  it('should handle 50 concurrent package creations without duplicates', async () => {
    const startTime = performance.now()
    
    // Create 50 concurrent package number requests
    const promises = Array.from({ length: 50 }, () => 
      supabase.rpc('get_next_package_number', { p_mailroom_id: testMailroom.id })
    )
    
    const results = await Promise.all(promises)
    const endTime = performance.now()
    
    // Performance check
    const totalTime = endTime - startTime
    console.log(`50 concurrent package number assignments took ${totalTime.toFixed(2)}ms`)
    expect(totalTime).toBeLessThan(5000) // Should complete within 5 seconds
    
    const packageNumbers = results.map(r => r.data).filter(Boolean)
    
    // Verify all requests succeeded
    results.forEach((result, index) => {
      if (result.error) {
        console.error(`Request ${index} failed:`, result.error)
      }
      expect(result.error).toBeNull()
      expect(result.data).toBeDefined()
    })
    
    // Verify all numbers are unique (critical for concurrent safety)
    const uniqueNumbers = new Set(packageNumbers)
    expect(uniqueNumbers.size).toBe(packageNumbers.length)
    expect(uniqueNumbers.size).toBe(50)
    
    // Verify all numbers are in valid range
    packageNumbers.forEach(num => {
      expect(num).toBeGreaterThan(0)
      expect(num).toBeLessThanOrEqual(999)
    })
    
    // Check queue status
    const queueStatus = await dbHelper.getPackageQueueStatus(testMailroom.id)
    expect(queueStatus.inUse).toBe(50)
    expect(queueStatus.available).toBe(949)
  })
  
  it('should handle queue exhaustion gracefully', async () => {
    // This is a stress test - we'll create many packages but not exhaust all 999
    // Creating 999 packages would be too slow for a regular test run
    const TARGET_PACKAGES = 100
    
    console.log(`Creating ${TARGET_PACKAGES} packages to test queue behavior...`)
    
    const batchSize = 10
    const batches = Math.ceil(TARGET_PACKAGES / batchSize)
    let allPackageNumbers: number[] = []
    
    for (let batch = 0; batch < batches; batch++) {
      const promises = Array.from({ length: batchSize }, async () => {
        const { data: packageNumber, error } = await supabase.rpc('get_next_package_number', {
          p_mailroom_id: testMailroom.id
        })
        
        if (error) {
          console.error('Package number assignment error:', error)
          return null
        }
        
        // Actually create the package to keep the number in use
        const residentIndex = Math.floor(Math.random() * testResidents.length)
        const { error: createError } = await supabase.from('packages').insert({
          mailroom_id: testMailroom.id,
          resident_id: testResidents[residentIndex].id,
          staff_id: testUser.profile.id,
          package_id: packageNumber,
          provider: 'Test Provider',
          status: 'WAITING'
        })
        
        if (createError) {
          console.error('Package creation error:', createError)
          // Release the number if package creation failed
          await supabase.rpc('release_package_number', {
            p_mailroom_id: testMailroom.id,
            p_package_number: packageNumber
          })
          return null
        }
        
        return packageNumber
      })
      
      const batchResults = await Promise.all(promises)
      const validNumbers = batchResults.filter(n => n !== null)
      allPackageNumbers.push(...validNumbers)
      
      console.log(`Batch ${batch + 1}/${batches} completed: ${validNumbers.length} packages created`)
    }
    
    // Verify uniqueness across all batches
    const uniqueNumbers = new Set(allPackageNumbers)
    expect(uniqueNumbers.size).toBe(allPackageNumbers.length)
    
    // Check final queue status
    const finalStatus = await dbHelper.getPackageQueueStatus(testMailroom.id)
    expect(finalStatus.inUse).toBe(allPackageNumbers.length)
    expect(finalStatus.available).toBe(999 - allPackageNumbers.length)
    
    console.log(`Final queue status: ${finalStatus.inUse} in use, ${finalStatus.available} available`)
    
    // Test releasing and reusing numbers
    const numbersToRelease = allPackageNumbers.slice(0, 5)
    
    for (const num of numbersToRelease) {
      const { error } = await supabase.rpc('release_package_number', {
        p_mailroom_id: testMailroom.id,
        p_package_number: num
      })
      expect(error).toBeNull()
    }
    
    // Verify numbers are available for reuse
    const afterReleaseStatus = await dbHelper.getPackageQueueStatus(testMailroom.id)
    expect(afterReleaseStatus.available).toBe(999 - allPackageNumbers.length + 5)
  })
  
  it('should maintain data integrity under concurrent updates', async () => {
    // Create 10 packages
    const packages = []
    for (let i = 0; i < 10; i++) {
      const pkg = await dbHelper.createTestPackage(
        testMailroom.id,
        testResidents[i % testResidents.length].id,
        testUser.profile.id
      )
      packages.push(pkg)
    }
    
    // Simulate concurrent status updates
    const updatePromises = packages.map(async (pkg, index) => {
      // Add small random delay to simulate real-world timing
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100))
      
      // Half go to RETRIEVED, half go to FAILED
      const newStatus = index % 2 === 0 ? 'RETRIEVED' : 'RESOLVED'
      
      const { data, error } = await supabase.from('packages')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString(),
          ...(newStatus === 'RETRIEVED' ? { retrieved_timestamp: new Date().toISOString() } : {}),
          ...(newStatus === 'RESOLVED' ? { resolved_timestamp: new Date().toISOString() } : {})
        })
        .eq('id', pkg.id)
        .select()
        .single()
      
      return { data, error, expectedStatus: newStatus }
    })
    
    const results = await Promise.all(updatePromises)
    
    // Verify all updates succeeded
    results.forEach(result => {
      expect(result.error).toBeNull()
      expect(result.data.status).toBe(result.expectedStatus)
    })
    
    // Verify final state consistency
    const { data: finalPackages } = await supabase
      .from('packages')
      .select('*')
      .eq('mailroom_id', testMailroom.id)
      .order('created_at')
    
    expect(finalPackages.length).toBe(10)
    
    const statusCounts = finalPackages.reduce((acc, pkg) => {
      acc[pkg.status] = (acc[pkg.status] || 0) + 1
      return acc
    }, {})
    
    expect(statusCounts['RETRIEVED']).toBe(5)
    expect(statusCounts['RESOLVED']).toBe(5)
  })
  
  it('should handle queue fragmentation and recovery', async () => {
    // Create packages with specific numbers to fragment the queue
    const targetNumbers = [1, 5, 10, 15, 20, 25, 30]
    
    // First, get these specific numbers by creating and releasing until we get them
    for (const targetNum of targetNumbers) {
      let gotTarget = false
      let attempts = 0
      const tempNumbers = []
      
      while (!gotTarget && attempts < 50) {
        const { data: num } = await supabase.rpc('get_next_package_number', {
          p_mailroom_id: testMailroom.id
        })
        
        if (num === targetNum) {
          // Create package with target number
          await dbHelper.createTestPackage(testMailroom.id, testResidents[0].id, testUser.profile.id)
          gotTarget = true
        } else {
          // Store for later release
          tempNumbers.push(num)
        }
        attempts++
      }
      
      // Release all temporary numbers
      for (const num of tempNumbers) {
        await supabase.rpc('release_package_number', {
          p_mailroom_id: testMailroom.id,
          p_package_number: num
        })
      }
    }
    
    // Now we have a fragmented queue
    const beforeStatus = await dbHelper.getPackageQueueStatus(testMailroom.id)
    console.log(`Fragmented queue: ${beforeStatus.inUse} numbers in use`)
    
    // Get new numbers and verify they fill gaps efficiently
    const newNumbers = []
    for (let i = 0; i < 10; i++) {
      const { data: num } = await supabase.rpc('get_next_package_number', {
        p_mailroom_id: testMailroom.id
      })
      newNumbers.push(num)
    }
    
    // Verify numbers are being assigned efficiently (should get low numbers first)
    const sortedNewNumbers = [...newNumbers].sort((a, b) => a - b)
    console.log('New numbers assigned:', sortedNewNumbers)
    
    // Most of the new numbers should be in the gaps we created
    const gapFillers = sortedNewNumbers.filter(n => n < 35)
    expect(gapFillers.length).toBeGreaterThan(5)
  })
})