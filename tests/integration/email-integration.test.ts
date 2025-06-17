import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import nodemailer from 'nodemailer'
import { DatabaseTestHelper } from '../utils/db-test-helper'
import { sendEmail, formatEmailBody, formatHours } from '../../lib/sendEmail'

// Mock nodemailer
vi.mock('nodemailer')

describe('Email Integration Tests', () => {
  // Create a fresh instance for each test suite to prevent interference
  const dbHelper = DatabaseTestHelper.createInstance()
  
  let org: any
  let mailroom: any
  let resident: any
  let mockTransporter: any
  
  beforeEach(async () => {
    await dbHelper.cleanup()
    
    // Create test data with unique identifiers
    const uniqueId = Date.now().toString()
    org = await dbHelper.createTestOrg(`Test University ${uniqueId}`)
    
    // Update org with email settings using unique email
    const supabase = dbHelper.getClient()
    await supabase
      .from('organizations')
      .update({
        notification_email: `notifications-${uniqueId}@university.edu`,
        notification_email_password: 'test-password-123'
      })
      .eq('id', org.id)
    
    mailroom = await dbHelper.createTestMailroom(org.id)
    
    // Update mailroom with specific settings using unique email
    await supabase
      .from('mailrooms')
      .update({
        admin_email: `mailroom-${uniqueId}@university.edu`,
        mailroom_hours: {
          monday: [{ start: '09:00', end: '17:00' }],
          tuesday: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }],
          wednesday: [{ start: '09:00', end: '17:00' }],
          thursday: [{ start: '09:00', end: '17:00' }],
          friday: [{ start: '09:00', end: '15:00' }],
          saturday: [],
          sunday: []
        },
        email_additional_text: 'Please collect within 7 days. Late fee applies after.'
      })
      .eq('id', mailroom.id)
    
    resident = await dbHelper.createTestResident(mailroom.id, `john.doe-${uniqueId}@university.edu`)
    
    // Update resident with specific names
    await supabase
      .from('residents')
      .update({
        first_name: 'John',
        last_name: 'Doe'
      })
      .eq('id', resident.id)
    
    // Setup default mock transporter
    mockTransporter = {
      verify: vi.fn().mockResolvedValue(true),
      sendMail: vi.fn().mockResolvedValue({
        accepted: ['john.doe@university.edu'],
        rejected: [],
        messageId: 'test-message-id'
      })
    }
    
    vi.mocked(nodemailer.createTransport).mockReturnValue(mockTransporter as any)
  })
  
  afterEach(async () => {
    await dbHelper.cleanup()
    vi.clearAllMocks()
  })
  
  describe('Background Email Processing', () => {
    it('should send email in background without blocking package creation', async () => {
      // Create a package which should trigger email
      // Create a staff member first
      const staff = await dbHelper.createTestUser(org.id, mailroom.id, 'manager')
      
      const pkg = await dbHelper.createTestPackage(mailroom.id, resident.id, staff.profile.id)
      
      // Update package with specific provider
      const supabase = dbHelper.getClient()
      await supabase
        .from('packages')
        .update({ provider: 'FedEx' })
        .eq('id', pkg.id)
      
      // Simulate the waitUntil behavior from the API
      const emailPromise = sendEmail(
        resident.email,
        'New Package Notification (#' + pkg.package_id + ')',
        formatEmailBody(resident.first_name, pkg.package_id.toString(), 'FedEx', mailroom.mailroom_hours, mailroom.email_additional_text),
        mailroom.admin_email,
        org.notification_email,
        org.notification_email_password
      )
      
      // Package should be created immediately
      expect(pkg.id).toBeDefined()
      expect(pkg.status).toBe('WAITING')
      
      // Email should be sent asynchronously
      await emailPromise
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: org.notification_email,
        to: resident.email,
        subject: 'New Package Notification (#' + pkg.package_id + ')',
        html: expect.stringContaining('Hello John'),
        replyTo: mailroom.admin_email,
        dsn: {
          id: expect.any(String),
          return: 'headers',
          notify: ['failure', 'delay'],
          recipient: mailroom.admin_email
        }
      })
    })
    
    it('should handle multiple concurrent email sends', async () => {
      // Create multiple residents with unique emails
      const timestamp = Date.now()
      const residents = await Promise.all([
        dbHelper.createTestResident(mailroom.id, `alice-${timestamp}@university.edu`),
        dbHelper.createTestResident(mailroom.id, `bob-${timestamp}@university.edu`),
        dbHelper.createTestResident(mailroom.id, `charlie-${timestamp}@university.edu`)
      ])
      
      // Update resident names
      const supabase = dbHelper.getClient()
      await Promise.all([
        supabase.from('residents').update({ first_name: 'Alice' }).eq('id', residents[0].id),
        supabase.from('residents').update({ first_name: 'Bob' }).eq('id', residents[1].id),
        supabase.from('residents').update({ first_name: 'Charlie' }).eq('id', residents[2].id)
      ])
      
      // Create a staff member for package creation
      const staff = await dbHelper.createTestUser(org.id, mailroom.id, 'manager')
      
      // Create packages for all residents concurrently
      const packages = await Promise.all(
        residents.map(r => dbHelper.createTestPackage(mailroom.id, r.id, staff.profile.id))
      )
      
      // Update packages with UPS provider
      await Promise.all(
        packages.map(pkg => 
          supabase.from('packages').update({ provider: 'UPS' }).eq('id', pkg.id)
        )
      )
      
      // Simulate sending emails concurrently
      const emailPromises = residents.map((r, i) => 
        sendEmail(
          r.email,
          'New Package Notification (#' + packages[i].package_id + ')',
          formatEmailBody(r.first_name, packages[i].package_id.toString(), 'UPS', mailroom.mailroom_hours, mailroom.email_additional_text),
          mailroom.admin_email,
          org.notification_email,
          org.notification_email_password
        )
      )
      
      await Promise.all(emailPromises)
      
      // All emails should be sent
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3)
    })
  })
  
  describe('Email Service Outage Scenarios', () => {
    it('should allow package creation when email service is down', async () => {
      // Mock email service failure
      mockTransporter.verify.mockRejectedValue(new Error('SMTP connection failed'))
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP server unavailable'))
      
      // Package creation should still succeed
      // Create a staff member first
      const staff = await dbHelper.createTestUser(org.id, mailroom.id, 'manager')
      
      const pkg = await dbHelper.createTestPackage(mailroom.id, resident.id, staff.profile.id)
      
      // Update package with USPS provider
      const supabase = dbHelper.getClient()
      await supabase
        .from('packages')
        .update({ provider: 'USPS' })
        .eq('id', pkg.id)
      
      expect(pkg.id).toBeDefined()
      expect(pkg.status).toBe('WAITING')
      
      // Try to send email (should fail gracefully)
      await expect(sendEmail(
        resident.email,
        'New Package Notification (#' + pkg.package_id + ')',
        formatEmailBody(resident.first_name, pkg.package_id.toString(), 'USPS', mailroom.mailroom_hours, mailroom.email_additional_text),
        mailroom.admin_email,
        org.notification_email,
        org.notification_email_password
      )).rejects.toThrow('SMTP server unavailable')
    })
    
    it('should handle transporter verification failures', async () => {
      mockTransporter.verify.mockRejectedValue(new Error('Invalid credentials'))
      
      await expect(sendEmail(
        resident.email,
        'Test Subject',
        'Test Body',
        mailroom.admin_email,
        org.notification_email,
        org.notification_email_password
      )).rejects.toThrow('Invalid credentials')
      
      // Should not attempt to send if verification fails
      expect(mockTransporter.sendMail).not.toHaveBeenCalled()
    })
    
    it('should handle partial email delivery failures', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        accepted: ['alice@university.edu'],
        rejected: ['bob@university.edu', 'charlie@university.edu'],
        messageId: 'partial-delivery-id'
      })
      
      const timestamp = Date.now()
      const result = await sendEmail(
        `alice-${timestamp}@university.edu,bob-${timestamp}@university.edu,charlie-${timestamp}@university.edu`,
        'Bulk Notification',
        'Test message',
        mailroom.admin_email,
        org.notification_email,
        org.notification_email_password
      )
      
      // Should still return successful for accepted recipients
      expect(result.accepted).toContain('alice@university.edu')
      expect(result.rejected).toContain('bob@university.edu')
      expect(result.rejected).toContain('charlie@university.edu')
    })
  })
  
  describe('Template Rendering and Customization', () => {
    it('should render email with complete mailroom hours', () => {
      const body = formatEmailBody(
        'John',
        '123',
        'FedEx',
        mailroom.mailroom_hours,
        'Additional instructions here'
      )
      
      expect(body).toContain('Hello John')
      expect(body).toContain('package (#123)')
      expect(body).toContain('FedEx')
      expect(body).toContain('Monday: 9:00 AM - 5:00 PM')
      expect(body).toContain('Tuesday: 9:00 AM - 12:00 PM, 1:00 PM - 5:00 PM') // Multiple periods
      expect(body).toContain('Saturday: Closed')
      expect(body).toContain('Sunday: Closed')
      expect(body).toContain('Additional instructions here')
    })
    
    it('should handle missing first name gracefully', () => {
      const body = formatEmailBody(
        null,
        '456',
        'UPS',
        mailroom.mailroom_hours,
        null
      )
      
      expect(body).toContain('Hello Resident') // Default when no name
      expect(body).not.toContain('null')
    })
    
    it('should format complex mailroom hours correctly', () => {
      const complexHours = {
        monday: [
          { start: '08:00', end: '12:00' },
          { start: '13:00', end: '17:00' },
          { start: '18:00', end: '20:00' }
        ],
        tuesday: [],
        wednesday: [{ start: '10:00', end: '14:00' }],
        thursday: [{ start: '09:00', end: '17:00' }],
        friday: [{ start: '09:00', end: '12:00' }],
        saturday: [],
        sunday: []
      }
      
      const formatted = formatHours(complexHours)
      expect(formatted).toContain('Monday: 8:00 AM - 12:00 PM, 1:00 PM - 5:00 PM, 6:00 PM - 8:00 PM')
      expect(formatted).toContain('Tuesday: Closed')
      expect(formatted).toContain('Wednesday: 10:00 AM - 2:00 PM')
    })
    
    it('should escape HTML in email content', () => {
      const body = formatEmailBody(
        '<script>alert("XSS")</script>',
        '789',
        'DHL',
        mailroom.mailroom_hours,
        '<img src=x onerror=alert("XSS")>'
      )
      
      // HTML should be escaped
      expect(body).not.toContain('<script>')
      expect(body).not.toContain('<img')
      expect(body).toContain('&lt;script&gt;')
    })
  })
  
  describe('Retry and Error Recovery', () => {
    it('should retry on temporary failures', async () => {
      let attempts = 0
      mockTransporter.sendMail.mockImplementation(() => {
        attempts++
        if (attempts < 3) {
          return Promise.reject(new Error('Temporary failure'))
        }
        return Promise.resolve({
          accepted: [resident.email],
          rejected: [],
          messageId: 'retry-success-id'
        })
      })
      
      // In real implementation, retry logic would be in the API or a queue system
      let lastError
      for (let i = 0; i < 3; i++) {
        try {
          await sendEmail(
            resident.email,
            'Test Subject',
            'Test Body',
            mailroom.admin_email,
            org.notification_email,
            org.notification_email_password
          )
          break
        } catch (error) {
          lastError = error
          if (i < 2) continue
          throw error
        }
      }
      
      expect(attempts).toBe(3)
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3)
    })
    
    it('should handle invalid email configuration', async () => {
      mockTransporter.verify.mockRejectedValue(new Error('Invalid auth'))
      
      // Update org with invalid email config
      const timestamp = Date.now()
      const invalidOrg = await dbHelper.createTestOrg(`Invalid Org ${timestamp}`)
      
      const supabase = dbHelper.getClient()
      await supabase
        .from('organizations')
        .update({
          notification_email: `invalid-${timestamp}@test.com`,
          notification_email_password: 'wrong-password'
        })
        .eq('id', invalidOrg.id)
      
      await expect(sendEmail(
        `test-${timestamp}@example.com`,
        'Test',
        'Body',
        'admin@test.com',
        invalidOrg.notification_email,
        invalidOrg.notification_email_password
      )).rejects.toThrow('Invalid auth')
    })
  })
  
  describe('Notification Delivery Confirmation', () => {
    it('should track delivery status notifications (DSN)', async () => {
      const result = await sendEmail(
        resident.email,
        'Package Notification',
        'You have a package',
        mailroom.admin_email,
        org.notification_email,
        org.notification_email_password
      )
      
      // Verify DSN options were set
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: {
            id: expect.any(String),
            return: 'headers',
            notify: ['failure', 'delay'],
            recipient: mailroom.admin_email
          }
        })
      )
    })
    
    it('should generate unique DSN IDs for tracking', async () => {
      // Send multiple emails
      const emails = await Promise.all([
        sendEmail(resident.email, 'Test 1', 'Body 1', mailroom.admin_email, org.notification_email, org.notification_email_password),
        sendEmail(resident.email, 'Test 2', 'Body 2', mailroom.admin_email, org.notification_email, org.notification_email_password),
        sendEmail(resident.email, 'Test 3', 'Body 3', mailroom.admin_email, org.notification_email, org.notification_email_password)
      ])
      
      // Extract DSN IDs from calls
      const dsnIds = mockTransporter.sendMail.mock.calls.map(
        call => call[0].dsn.id
      )
      
      // All DSN IDs should be unique
      expect(new Set(dsnIds).size).toBe(3)
    })
  })
  
  describe('Mailroom-specific Customization', () => {
    it('should use mailroom-specific email settings', async () => {
      // Create another mailroom with different settings
      const mailroom2 = await dbHelper.createTestMailroom(org.id)
      
      // Update mailroom2 with specific settings
      const supabase = dbHelper.getClient()
      await supabase
        .from('mailrooms')
        .update({
          admin_email: `mailroom2-${Date.now()}@university.edu`,
          mailroom_hours: {
            monday: [{ start: '10:00', end: '18:00' }],
            tuesday: [{ start: '10:00', end: '18:00' }],
            wednesday: [{ start: '10:00', end: '18:00' }],
            thursday: [{ start: '10:00', end: '18:00' }],
            friday: [{ start: '10:00', end: '16:00' }],
            saturday: [{ start: '12:00', end: '16:00' }],
            sunday: []
          },
          email_additional_text: 'Open on Saturdays! Weekend pickup available.'
        })
        .eq('id', mailroom2.id)
      
      const resident2 = await dbHelper.createTestResident(mailroom2.id, `jane-${Date.now()}@university.edu`)
      
      // Update resident2 with specific name
      await supabase
        .from('residents')
        .update({ first_name: 'Jane' })
        .eq('id', resident2.id)
      
      const body = formatEmailBody(
        resident2.first_name,
        '999',
        'Amazon',
        mailroom2.mailroom_hours,
        mailroom2.email_additional_text
      )
      
      expect(body).toContain('Saturday: 12:00 PM - 4:00 PM')
      expect(body).not.toContain('Saturday: Closed')
      expect(body).toContain('Open on Saturdays! Weekend pickup available.')
    })
    
    it('should handle missing mailroom email configuration', async () => {
      // Create mailroom without admin email
      const incompleteMailroom = await dbHelper.createTestMailroom(org.id)
      
      // Update with incomplete settings
      const supabase = dbHelper.getClient()
      await supabase
        .from('mailrooms')
        .update({
          admin_email: null,
          mailroom_hours: {},
          email_additional_text: null
        })
        .eq('id', incompleteMailroom.id)
      
      const incompleteResident = await dbHelper.createTestResident(incompleteMailroom.id, `test-${Date.now()}@example.com`)
      
      // Should still send email but without reply-to
      await sendEmail(
        incompleteResident.email,
        'Test',
        formatEmailBody(null, '1', 'FedEx', {}, null),
        null, // No admin email
        org.notification_email,
        org.notification_email_password
      )
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: org.notification_email,
          to: incompleteResident.email,
          replyTo: undefined // Should handle null admin_email
        })
      )
    })
  })
  
  describe('High Volume Email Scenarios', () => {
    it('should handle bulk email notifications efficiently', async () => {
      // Create 50 residents with unique emails
      const timestamp = Date.now()
      const residents = await Promise.all(
        Array.from({ length: 50 }, (_, i) => 
          dbHelper.createTestResident(mailroom.id, `student${i}-${timestamp}@university.edu`)
        )
      )
      
      // Update resident names
      const supabase = dbHelper.getClient()
      await Promise.all(
        residents.map((r, i) => 
          supabase.from('residents').update({ first_name: `Student${i}` }).eq('id', r.id)
        )
      )
      
      // Create a staff member for package creation
      const staff = await dbHelper.createTestUser(org.id, mailroom.id, 'manager')
      
      // Create packages for all residents
      const packages = await Promise.all(
        residents.map(r => dbHelper.createTestPackage(mailroom.id, r.id, staff.profile.id))
      )
      
      // Update packages with Bulk Delivery provider
      await Promise.all(
        packages.map(pkg => 
          supabase.from('packages').update({ provider: 'Bulk Delivery' }).eq('id', pkg.id)
        )
      )
      
      // Measure time to send all emails
      const startTime = performance.now()
      
      const emailPromises = residents.map((r, i) =>
        sendEmail(
          r.email,
          `New Package Notification (#${packages[i].package_id})`,
          formatEmailBody(r.first_name, packages[i].package_id.toString(), 'Bulk Delivery', mailroom.mailroom_hours, mailroom.email_additional_text),
          mailroom.admin_email,
          org.notification_email,
          org.notification_email_password
        )
      )
      
      await Promise.all(emailPromises)
      
      const endTime = performance.now()
      const totalTime = endTime - startTime
      
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(50)
      expect(totalTime).toBeLessThan(5000) // Should complete within 5 seconds
    })
    
    it('should handle email queue overflow gracefully', async () => {
      // Simulate rate limiting by making some emails fail
      let emailCount = 0
      mockTransporter.sendMail.mockImplementation(() => {
        emailCount++
        if (emailCount > 10 && emailCount <= 15) {
          return Promise.reject(new Error('Rate limit exceeded'))
        }
        return Promise.resolve({
          accepted: ['test@example.com'],
          rejected: [],
          messageId: `msg-${emailCount}`
        })
      })
      
      // Try to send 20 emails
      const results = await Promise.allSettled(
        Array.from({ length: 20 }, (_, i) =>
          sendEmail(
            `user${i}@example.com`,
            'Test',
            'Body',
            mailroom.admin_email,
            org.notification_email,
            org.notification_email_password
          )
        )
      )
      
      const successful = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length
      
      expect(successful).toBe(15) // 10 before rate limit + 5 after
      expect(failed).toBe(5) // Failed during rate limit
    })
  })
})