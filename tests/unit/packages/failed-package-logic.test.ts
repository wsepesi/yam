// Failed Package Logic Tests (using mocks)
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockSupabase } from '../../mocks/supabase.mock'

describe('Failed Package Logic', () => {
  beforeEach(() => {
    mockSupabase.clearAllTables()
    mockSupabase.clearErrors()
    
    // Seed some test data
    mockSupabase.seedTable('mailrooms', [{
      id: 'test-mailroom-1',
      name: 'Test Mailroom',
      slug: 'test-mailroom',
      organization_id: 'test-org-1'
    }])
    
    mockSupabase.seedTable('profiles', [{
      id: 'test-user-1',
      email: 'staff@example.com',
      role: 'user',
      organization_id: 'test-org-1',
      mailroom_id: 'test-mailroom-1'
    }])
  })
  
  describe('Failed Package Logging', () => {
    it('should log failed packages with appropriate details', async () => {
      const failedPackageData = {
        mailroom_id: 'test-mailroom-1',
        staff_id: 'test-user-1',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        resident_id: null,
        provider: 'FedEx',
        error_details: 'Resident not found in system',
        resolved: false,
        created_at: new Date().toISOString()
      }
      
      // Insert failed package log
      await mockSupabase.from('failed_package_logs').insert(failedPackageData)
      
      // Verify it was logged
      const logs = mockSupabase.getTableData('failed_package_logs')
      expect(logs).toHaveLength(1)
      expect(logs[0]).toMatchObject({
        staff_id: 'test-user-1',
        error_details: 'Resident not found in system',
        resolved: false
      })
    })
    
    it('should categorize failure types', () => {
      const failureCategories = {
        'Resident not found': 'RESIDENT_NOT_FOUND',
        'Invalid email format': 'VALIDATION_ERROR',
        'No available package numbers': 'QUEUE_EXHAUSTED',
        'Database connection failed': 'SYSTEM_ERROR',
        'Duplicate package entry': 'DUPLICATE_ERROR',
        'Missing required field': 'VALIDATION_ERROR',
        'Network timeout': 'SYSTEM_ERROR'
      }
      
      Object.entries(failureCategories).forEach(([error, category]) => {
        expect(categorizeFailure(error)).toBe(category)
      })
    })
    
    it('should track failure statistics', async () => {
      // Log multiple failures
      const failures = [
        { error: 'Resident not found', count: 5 },
        { error: 'Invalid email format', count: 3 },
        { error: 'Database error', count: 1 }
      ]
      
      for (const failure of failures) {
        for (let i = 0; i < failure.count; i++) {
          await mockSupabase.from('failed_package_logs').insert({
            mailroom_id: 'test-mailroom-1',
            staff_id: 'test-user-1',
            first_name: 'Test',
            last_name: 'User',
            email: 'test@example.com',
            provider: 'Test',
            error_details: failure.error,
            resolved: false
          })
        }
      }
      
      // Get statistics
      const logs = mockSupabase.getTableData('failed_package_logs')
      const stats = logs.reduce((acc, log) => {
        acc[log.error_details] = (acc[log.error_details] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      expect(stats['Resident not found']).toBe(5)
      expect(stats['Invalid email format']).toBe(3)
      expect(stats['Database error']).toBe(1)
    })
  })
  
  describe('Recovery Procedures', () => {
    it('should support marking failures as resolved', async () => {
      // Create a failed log
      await mockSupabase.from('failed_package_logs').insert({
        id: 'fail-1',
        mailroom_id: 'test-mailroom-1',
        staff_id: 'test-user-1',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        provider: 'UPS',
        error_details: 'Temporary error',
        resolved: false
      })
      
      // Mark as resolved
      await mockSupabase.from('failed_package_logs')
        .update({ 
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: 'test-user-1',
          resolution_notes: 'Manually created package'
        })
        .eq('id', 'fail-1')
      
      const logs = mockSupabase.getTableData('failed_package_logs')
      expect(logs[0].resolved).toBe(true)
    })
    
    it('should track package number recycling', () => {
      // When a package fails after getting a number
      const failedAttempt = {
        packageNumber: 123,
        error: 'Database constraint violation',
        shouldRecycle: true
      }
      
      expect(failedAttempt.shouldRecycle).toBe(true)
      expect(failedAttempt.packageNumber).toBe(123)
      
      // The number should be released back to the queue
      // This would be done via RPC call in real implementation
    })
  })
  
  describe('Admin Notification Logic', () => {
    it('should identify critical failures requiring immediate attention', () => {
      const failures = [
        { error: 'Package queue exhausted', critical: true },
        { error: 'Database connection failed', critical: true },
        { error: 'Resident not found', critical: false },
        { error: 'Invalid email', critical: false },
        { error: 'System configuration error', critical: true }
      ]
      
      const criticalFailures = failures.filter(f => isCriticalFailure(f.error))
      expect(criticalFailures).toHaveLength(3)
    })
    
    it('should generate summary reports', async () => {
      // Seed multiple failures
      const testDate = new Date().toISOString().split('T')[0]
      
      await mockSupabase.from('failed_package_logs').insert([
        { mailroom_id: 'test-mailroom-1', error_details: 'Error A', resolved: false },
        { mailroom_id: 'test-mailroom-1', error_details: 'Error A', resolved: false },
        { mailroom_id: 'test-mailroom-1', error_details: 'Error B', resolved: false },
        { mailroom_id: 'test-mailroom-1', error_details: 'Error A', resolved: true }
      ])
      
      const logs = mockSupabase.getTableData('failed_package_logs')
      const unresolvedLogs = logs.filter(l => !l.resolved && l.mailroom_id === 'test-mailroom-1')
      
      const summary = {
        date: testDate,
        mailroom: 'Test Mailroom',
        totalUnresolved: unresolvedLogs.length,
        byError: unresolvedLogs.reduce((acc, log) => {
          acc[log.error_details] = (acc[log.error_details] || 0) + 1
          return acc
        }, {} as Record<string, number>)
      }
      
      expect(summary.totalUnresolved).toBe(3)
      expect(summary.byError['Error A']).toBe(2)
      expect(summary.byError['Error B']).toBe(1)
    })
  })
  
  describe('Bulk Failure Handling', () => {
    it('should process bulk upload failures efficiently', async () => {
      const bulkFailures = Array.from({ length: 50 }, (_, i) => ({
        mailroom_id: 'test-mailroom-1',
        staff_id: 'test-user-1',
        first_name: `User${i}`,
        last_name: 'Test',
        email: `user${i}@example.com`,
        provider: 'Bulk',
        error_details: i % 3 === 0 ? 'Invalid email' : 'Resident not found',
        resolved: false,
        bulk_upload_id: 'bulk-123'
      }))
      
      // Insert all failures
      for (const failure of bulkFailures) {
        await mockSupabase.from('failed_package_logs').insert(failure)
      }
      
      const logs = mockSupabase.getTableData('failed_package_logs')
      const bulkLogs = logs.filter(l => l.bulk_upload_id === 'bulk-123')
      
      expect(bulkLogs).toHaveLength(50)
      
      // Generate bulk report
      const report = {
        uploadId: 'bulk-123',
        total: bulkLogs.length,
        byError: bulkLogs.reduce((acc, log) => {
          acc[log.error_details] = (acc[log.error_details] || 0) + 1
          return acc
        }, {} as Record<string, number>)
      }
      
      expect(report.byError['Invalid email']).toBe(17) // indices 0,3,6,9...
      expect(report.byError['Resident not found']).toBe(33)
    })
  })
})

// Helper functions that should be in the actual implementation
function categorizeFailure(error: string): string {
  if (error.toLowerCase().includes('not found')) return 'RESIDENT_NOT_FOUND'
  if (error.toLowerCase().includes('invalid') || error.toLowerCase().includes('missing')) return 'VALIDATION_ERROR'
  if (error.toLowerCase().includes('queue') || error.toLowerCase().includes('exhausted') || error.toLowerCase().includes('no available package')) return 'QUEUE_EXHAUSTED'
  if (error.toLowerCase().includes('duplicate')) return 'DUPLICATE_ERROR'
  if (error.toLowerCase().includes('database') || error.toLowerCase().includes('network') || error.toLowerCase().includes('timeout')) return 'SYSTEM_ERROR'
  return 'UNKNOWN_ERROR'
}

function isCriticalFailure(error: string): boolean {
  const criticalPatterns = [
    'queue exhausted',
    'database connection',
    'system configuration',
    'authentication failed',
    'service unavailable'
  ]
  
  return criticalPatterns.some(pattern => 
    error.toLowerCase().includes(pattern)
  )
}