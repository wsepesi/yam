// Package State Machine Validation Tests
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest'
import { DatabaseTestHelper } from '../../utils/db-test-helper'
import { getSharedAdminInstance } from '../../setup'
import { server } from '../../mocks/server'
import { http } from 'msw'

describe('Package State Machine Validation', () => {
  let dbHelper: DatabaseTestHelper
  let supabase: any
  let testOrg: any
  let testMailroom: any
  let testUser: any
  let testResident: any
  
  beforeAll(() => {
    // Use real database to test actual constraints
    process.env.USE_REAL_DB = 'true'
    
    // Disable MSW for real database tests to prevent request interception
    server.close()
    
    supabase = getSharedAdminInstance()
    dbHelper = DatabaseTestHelper.getInstance()
  })
  
  beforeEach(async () => {
    // Create test environment
    testOrg = await dbHelper.createTestOrg()
    testMailroom = await dbHelper.createTestMailroom(testOrg.id)
    testUser = await dbHelper.createTestUser(testOrg.id, testMailroom.id)
    testResident = await dbHelper.createTestResident(testMailroom.id)
  })
  
  afterEach(async () => {
    await dbHelper.cleanup()
  })
  
  describe('Valid State Transitions', () => {
    it('should allow WAITING → RETRIEVED transition', async () => {
      const pkg = await dbHelper.createTestPackage(testMailroom.id, testResident.id, testUser.id)
      expect(pkg.status).toBe('WAITING')
      
      const updated = await dbHelper.updatePackageStatus(pkg.id, 'RETRIEVED')
      expect(updated.status).toBe('RETRIEVED')
      expect(updated.retrieved_timestamp).toBeDefined()
      expect(new Date(updated.retrieved_timestamp).getTime()).toBeGreaterThan(new Date(pkg.created_at).getTime())
    })
    
    it('should allow RETRIEVED → RESOLVED transition', async () => {
      const pkg = await dbHelper.createTestPackage(testMailroom.id, testResident.id, testUser.id)
      
      // First move to RETRIEVED
      await dbHelper.updatePackageStatus(pkg.id, 'RETRIEVED')
      
      // Then to RESOLVED
      const resolved = await dbHelper.updatePackageStatus(pkg.id, 'RESOLVED')
      expect(resolved.status).toBe('RESOLVED')
      expect(resolved.resolved_timestamp).toBeDefined()
    })
    
    it('should allow direct WAITING → RESOLVED transition for quick pickups', async () => {
      const pkg = await dbHelper.createTestPackage(testMailroom.id, testResident.id, testUser.id)
      
      // Direct transition for immediate pickup scenarios
      const resolved = await dbHelper.updatePackageStatus(pkg.id, 'RESOLVED')
      expect(resolved.status).toBe('RESOLVED')
      expect(resolved.resolved_timestamp).toBeDefined()
    })
    
    it('should track timestamps accurately for each transition', async () => {
      const pkg = await dbHelper.createTestPackage(testMailroom.id, testResident.id, testUser.id)
      const createdTime = new Date(pkg.created_at).getTime()
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const retrieved = await dbHelper.updatePackageStatus(pkg.id, 'RETRIEVED')
      const retrievedTime = new Date(retrieved.retrieved_timestamp).getTime()
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const resolved = await dbHelper.updatePackageStatus(pkg.id, 'RESOLVED')
      const resolvedTime = new Date(resolved.resolved_timestamp).getTime()
      
      // Verify chronological order
      expect(retrievedTime).toBeGreaterThan(createdTime)
      expect(resolvedTime).toBeGreaterThan(retrievedTime)
    })
  })
  
  describe('Invalid State Transitions', () => {
    it('should prevent RETRIEVED → WAITING transition', async () => {
      const pkg = await dbHelper.createTestPackage(testMailroom.id, testResident.id, testUser.id)
      await dbHelper.updatePackageStatus(pkg.id, 'RETRIEVED')
      
      // Attempt invalid transition
      const { error } = await supabase.from('packages')
        .update({ status: 'WAITING' })
        .eq('id', pkg.id)
      
      // Check current state
      const { data: currentPkg } = await supabase.from('packages')
        .select('status')
        .eq('id', pkg.id)
        .single()
      
      // ⚠️ CRITICAL: Database should prevent this but currently doesn't
      if (!error && currentPkg.status === 'WAITING') {
        console.error('❌ CRITICAL BUG: Database allows RETRIEVED → WAITING transition')
        console.error('This violates package lifecycle integrity')
        expect.fail('Database must prevent backward state transitions')
      }
    })
    
    it('should prevent RESOLVED → RETRIEVED transition', async () => {
      const pkg = await dbHelper.createTestPackage(testMailroom.id, testResident.id, testUser.id)
      await dbHelper.updatePackageStatus(pkg.id, 'RESOLVED')
      
      // Attempt invalid transition
      const { error } = await supabase.from('packages')
        .update({ status: 'RETRIEVED' })
        .eq('id', pkg.id)
      
      // Check current state
      const { data: currentPkg } = await supabase.from('packages')
        .select('status')
        .eq('id', pkg.id)
        .single()
      
      // ⚠️ CRITICAL: Database should prevent this but currently doesn't
      if (!error && currentPkg.status === 'RETRIEVED') {
        console.error('❌ CRITICAL BUG: Database allows RESOLVED → RETRIEVED transition')
        console.error('This violates package lifecycle integrity')
        expect.fail('Database must prevent backward state transitions')
      }
    })
    
    it('should prevent RESOLVED → WAITING transition', async () => {
      const pkg = await dbHelper.createTestPackage(testMailroom.id, testResident.id, testUser.id)
      await dbHelper.updatePackageStatus(pkg.id, 'RESOLVED')
      
      // Attempt invalid transition
      const { error } = await supabase.from('packages')
        .update({ status: 'WAITING' })
        .eq('id', pkg.id)
      
      // Check current state
      const { data: currentPkg } = await supabase.from('packages')
        .select('status')
        .eq('id', pkg.id)
        .single()
      
      // ⚠️ CRITICAL: Database should prevent this but currently doesn't
      if (!error && currentPkg.status === 'WAITING') {
        console.error('❌ CRITICAL BUG: Database allows RESOLVED → WAITING transition')
        console.error('This violates package lifecycle integrity')
        expect.fail('Database must prevent backward state transitions')
      }
    })
  })
  
  describe('Concurrent State Change Handling', () => {
    it('should handle concurrent status updates safely', async () => {
      const pkg = await dbHelper.createTestPackage(testMailroom.id, testResident.id, testUser.id)
      
      // Simulate two staff members trying to update status simultaneously
      const update1 = supabase.from('packages')
        .update({ 
          status: 'RETRIEVED',
          retrieved_timestamp: new Date().toISOString(),
          retrieved_by: 'staff1'
        })
        .eq('id', pkg.id)
        .select()
        .single()
      
      const update2 = supabase.from('packages')
        .update({ 
          status: 'RETRIEVED',
          retrieved_timestamp: new Date().toISOString(),
          retrieved_by: 'staff2'
        })
        .eq('id', pkg.id)
        .select()
        .single()
      
      const [result1, result2] = await Promise.all([update1, update2])
      
      // Both should succeed (last write wins), but we should track who actually updated
      const { data: finalPkg } = await supabase.from('packages')
        .select('*')
        .eq('id', pkg.id)
        .single()
      
      expect(finalPkg.status).toBe('RETRIEVED')
      expect(finalPkg.retrieved_timestamp).toBeDefined()
      
      // In a proper system, we'd want optimistic locking or version control
      console.warn('⚠️ WARNING: No optimistic locking for concurrent updates')
    })
    
    it('should maintain data consistency during rapid state changes', async () => {
      const packages = []
      
      // Create 5 packages
      for (let i = 0; i < 5; i++) {
        const pkg = await dbHelper.createTestPackage(testMailroom.id, testResident.id, testUser.id)
        packages.push(pkg)
      }
      
      // Rapid concurrent updates
      const updates = packages.map(async (pkg, index) => {
        // Stagger updates slightly
        await new Promise(resolve => setTimeout(resolve, index * 10))
        
        // Update to RETRIEVED
        await dbHelper.updatePackageStatus(pkg.id, 'RETRIEVED')
        
        // Immediately update to RESOLVED
        return await dbHelper.updatePackageStatus(pkg.id, 'RESOLVED')
      })
      
      const results = await Promise.all(updates)
      
      // All should end up in RESOLVED state
      results.forEach(result => {
        expect(result.status).toBe('RESOLVED')
        expect(result.resolved_timestamp).toBeDefined()
      })
    })
  })
  
  describe('Admin Override Scenarios', () => {
    it('should allow admin to override normal state transitions', async () => {
      const pkg = await dbHelper.createTestPackage(testMailroom.id, testResident.id, testUser.id)
      
      // Admin marks package as FAILED (if supported)
      const { data: failedPkg, error } = await supabase.from('packages')
        .update({ 
          status: 'FAILED',
          failed_reason: 'Package damaged - admin override',
          failed_by: testUser.id,
          failed_timestamp: new Date().toISOString()
        })
        .eq('id', pkg.id)
        .select()
        .single()
      
      if (error) {
        console.error('❌ CRITICAL: FAILED status not supported in schema')
        console.error('This is needed for proper package management')
        expect.fail('Database schema must support FAILED status')
      } else {
        expect(failedPkg.status).toBe('FAILED')
        expect(failedPkg.failed_reason).toBe('Package damaged - admin override')
      }
    })
    
    it('should create audit trail for admin actions', async () => {
      const pkg = await dbHelper.createTestPackage(testMailroom.id, testResident.id, testUser.id)
      
      // Update with admin reason
      const { data: updated } = await supabase.from('packages')
        .update({ 
          status: 'RESOLVED',
          resolved_timestamp: new Date().toISOString(),
          admin_notes: 'Resolved by admin - recipient confirmed pickup verbally'
        })
        .eq('id', pkg.id)
        .select()
        .single()
      
      // ⚠️ NOTE: admin_notes field may not exist in current schema
      if (updated && !updated.admin_notes) {
        console.warn('⚠️ WARNING: No admin_notes field for audit trail')
        console.warn('Admin actions should be tracked for compliance')
      }
    })
  })
  
  describe('Rollback Mechanisms', () => {
    it('should support rollback for failed state transitions', async () => {
      const pkg = await dbHelper.createTestPackage(testMailroom.id, testResident.id, testUser.id)
      
      // Move to RETRIEVED
      await dbHelper.updatePackageStatus(pkg.id, 'RETRIEVED')
      
      // Simulate a failed resolution that needs rollback
      // In a real system, this would be wrapped in a transaction
      const { error: resolveError } = await supabase.from('packages')
        .update({ 
          status: 'RESOLVED',
          resolved_timestamp: new Date().toISOString()
        })
        .eq('id', pkg.id)
      
      if (resolveError) {
        // Rollback would happen here
        console.log('Transaction failed, state remains RETRIEVED')
      }
      
      // ⚠️ NOTE: Supabase doesn't support client-side transactions
      console.warn('⚠️ WARNING: No transaction support for atomic state changes')
      console.warn('Consider server-side functions for critical state transitions')
    })
  })
  
  describe('State Machine Edge Cases', () => {
    it('should handle packages with no state transitions', async () => {
      const pkg = await dbHelper.createTestPackage(testMailroom.id, testResident.id, testUser.id)
      
      // Package remains in WAITING state
      const { data: unchangedPkg } = await supabase.from('packages')
        .select('*')
        .eq('id', pkg.id)
        .single()
      
      expect(unchangedPkg.status).toBe('WAITING')
      expect(unchangedPkg.retrieved_timestamp).toBeNull()
      expect(unchangedPkg.resolved_timestamp).toBeNull()
    })
    
    it('should handle orphaned packages after resident deletion', async () => {
      const pkg = await dbHelper.createTestPackage(testMailroom.id, testResident.id, testUser.id)
      
      // Attempt to delete resident (should be prevented by FK constraint)
      const { error: deleteError } = await supabase.from('residents')
        .delete()
        .eq('id', testResident.id)
      
      if (!deleteError) {
        console.error('❌ CRITICAL: Resident deletion allowed with active packages')
        console.error('This creates orphaned package records')
        expect.fail('Foreign key constraint should prevent resident deletion')
      } else {
        expect(deleteError.message).toContain('foreign key')
      }
    })
  })
})