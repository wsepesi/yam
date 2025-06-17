import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createMocks } from 'node-mocks-http'
import { DatabaseTestHelper } from '../utils/db-test-helper'
import addPackageHandler from '@/pages/api/add-package'
import { getSharedAdminInstance } from '../setup'

// This test file WILL FAIL until the failed package logging integration is fixed
// These tests verify that package registration failures and email send failures
// are properly logged to the failed_package_logs table

describe('Failed Package Logging Integration', () => {
  const dbHelper = DatabaseTestHelper.getInstance()
  const supabase = getSharedAdminInstance()
  
  let org: any, mailroom: any, manager: any, resident: any
  
  beforeEach(async () => {
    await dbHelper.cleanup()
    
    // Set up test data
    org = await dbHelper.createTestOrg('Test Org')
    mailroom = await dbHelper.createTestMailroom(org.id, 'Test Mailroom')
    manager = await dbHelper.createTestUser(org.id, mailroom.id, 'manager')
    resident = await dbHelper.createTestResident(mailroom.id)
    
    // Clear any existing failed package logs
    await supabase.from('failed_package_logs').delete().gte('created_at', '1900-01-01')
  })
  
  afterEach(async () => {
    await dbHelper.cleanup()
  })

  describe('Package Registration Failure Logging', () => {
    it('should log to failed_package_logs when package registration fails due to no available package numbers', async () => {
      // Mark all package numbers as unavailable to force failure
      await supabase
        .from('package_ids')
        .update({ is_available: false })
        .eq('mailroom_id', mailroom.id)
      
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          mailroomSlug: mailroom.slug,
          orgSlug: org.slug,
          packageData: {
            First: 'John',
            Last: 'Doe',
            Email: 'john.doe@example.com',
            provider: 'FedEx'
          }
        }
      })

      // Mock session for authentication
      vi.doMock('next-auth/next', () => ({
        getServerSession: vi.fn().mockResolvedValue({
          user: {
            id: manager.profile.id,
            email: manager.profile.email,
            role: 'manager',
            organizationId: org.id,
            mailroomId: mailroom.id
          }
        })
      }))

      await addPackageHandler(req, res)

      // Should return error
      expect(res._getStatusCode()).toBe(500)
      
      // **THIS WILL FAIL UNTIL INTEGRATION IS FIXED**
      // Should log the failure to failed_package_logs table
      const { data: failedLogs } = await supabase
        .from('failed_package_logs')
        .select('*')
        .eq('mailroom_id', mailroom.id)
        .eq('first_name', 'John')
        .eq('last_name', 'Doe')
      
      expect(failedLogs).toHaveLength(1)
      expect(failedLogs![0]).toMatchObject({
        mailroom_id: mailroom.id,
        staff_id: manager.profile.id,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        provider: 'FedEx',
        error_details: expect.stringContaining('No package numbers available'),
        resolved: false
      })
    })

    it('should log to failed_package_logs when package registration fails due to invalid resident data', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          mailroomSlug: mailroom.slug,
          orgSlug: org.slug,
          packageData: {
            First: 'Jane',
            Last: 'Invalid',
            Email: 'jane.invalid@example.com',
            provider: 'UPS',
            residentId: 'non-existent-resident-id' // This will cause failure
          }
        }
      })

      // Mock session
      vi.doMock('next-auth/next', () => ({
        getServerSession: vi.fn().mockResolvedValue({
          user: {
            id: manager.profile.id,
            email: manager.profile.email,
            role: 'manager',
            organizationId: org.id,
            mailroomId: mailroom.id
          }
        })
      }))

      await addPackageHandler(req, res)

      // Should return error
      expect(res._getStatusCode()).toBe(500)
      
      // **THIS WILL FAIL UNTIL INTEGRATION IS FIXED**
      // Should log the failure to failed_package_logs table
      const { data: failedLogs } = await supabase
        .from('failed_package_logs')
        .select('*')
        .eq('mailroom_id', mailroom.id)
        .eq('first_name', 'Jane')
        .eq('last_name', 'Invalid')
      
      expect(failedLogs).toHaveLength(1)
      expect(failedLogs![0]).toMatchObject({
        mailroom_id: mailroom.id,
        staff_id: manager.profile.id,
        first_name: 'Jane',
        last_name: 'Invalid',
        email: 'jane.invalid@example.com',
        provider: 'UPS',
        error_details: expect.stringContaining('Resident not found'),
        resolved: false
      })
    })

    it('should log to failed_package_logs when package registration fails due to database constraint violation', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          mailroomSlug: mailroom.slug,
          orgSlug: org.slug,
          packageData: {
            First: 'Bob',
            Last: 'Constraint',
            Email: 'bob.constraint@example.com',
            provider: 'DHL',
            // Missing required fields to trigger constraint violation
            residentId: null
          }
        }
      })

      // Mock session
      vi.doMock('next-auth/next', () => ({
        getServerSession: vi.fn().mockResolvedValue({
          user: {
            id: manager.profile.id,
            email: manager.profile.email,
            role: 'manager',
            organizationId: org.id,
            mailroomId: mailroom.id
          }
        })
      }))

      await addPackageHandler(req, res)

      // Should return error
      expect(res._getStatusCode()).toBe(500)
      
      // **THIS WILL FAIL UNTIL INTEGRATION IS FIXED**
      // Should log the failure to failed_package_logs table
      const { data: failedLogs } = await supabase
        .from('failed_package_logs')
        .select('*')
        .eq('mailroom_id', mailroom.id)
        .eq('first_name', 'Bob')
        .eq('last_name', 'Constraint')
      
      expect(failedLogs).toHaveLength(1)
      expect(failedLogs![0]).toMatchObject({
        mailroom_id: mailroom.id,
        staff_id: manager.profile.id,
        first_name: 'Bob',
        last_name: 'Constraint',
        email: 'bob.constraint@example.com',
        provider: 'DHL',
        error_details: expect.stringContaining('constraint'),
        resolved: false
      })
    })
  })

  describe('Email Send Failure Logging', () => {
    it('should log to failed_package_logs when email notification fails to send', async () => {
      // Mock email service to fail
      vi.doMock('@/lib/sendEmail', () => ({
        sendEmailDirectlyInBackground: vi.fn().mockRejectedValue(new Error('SMTP connection failed'))
      }))

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          mailroomSlug: mailroom.slug,
          orgSlug: org.slug,
          packageData: {
            First: 'Email',
            Last: 'Failed',
            Email: 'email.failed@example.com',
            provider: 'FedEx',
            residentId: resident.id
          }
        }
      })

      // Mock session
      vi.doMock('next-auth/next', () => ({
        getServerSession: vi.fn().mockResolvedValue({
          user: {
            id: manager.profile.id,
            email: manager.profile.email,
            role: 'manager',
            organizationId: org.id,
            mailroomId: mailroom.id
          }
        })
      }))

      await addPackageHandler(req, res)

      // Package creation should succeed
      expect(res._getStatusCode()).toBe(200)
      
      // **THIS WILL FAIL UNTIL INTEGRATION IS FIXED**
      // Should log the email failure to failed_package_logs table
      // Wait a bit for background email processing
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const { data: failedLogs } = await supabase
        .from('failed_package_logs')
        .select('*')
        .eq('mailroom_id', mailroom.id)
        .eq('first_name', 'Email')
        .eq('last_name', 'Failed')
      
      expect(failedLogs).toHaveLength(1)
      expect(failedLogs![0]).toMatchObject({
        mailroom_id: mailroom.id,
        staff_id: manager.profile.id,
        first_name: 'Email',
        last_name: 'Failed',
        email: 'email.failed@example.com',
        provider: 'FedEx',
        error_details: expect.stringContaining('Email send failed: SMTP connection failed'),
        resolved: false
      })
    })

    it('should log to failed_package_logs when email fails due to invalid template or configuration', async () => {
      // Mock email service to fail with template error
      vi.doMock('@/lib/sendEmail', () => ({
        sendEmailDirectlyInBackground: vi.fn().mockRejectedValue(new Error('Email template rendering failed'))
      }))

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          mailroomSlug: mailroom.slug,
          orgSlug: org.slug,
          packageData: {
            First: 'Template',
            Last: 'Error',
            Email: 'template.error@example.com',
            provider: 'UPS',
            residentId: resident.id
          }
        }
      })

      // Mock session
      vi.doMock('next-auth/next', () => ({
        getServerSession: vi.fn().mockResolvedValue({
          user: {
            id: manager.profile.id,
            email: manager.profile.email,
            role: 'manager',
            organizationId: org.id,
            mailroomId: mailroom.id
          }
        })
      }))

      await addPackageHandler(req, res)

      // Package creation should succeed
      expect(res._getStatusCode()).toBe(200)
      
      // **THIS WILL FAIL UNTIL INTEGRATION IS FIXED**
      // Should log the email failure to failed_package_logs table
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const { data: failedLogs } = await supabase
        .from('failed_package_logs')
        .select('*')
        .eq('mailroom_id', mailroom.id)
        .eq('first_name', 'Template')
        .eq('last_name', 'Error')
      
      expect(failedLogs).toHaveLength(1)
      expect(failedLogs![0]).toMatchObject({
        mailroom_id: mailroom.id,
        staff_id: manager.profile.id,
        first_name: 'Template',
        last_name: 'Error',
        email: 'template.error@example.com',
        provider: 'UPS',
        error_details: expect.stringContaining('Email send failed: Email template rendering failed'),
        resolved: false
      })
    })
  })

  describe('Integration with Existing Fail Package API', () => {
    it('should use the same failed_package_logs structure as the existing fail-package API', async () => {
      // Create a manual failed package log using the existing API structure
      const { data: manualLog } = await supabase
        .from('failed_package_logs')
        .insert({
          mailroom_id: mailroom.id,
          staff_id: manager.profile.id,
          first_name: 'Manual',
          last_name: 'Entry',
          email: 'manual.entry@example.com',
          resident_id: 'manual-id',
          provider: 'Manual',
          error_details: 'Manual test entry',
          resolved: false
        })
        .select()
        .single()

      // Trigger a package registration failure
      await supabase
        .from('package_ids')
        .update({ is_available: false })
        .eq('mailroom_id', mailroom.id)

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          mailroomSlug: mailroom.slug,
          orgSlug: org.slug,
          packageData: {
            First: 'Auto',
            Last: 'Entry',
            Email: 'auto.entry@example.com',
            provider: 'FedEx'
          }
        }
      })

      // Mock session
      vi.doMock('next-auth/next', () => ({
        getServerSession: vi.fn().mockResolvedValue({
          user: {
            id: manager.profile.id,
            email: manager.profile.email,
            role: 'manager',
            organizationId: org.id,
            mailroomId: mailroom.id
          }
        })
      }))

      await addPackageHandler(req, res)

      // **THIS WILL FAIL UNTIL INTEGRATION IS FIXED**
      // Should have created an auto log with same structure as manual log
      const { data: allLogs } = await supabase
        .from('failed_package_logs')
        .select('*')
        .eq('mailroom_id', mailroom.id)
        .order('created_at', { ascending: true })

      expect(allLogs).toHaveLength(2)
      
      const autoLog = allLogs!.find(log => log.first_name === 'Auto')
      expect(autoLog).toBeDefined()
      
      // Should have same structure as manual entry
      expect(Object.keys(autoLog!)).toEqual(Object.keys(manualLog))
      expect(autoLog!.mailroom_id).toBe(manualLog.mailroom_id)
      expect(autoLog!.staff_id).toBe(manualLog.staff_id)
      expect(typeof autoLog!.resolved).toBe('boolean')
      expect(autoLog!.resolved).toBe(false)
    })
  })

  describe('Failed Package Log Resolution Tracking', () => {
    it('should create failed logs that can be resolved using existing resolution workflow', async () => {
      // Force a package registration failure
      await supabase
        .from('package_ids')
        .update({ is_available: false })
        .eq('mailroom_id', mailroom.id)

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          mailroomSlug: mailroom.slug,
          orgSlug: org.slug,
          packageData: {
            First: 'Resolution',
            Last: 'Test',
            Email: 'resolution.test@example.com',
            provider: 'FedEx'
          }
        }
      })

      // Mock session
      vi.doMock('next-auth/next', () => ({
        getServerSession: vi.fn().mockResolvedValue({
          user: {
            id: manager.profile.id,
            email: manager.profile.email,
            role: 'manager',
            organizationId: org.id,
            mailroomId: mailroom.id
          }
        })
      }))

      await addPackageHandler(req, res)

      // **THIS WILL FAIL UNTIL INTEGRATION IS FIXED**
      // Should have created a failed log
      const { data: failedLogs } = await supabase
        .from('failed_package_logs')
        .select('*')
        .eq('mailroom_id', mailroom.id)
        .eq('first_name', 'Resolution')

      expect(failedLogs).toHaveLength(1)
      const failedLog = failedLogs![0]

      // Should be able to resolve the log (simulating admin resolution)
      const { error: resolveError } = await supabase
        .from('failed_package_logs')
        .update({
          resolved: true,
          resolved_by: manager.profile.id,
          resolved_at: new Date().toISOString(),
          notes: 'Resolved by manually creating package'
        })
        .eq('id', failedLog.id)

      expect(resolveError).toBeNull()

      // Verify resolution
      const { data: resolvedLog } = await supabase
        .from('failed_package_logs')
        .select('*')
        .eq('id', failedLog.id)
        .single()

      expect(resolvedLog.resolved).toBe(true)
      expect(resolvedLog.resolved_by).toBe(manager.profile.id)
      expect(resolvedLog.notes).toBe('Resolved by manually creating package')
    })
  })
})