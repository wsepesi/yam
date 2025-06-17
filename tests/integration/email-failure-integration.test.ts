import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { DatabaseTestHelper } from '../utils/db-test-helper'
import { getSharedAdminInstance } from '../setup'

// This test file specifically tests email send failure integration
// These tests WILL FAIL until email failure logging is properly integrated

describe('Email Send Failure Integration', () => {
  const dbHelper = DatabaseTestHelper.getInstance()
  const supabase = getSharedAdminInstance()
  
  let org: any, mailroom: any, manager: any, resident: any
  
  beforeEach(async () => {
    await dbHelper.cleanup()
    
    // Set up test data
    org = await dbHelper.createTestOrg('Email Test Org')
    mailroom = await dbHelper.createTestMailroom(org.id, 'Email Test Mailroom')
    manager = await dbHelper.createTestUser(org.id, mailroom.id, 'manager')
    resident = await dbHelper.createTestResident(mailroom.id, 'test.resident@example.com')
    
    // Clear any existing failed package logs
    await supabase.from('failed_package_logs').delete().gte('created_at', '1900-01-01')
  })
  
  afterEach(async () => {
    await dbHelper.cleanup()
  })

  describe('Email Service Integration with Failed Package Logging', () => {
    it('should directly test the sendEmailDirectlyInBackground function for failure logging', async () => {
      // Import the email function directly
      const { sendEmailDirectlyInBackground } = await import('@/lib/sendEmail')
      
      // Mock the underlying email transport to fail
      vi.doMock('nodemailer', () => ({
        createTransport: vi.fn().mockReturnValue({
          sendMail: vi.fn().mockRejectedValue(new Error('SMTP server unavailable'))
        })
      }))

      // Create a package first
      const testPackage = await dbHelper.createTestPackage(mailroom.id, resident.id, manager.profile.id)
      
      // Mock the email settings
      const emailSettings = {
        notification_email: 'test@mailroom.edu',
        notification_email_password: 'test-password',
        admin_email: 'admin@mailroom.edu',
        email_additional_text: 'Test additional text'
      }
      
      // Try to send email (this should fail and log to failed_package_logs)
      try {
        await sendEmailDirectlyInBackground(
          resident.email,
          testPackage.package_id,
          emailSettings,
          mailroom.id,
          manager.profile.id,
          'Test',
          'Resident',
          'FedEx'
        )
      } catch (error) {
        // Expected to fail
      }

      // **THIS WILL FAIL UNTIL INTEGRATION IS FIXED**
      // Should have logged the email failure to failed_package_logs
      const { data: failedLogs } = await supabase
        .from('failed_package_logs')
        .select('*')
        .eq('mailroom_id', mailroom.id)
        .eq('email', resident.email)
      
      expect(failedLogs).toHaveLength(1)
      expect(failedLogs![0]).toMatchObject({
        mailroom_id: mailroom.id,
        staff_id: manager.profile.id,
        first_name: 'Test',
        last_name: 'Resident',
        email: resident.email,
        provider: 'FedEx',
        error_details: expect.stringContaining('Email send failed: SMTP server unavailable'),
        resolved: false
      })
    })

    it('should log email failures with different error types', async () => {
      const { sendEmailDirectlyInBackground } = await import('@/lib/sendEmail')
      
      const errorScenarios = [
        {
          error: new Error('Invalid credentials'),
          expectedErrorPattern: 'Invalid credentials'
        },
        {
          error: new Error('Recipient email invalid'),
          expectedErrorPattern: 'Recipient email invalid'
        },
        {
          error: new Error('Rate limit exceeded'),
          expectedErrorPattern: 'Rate limit exceeded'
        }
      ]

      for (const [index, scenario] of errorScenarios.entries()) {
        // Mock different email failures
        vi.doMock('nodemailer', () => ({
          createTransport: vi.fn().mockReturnValue({
            sendMail: vi.fn().mockRejectedValue(scenario.error)
          })
        }))

        const testPackage = await dbHelper.createTestPackage(mailroom.id, resident.id, manager.profile.id)
        const testEmail = `test${index}@example.com`
        
        const emailSettings = {
          notification_email: 'test@mailroom.edu',
          notification_email_password: 'test-password',
          admin_email: 'admin@mailroom.edu',
          email_additional_text: 'Test additional text'
        }

        try {
          await sendEmailDirectlyInBackground(
            testEmail,
            testPackage.package_id,
            emailSettings,
            mailroom.id,
            manager.profile.id,
            'Test',
            `Scenario${index}`,
            'UPS'
          )
        } catch (error) {
          // Expected to fail
        }

        // **THIS WILL FAIL UNTIL INTEGRATION IS FIXED**
        // Should have logged this specific failure
        const { data: failedLogs } = await supabase
          .from('failed_package_logs')
          .select('*')
          .eq('mailroom_id', mailroom.id)
          .eq('email', testEmail)
        
        expect(failedLogs).toHaveLength(1)
        expect(failedLogs![0].error_details).toContain(scenario.expectedErrorPattern)
        expect(failedLogs![0].last_name).toBe(`Scenario${index}`)
      }
    })

    it('should handle email failure logging when package details are incomplete', async () => {
      const { sendEmailDirectlyInBackground } = await import('@/lib/sendEmail')
      
      // Mock email failure
      vi.doMock('nodemailer', () => ({
        createTransport: vi.fn().mockReturnValue({
          sendMail: vi.fn().mockRejectedValue(new Error('Template compilation failed'))
        })
      }))

      const testPackage = await dbHelper.createTestPackage(mailroom.id, resident.id, manager.profile.id)
      
      const emailSettings = {
        notification_email: 'test@mailroom.edu',
        notification_email_password: 'test-password',
        admin_email: 'admin@mailroom.edu',
        email_additional_text: 'Test additional text'
      }

      // Try to send email with incomplete details
      try {
        await sendEmailDirectlyInBackground(
          'incomplete@example.com',
          testPackage.package_id,
          emailSettings,
          mailroom.id,
          manager.profile.id,
          '', // Empty first name
          '', // Empty last name
          'Unknown Provider'
        )
      } catch (error) {
        // Expected to fail
      }

      // **THIS WILL FAIL UNTIL INTEGRATION IS FIXED**
      // Should handle incomplete data gracefully
      const { data: failedLogs } = await supabase
        .from('failed_package_logs')
        .select('*')
        .eq('mailroom_id', mailroom.id)
        .eq('email', 'incomplete@example.com')
      
      expect(failedLogs).toHaveLength(1)
      expect(failedLogs![0]).toMatchObject({
        mailroom_id: mailroom.id,
        staff_id: manager.profile.id,
        first_name: expect.any(String), // Should handle empty string gracefully
        last_name: expect.any(String),
        email: 'incomplete@example.com',
        provider: 'Unknown Provider',
        error_details: expect.stringContaining('Template compilation failed'),
        resolved: false
      })
    })
  })

  describe('Background Email Processing Failure Logging', () => {
    it('should log failures that occur in the background waitUntil processing', async () => {
      // This test simulates the actual background processing that happens
      // in the add-package.ts API when waitUntil() calls sendEmailDirectlyInBackground
      
      const { sendEmailDirectlyInBackground } = await import('@/lib/sendEmail')
      
      // Mock email failure
      vi.doMock('nodemailer', () => ({
        createTransport: vi.fn().mockReturnValue({
          sendMail: vi.fn().mockRejectedValue(new Error('Background processing failed'))
        })
      }))

      // Simulate the background email sending that happens after package creation
      const packageData = {
        mailroom_id: mailroom.id,
        staff_id: manager.profile.id,
        resident_id: resident.id,
        package_id: 123,
        provider: 'FedEx'
      }

      const emailSettings = {
        notification_email: 'test@mailroom.edu',
        notification_email_password: 'test-password',
        admin_email: 'admin@mailroom.edu',
        email_additional_text: 'Test additional text'
      }

      // Simulate the background processing (this is what happens in waitUntil)
      const backgroundTask = async () => {
        try {
          await sendEmailDirectlyInBackground(
            'background@example.com',
            packageData.package_id,
            emailSettings,
            packageData.mailroom_id,
            packageData.staff_id,
            'Background',
            'Test',
            packageData.provider
          )
        } catch (error) {
          // **THIS IS WHERE THE INTEGRATION SHOULD LOG TO failed_package_logs**
          // Currently it only logs to console
          console.error('Background email failed:', error)
        }
      }

      await backgroundTask()

      // **THIS WILL FAIL UNTIL INTEGRATION IS FIXED**
      // Background failures should be logged to database
      const { data: failedLogs } = await supabase
        .from('failed_package_logs')
        .select('*')
        .eq('mailroom_id', mailroom.id)
        .eq('email', 'background@example.com')
      
      expect(failedLogs).toHaveLength(1)
      expect(failedLogs![0]).toMatchObject({
        mailroom_id: mailroom.id,
        staff_id: manager.profile.id,
        first_name: 'Background',
        last_name: 'Test',
        email: 'background@example.com',
        provider: 'FedEx',
        error_details: expect.stringContaining('Background processing failed'),
        resolved: false
      })
    })
  })

  describe('Failed Email Log Querying and Management', () => {
    it('should allow querying failed email logs for admin review', async () => {
      // Manually create some failed email logs to test querying
      const failedLogs = [
        {
          mailroom_id: mailroom.id,
          staff_id: manager.profile.id,
          first_name: 'Email',
          last_name: 'Failure1',
          email: 'failure1@example.com',
          resident_id: 'res1',
          provider: 'FedEx',
          error_details: 'Email send failed: SMTP timeout',
          resolved: false
        },
        {
          mailroom_id: mailroom.id,
          staff_id: manager.profile.id,
          first_name: 'Email',
          last_name: 'Failure2',
          email: 'failure2@example.com',
          resident_id: 'res2',
          provider: 'UPS',
          error_details: 'Email send failed: Invalid recipient',
          resolved: false
        }
      ]

      await supabase.from('failed_package_logs').insert(failedLogs)

      // Query unresolved email failures
      const { data: unresolvedFailures } = await supabase
        .from('failed_package_logs')
        .select('*')
        .eq('mailroom_id', mailroom.id)
        .eq('resolved', false)
        .like('error_details', '%Email send failed%')
        .order('created_at', { ascending: false })

      expect(unresolvedFailures).toHaveLength(2)
      expect(unresolvedFailures![0].last_name).toBe('Failure2') // Most recent first
      expect(unresolvedFailures![1].last_name).toBe('Failure1')

      // Test resolution workflow
      await supabase
        .from('failed_package_logs')
        .update({
          resolved: true,
          resolved_by: manager.profile.id,
          resolved_at: new Date().toISOString(),
          notes: 'Manually sent email notification'
        })
        .eq('id', unresolvedFailures![0].id)

      // Verify only one unresolved remains
      const { data: stillUnresolved } = await supabase
        .from('failed_package_logs')
        .select('*')
        .eq('mailroom_id', mailroom.id)
        .eq('resolved', false)

      expect(stillUnresolved).toHaveLength(1)
      expect(stillUnresolved![0].last_name).toBe('Failure1')
    })
  })
})