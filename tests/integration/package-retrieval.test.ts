import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DatabaseTestHelper } from '../utils/db-test-helper'
import { createMocks } from 'node-mocks-http'
import removePackageHandler from '../../pages/api/remove-package'
import logPackageHandler from '../../pages/api/log-package'
import getRetrievedHandler from '../../pages/api/get-retrieved'

describe('Package Retrieval Workflow Integration Tests', () => {
  const dbHelper = DatabaseTestHelper.getInstance()
  
  let org: any
  let mailroom: any
  let staff: any
  let resident: any
  let package: any
  
  beforeEach(async () => {
    await dbHelper.cleanup()
    
    // Create test organization and mailroom
    org = await dbHelper.createTestOrg('Test University')
    mailroom = await dbHelper.createTestMailroom(org.id)
    
    // Create staff member
    staff = await dbHelper.createTestUser(org.id, mailroom.id, 'manager')
    
    // Create resident
    resident = await dbHelper.createTestResident(mailroom.id, 'john.doe@university.edu')
    
    // Create test package (notes field removed - doesn't exist in schema)
    package = await dbHelper.createTestPackage(mailroom.id, resident.id, staff.profile.id)
  })
  
  afterEach(async () => {
    await dbHelper.cleanup()
  })
  
  describe('Complete Pickup Workflow', () => {
    it('should complete full pickup workflow: search → select → retrieve → log', async () => {
      const { supabase } = dbHelper
      
      // Step 1: Search for resident's packages
      const { data: waitingPackages } = await supabase
        .from('packages')
        .select('*, residents!inner(*)')
        .eq('mailroom_id', mailroom.id)
        .eq('status', 'WAITING')
        .eq('residents.student_id', 'STU123456')
      
      expect(waitingPackages).toHaveLength(1)
      expect(waitingPackages![0].id).toBe(package.id)
      
      // Step 2: Mark package as retrieved
      const { req: removeReq, res: removeRes } = createMocks({
        method: 'POST',
        body: {
          packageId: package.id,
          mailroomId: mailroom.id
        },
        headers: {
          authorization: `Bearer ${staff.id}`
        }
      })
      
      // Mock session
      vi.mock('../../lib/handleSession', () => ({
        default: vi.fn().mockImplementation(async (req, res, callback) => {
          const mockSession = {
            user: {
              id: staff.id,
              role: 'manager',
              organization_id: org.id,
              assigned_mailroom_id: mailroom.id
            }
          }
          return callback(mockSession)
        })
      }))
      
      await removePackageHandler(removeReq as any, removeRes as any)
      
      expect(removeRes._getStatusCode()).toBe(200)
      const removeResult = JSON.parse(removeRes._getData())
      expect(removeResult.success).toBe(true)
      
      // Step 3: Verify package status updated
      const { data: updatedPackage } = await supabase
        .from('packages')
        .select('*, package_queue!inner(*)')
        .eq('id', package.id)
        .single()
      
      expect(updatedPackage.status).toBe('RETRIEVED')
      expect(updatedPackage.pickup_staff_id).toBe(staff.id)
      expect(updatedPackage.retrieved_timestamp).toBeDefined()
      
      // Step 4: Verify package number released back to queue
      expect(updatedPackage.package_queue.is_available).toBe(true)
      expect(updatedPackage.package_queue.last_used_at).toBeDefined()
      
      // Step 5: Log package details
      const { req: logReq, res: logRes } = createMocks({
        method: 'POST',
        body: {
          packageId: package.id,
          mailroomId: mailroom.id
        },
        headers: {
          authorization: `Bearer ${staff.id}`
        }
      })
      
      await logPackageHandler(logReq as any, logRes as any)
      
      expect(logRes._getStatusCode()).toBe(200)
      const logResult = JSON.parse(logRes._getData())
      expect(logResult.pickup_staff_id).toBe(staff.id)
      expect(logResult.retrieved_timestamp).toBeDefined()
    })
    
    it('should handle bulk package pickup efficiently', async () => {
      const { supabase } = dbHelper
      
      // Create multiple packages for the same resident
      const packages = await Promise.all([
        dbHelper.createTestPackage(mailroom.id, {
          resident_id: resident.id,
          provider: 'UPS'
        }),
        dbHelper.createTestPackage(mailroom.id, {
          resident_id: resident.id,
          provider: 'USPS'
        }),
        dbHelper.createTestPackage(mailroom.id, {
          resident_id: resident.id,
          provider: 'Amazon'
        })
      ])
      
      // Bulk retrieve all packages
      const startTime = performance.now()
      
      const retrievalPromises = [package, ...packages].map(async (pkg) => {
        const { req, res } = createMocks({
          method: 'POST',
          body: {
            packageId: pkg.id,
            mailroomId: mailroom.id
          },
          headers: {
            authorization: `Bearer ${staff.id}`
          }
        })
        
        await removePackageHandler(req as any, res as any)
        return { packageId: pkg.id, success: res._getStatusCode() === 200 }
      })
      
      const results = await Promise.all(retrievalPromises)
      const endTime = performance.now()
      
      // All packages should be retrieved successfully
      expect(results.every(r => r.success)).toBe(true)
      
      // Performance check - should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(2000) // 2 seconds for 4 packages
      
      // Verify all packages marked as retrieved
      const { data: retrievedPackages } = await supabase
        .from('packages')
        .select('*')
        .eq('resident_id', resident.id)
        .eq('status', 'RETRIEVED')
      
      expect(retrievedPackages).toHaveLength(4)
      
      // Verify all package numbers released
      const packageIds = retrievedPackages!.map(p => p.package_id)
      const { data: queueStatus } = await supabase
        .from('package_queue')
        .select('*')
        .in('package_number', packageIds)
      
      expect(queueStatus!.every(q => q.is_available)).toBe(true)
    })
  })
  
  describe('Audit Trail and Tracking', () => {
    it('should maintain complete audit trail for package lifecycle', async () => {
      const { supabase } = dbHelper
      
      // Record initial state
      const { data: initialPackage } = await supabase
        .from('packages')
        .select('*')
        .eq('id', package.id)
        .single()
      
      expect(initialPackage.status).toBe('WAITING')
      expect(initialPackage.pickup_staff_id).toBeNull()
      expect(initialPackage.retrieved_timestamp).toBeNull()
      
      // Perform pickup
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          packageId: package.id,
          mailroomId: mailroom.id
        },
        headers: {
          authorization: `Bearer ${staff.id}`
        }
      })
      
      await removePackageHandler(req as any, res as any)
      
      // Verify audit trail
      const { data: retrievedPackage } = await supabase
        .from('packages')
        .select('*, profiles!pickup_staff_id(*)')
        .eq('id', package.id)
        .single()
      
      expect(retrievedPackage.status).toBe('RETRIEVED')
      expect(retrievedPackage.pickup_staff_id).toBe(staff.id)
      expect(retrievedPackage.profiles.email).toBe('staff@university.edu')
      expect(retrievedPackage.retrieved_timestamp).toBeDefined()
      
      // Timestamp should be recent (within last minute)
      const retrievedTime = new Date(retrievedPackage.retrieved_timestamp).getTime()
      const now = Date.now()
      expect(now - retrievedTime).toBeLessThan(60000) // 1 minute
    })
    
    it('should track pickup history with pagination', async () => {
      // Create and retrieve multiple packages
      const packagesToCreate = 25
      const packages = await Promise.all(
        Array.from({ length: packagesToCreate }, async (_, i) => {
          const pkg = await dbHelper.createTestPackage(mailroom.id, {
            resident_id: resident.id,
            provider: `Provider${i}`
          })
          
          // Mark as retrieved
          await dbHelper.updatePackageStatus(pkg.id, 'RETRIEVED', staff.id)
          return pkg
        })
      )
      
      // Test pagination
      const { req: page1Req, res: page1Res } = createMocks({
        method: 'GET',
        query: {
          mailroomId: mailroom.id,
          page: '1',
          limit: '10'
        },
        headers: {
          authorization: `Bearer ${staff.id}`
        }
      })
      
      await getRetrievedHandler(page1Req as any, page1Res as any)
      
      const page1Data = JSON.parse(page1Res._getData())
      expect(page1Data.packages).toHaveLength(10)
      expect(page1Data.total).toBe(packagesToCreate)
      expect(page1Data.page).toBe(1)
      
      // Verify packages are sorted by retrieved_timestamp DESC
      const timestamps = page1Data.packages.map((p: any) => 
        new Date(p.retrieved_timestamp).getTime()
      )
      expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a))
    })
  })
  
  describe('Package Number Release Validation', () => {
    it('should release package number immediately after pickup', async () => {
      const { supabase } = dbHelper
      
      // Verify initial queue state
      const { data: initialQueue } = await supabase
        .from('package_queue')
        .select('*')
        .eq('mailroom_id', mailroom.id)
        .eq('package_number', package.package_id)
        .single()
      
      expect(initialQueue.is_available).toBe(false)
      
      // Perform pickup
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          packageId: package.id,
          mailroomId: mailroom.id
        },
        headers: {
          authorization: `Bearer ${staff.id}`
        }
      })
      
      await removePackageHandler(req as any, res as any)
      
      // Verify queue state updated
      const { data: updatedQueue } = await supabase
        .from('package_queue')
        .select('*')
        .eq('mailroom_id', mailroom.id)
        .eq('package_number', package.package_id)
        .single()
      
      expect(updatedQueue.is_available).toBe(true)
      expect(new Date(updatedQueue.last_used_at).getTime()).toBeGreaterThan(
        new Date(initialQueue.last_used_at).getTime()
      )
    })
    
    it('should handle concurrent pickups without queue conflicts', async () => {
      // Create multiple packages with different numbers
      const packages = await Promise.all(
        Array.from({ length: 10 }, () => 
          dbHelper.createTestPackage(mailroom.id, {
            resident_id: resident.id
          })
        )
      )
      
      // Perform concurrent pickups
      const pickupPromises = packages.map(async (pkg) => {
        const { req, res } = createMocks({
          method: 'POST',
          body: {
            packageId: pkg.id,
            mailroomId: mailroom.id
          },
          headers: {
            authorization: `Bearer ${staff.id}`
          }
        })
        
        await removePackageHandler(req as any, res as any)
        return { 
          packageId: pkg.id, 
          packageNumber: pkg.package_id,
          success: res._getStatusCode() === 200 
        }
      })
      
      const results = await Promise.all(pickupPromises)
      
      // All pickups should succeed
      expect(results.every(r => r.success)).toBe(true)
      
      // Verify all package numbers are released
      const { supabase } = dbHelper
      const packageNumbers = results.map(r => r.packageNumber)
      
      const { data: queueStatus } = await supabase
        .from('package_queue')
        .select('*')
        .in('package_number', packageNumbers)
      
      expect(queueStatus!.every(q => q.is_available)).toBe(true)
      
      // Ensure no duplicate releases
      const uniqueNumbers = new Set(packageNumbers)
      expect(uniqueNumbers.size).toBe(packages.length)
    })
  })
  
  describe('Error Handling and Edge Cases', () => {
    it('should prevent pickup of non-existent package', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          packageId: 'non-existent-id',
          mailroomId: mailroom.id
        },
        headers: {
          authorization: `Bearer ${staff.id}`
        }
      })
      
      await removePackageHandler(req as any, res as any)
      
      expect(res._getStatusCode()).toBe(404)
      const error = JSON.parse(res._getData())
      expect(error.error).toContain('not found')
    })
    
    it('should prevent double pickup of same package', async () => {
      // First pickup - should succeed
      const { req: req1, res: res1 } = createMocks({
        method: 'POST',
        body: {
          packageId: package.id,
          mailroomId: mailroom.id
        },
        headers: {
          authorization: `Bearer ${staff.id}`
        }
      })
      
      await removePackageHandler(req1 as any, res1 as any)
      expect(res1._getStatusCode()).toBe(200)
      
      // Second pickup attempt - should fail
      const { req: req2, res: res2 } = createMocks({
        method: 'POST',
        body: {
          packageId: package.id,
          mailroomId: mailroom.id
        },
        headers: {
          authorization: `Bearer ${staff.id}`
        }
      })
      
      await removePackageHandler(req2 as any, res2 as any)
      expect(res2._getStatusCode()).toBe(400)
      const error = JSON.parse(res2._getData())
      expect(error.error).toContain('already retrieved')
    })
    
    it('should handle package pickup when resident is deactivated', async () => {
      const { supabase } = dbHelper
      
      // Deactivate resident
      await supabase
        .from('residents')
        .update({ is_active: false })
        .eq('id', resident.id)
      
      // Pickup should still work
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          packageId: package.id,
          mailroomId: mailroom.id
        },
        headers: {
          authorization: `Bearer ${staff.id}`
        }
      })
      
      await removePackageHandler(req as any, res as any)
      
      expect(res._getStatusCode()).toBe(200)
      
      // Verify package was retrieved
      const { data: retrievedPackage } = await supabase
        .from('packages')
        .select('*')
        .eq('id', package.id)
        .single()
      
      expect(retrievedPackage.status).toBe('RETRIEVED')
    })
    
    it('should prevent cross-mailroom package pickup', async () => {
      // Create another mailroom
      const mailroom2 = await dbHelper.createTestMailroom(org.id)
      
      // Create staff in different mailroom
      const otherStaff = await dbHelper.createTestUser(org.id, mailroom2.id, 'manager')
      
      // Try to pickup package from different mailroom
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          packageId: package.id,
          mailroomId: mailroom2.id // Wrong mailroom
        },
        headers: {
          authorization: `Bearer ${otherStaff.id}`
        }
      })
      
      await removePackageHandler(req as any, res as any)
      
      expect(res._getStatusCode()).toBe(404)
      const error = JSON.parse(res._getData())
      expect(error.error).toContain('not found')
    })
  })
  
  describe('Staff Identification and Permissions', () => {
    it('should correctly log staff member who performed pickup', async () => {
      const { supabase } = dbHelper
      
      // Create multiple staff members
      const staff2 = await dbHelper.createTestUser(org.id, mailroom.id, 'manager')
      
      // Create packages
      const package1 = await dbHelper.createTestPackage(mailroom.id, {
        resident_id: resident.id
      })
      const package2 = await dbHelper.createTestPackage(mailroom.id, {
        resident_id: resident.id
      })
      
      // Staff 1 picks up package 1
      const { req: req1, res: res1 } = createMocks({
        method: 'POST',
        body: {
          packageId: package1.id,
          mailroomId: mailroom.id
        },
        headers: {
          authorization: `Bearer ${staff.id}`
        }
      })
      
      await removePackageHandler(req1 as any, res1 as any)
      
      // Staff 2 picks up package 2
      const { req: req2, res: res2 } = createMocks({
        method: 'POST',
        body: {
          packageId: package2.id,
          mailroomId: mailroom.id
        },
        headers: {
          authorization: `Bearer ${staff2.id}`
        }
      })
      
      await removePackageHandler(req2 as any, res2 as any)
      
      // Verify correct staff logged for each package
      const { data: packages } = await supabase
        .from('packages')
        .select('*, profiles!pickup_staff_id(*)')
        .in('id', [package1.id, package2.id])
      
      const pkg1 = packages!.find(p => p.id === package1.id)
      const pkg2 = packages!.find(p => p.id === package2.id)
      
      expect(pkg1.pickup_staff_id).toBe(staff.id)
      expect(pkg1.profiles.email).toBe('staff@university.edu')
      
      expect(pkg2.pickup_staff_id).toBe(staff2.id)
      expect(pkg2.profiles.email).toBe('staff2@university.edu')
    })
    
    it('should require proper role permissions for pickup', async () => {
      // Create user with insufficient permissions
      const regularUser = await dbHelper.createTestUser(org.id, mailroom.id, 'user')
      
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          packageId: package.id,
          mailroomId: mailroom.id
        },
        headers: {
          authorization: `Bearer ${regularUser.id}`
        }
      })
      
      await removePackageHandler(req as any, res as any)
      
      expect(res._getStatusCode()).toBe(403)
      const error = JSON.parse(res._getData())
      expect(error.error).toContain('permission')
    })
  })
  
  describe('Timestamp and Data Integrity', () => {
    it('should ensure retrieved_timestamp is set by database trigger', async () => {
      const { supabase } = dbHelper
      
      // Get current time before pickup
      const beforePickup = Date.now()
      
      // Perform pickup
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          packageId: package.id,
          mailroomId: mailroom.id
        },
        headers: {
          authorization: `Bearer ${staff.id}`
        }
      })
      
      await removePackageHandler(req as any, res as any)
      
      // Get timestamp after pickup
      const afterPickup = Date.now()
      
      // Verify timestamp is within expected range
      const { data: retrievedPackage } = await supabase
        .from('packages')
        .select('*')
        .eq('id', package.id)
        .single()
      
      const retrievedTime = new Date(retrievedPackage.retrieved_timestamp).getTime()
      
      expect(retrievedTime).toBeGreaterThanOrEqual(beforePickup)
      expect(retrievedTime).toBeLessThanOrEqual(afterPickup)
      
      // Timestamp should be different from created_at
      expect(retrievedPackage.retrieved_timestamp).not.toBe(retrievedPackage.created_at)
    })
    
    it('should maintain data consistency during failed pickup attempts', async () => {
      const { supabase } = dbHelper
      
      // Mock a database error during update
      const originalUpdate = supabase.from('packages').update
      let callCount = 0
      
      supabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'packages') {
          return {
            update: vi.fn().mockImplementation(() => {
              callCount++
              if (callCount === 1) {
                throw new Error('Database connection lost')
              }
              return originalUpdate.call(supabase.from('packages'))
            }),
            select: supabase.from('packages').select,
            insert: supabase.from('packages').insert
          }
        }
        return supabase.from(table)
      })
      
      // First attempt should fail
      const { req: req1, res: res1 } = createMocks({
        method: 'POST',
        body: {
          packageId: package.id,
          mailroomId: mailroom.id
        },
        headers: {
          authorization: `Bearer ${staff.id}`
        }
      })
      
      await removePackageHandler(req1 as any, res1 as any)
      expect(res1._getStatusCode()).toBe(500)
      
      // Verify package state unchanged
      const { data: unchangedPackage } = await supabase
        .from('packages')
        .select('*')
        .eq('id', package.id)
        .single()
      
      expect(unchangedPackage.status).toBe('WAITING')
      expect(unchangedPackage.pickup_staff_id).toBeNull()
      expect(unchangedPackage.retrieved_timestamp).toBeNull()
      
      // Restore normal operation
      vi.restoreAllMocks()
      
      // Second attempt should succeed
      const { req: req2, res: res2 } = createMocks({
        method: 'POST',
        body: {
          packageId: package.id,
          mailroomId: mailroom.id
        },
        headers: {
          authorization: `Bearer ${staff.id}`
        }
      })
      
      await removePackageHandler(req2 as any, res2 as any)
      expect(res2._getStatusCode()).toBe(200)
      
      // Verify package now retrieved
      const { data: retrievedPackage } = await supabase
        .from('packages')
        .select('*')
        .eq('id', package.id)
        .single()
      
      expect(retrievedPackage.status).toBe('RETRIEVED')
    })
  })
})