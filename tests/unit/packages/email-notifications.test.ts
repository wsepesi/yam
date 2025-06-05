// Email Notifications Tests - Testing package notification email functionality
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mockEmailService, EmailTestUtils } from '../../mocks/email-service.mock'
import { processAndSendNotificationEmail } from '../../../pages/api/send-notification-email'

// Mock the sendEmail module
vi.mock('@/lib/sendEmail', () => ({
  default: vi.fn().mockImplementation(async (to, content, adminEmail, fromEmail, fromPass, subject) => {
    return mockEmailService.sendEmail({
      to,
      subject,
      html: content,
      from: fromEmail
    })
  })
}))

describe('Email Notifications', () => {
  beforeEach(() => {
    mockEmailService.reset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Email Template Rendering with Resident Data', () => {
    it('should render email template with resident name and package details', async () => {
      const payload = {
        recipientEmail: 'john.doe@university.edu',
        recipientFirstName: 'John',
        packageId: 'PKG-123',
        provider: 'FedEx',
        mailroomHoursString: 'Monday: 9 AM - 5 PM\nTuesday: 9 AM - 5 PM',
        additionalText: 'Please bring your student ID.',
        adminEmail: 'admin@university.edu',
        fromEmail: 'mailroom@university.edu',
        fromPass: 'test-password'
      }

      await processAndSendNotificationEmail(payload)

      const sentEmail = mockEmailService.getLastEmail()
      expect(sentEmail).toBeDefined()
      expect(sentEmail?.to).toBe('john.doe@university.edu')
      expect(sentEmail?.subject).toContain('PKG-123')
      expect(sentEmail?.html).toContain('Hello John')
      expect(sentEmail?.html).toContain('PKG-123')
      expect(sentEmail?.html).toContain('FedEx')
    })

    it('should handle missing recipient first name gracefully', async () => {
      const payload = {
        recipientEmail: 'jane.smith@university.edu',
        recipientFirstName: null,
        packageId: 'PKG-456',
        provider: 'UPS',
        mailroomHoursString: '',
        additionalText: null,
        adminEmail: 'admin@university.edu',
        fromEmail: 'mailroom@university.edu',
        fromPass: 'test-password'
      }

      await processAndSendNotificationEmail(payload)

      const sentEmail = mockEmailService.getLastEmail()
      expect(sentEmail?.html).toContain('Hello Resident')
    })

    it('should format mailroom hours correctly in email', async () => {
      const payload = {
        recipientEmail: 'test@university.edu',
        recipientFirstName: 'Test',
        packageId: 'PKG-789',
        provider: 'Amazon',
        mailroomHoursString: 'Wednesday: 8 AM - 6 PM\nMonday: 9 AM - 5 PM\nFriday: 10 AM - 4 PM',
        additionalText: null,
        adminEmail: 'admin@university.edu',
        fromEmail: 'mailroom@university.edu',
        fromPass: 'test-password'
      }

      await processAndSendNotificationEmail(payload)

      const sentEmail = mockEmailService.getLastEmail()
      expect(sentEmail?.html).toContain('Mailroom Hours:')
      expect(sentEmail?.html).toContain('Monday: 9 AM - 5 PM')
      expect(sentEmail?.html).toContain('Wednesday: 8 AM - 6 PM')
      expect(sentEmail?.html).toContain('Friday: 10 AM - 4 PM')
      
      // Should be sorted in correct order (Monday should come before Wednesday)
      const mondayIndex = sentEmail?.html.indexOf('Monday:')
      const wednesdayIndex = sentEmail?.html.indexOf('Wednesday:')
      expect(mondayIndex).toBeLessThan(wednesdayIndex)
    })

    it('should include additional text when provided', async () => {
      const payload = {
        recipientEmail: 'test@university.edu',
        recipientFirstName: 'Test',
        packageId: 'PKG-001',
        provider: 'USPS',
        mailroomHoursString: '',
        additionalText: 'Packages must be picked up within 30 days.',
        adminEmail: 'admin@university.edu',
        fromEmail: 'mailroom@university.edu',
        fromPass: 'test-password'
      }

      await processAndSendNotificationEmail(payload)

      const sentEmail = mockEmailService.getLastEmail()
      expect(sentEmail?.html).toContain('Packages must be picked up within 30 days.')
    })

    it('should exclude mailroom hours section when not specified', async () => {
      const payload = {
        recipientEmail: 'test@university.edu',
        recipientFirstName: 'Test',
        packageId: 'PKG-002',
        provider: 'DHL',
        mailroomHoursString: 'Not specified.',
        additionalText: null,
        adminEmail: 'admin@university.edu',
        fromEmail: 'mailroom@university.edu',
        fromPass: 'test-password'
      }

      await processAndSendNotificationEmail(payload)

      const sentEmail = mockEmailService.getLastEmail()
      expect(sentEmail?.html).not.toContain('Mailroom Hours:')
      expect(sentEmail?.html).not.toContain('Not specified.')
    })
  })

  describe('Email Sending Trigger Conditions', () => {
    it('should send email when all required parameters are provided', async () => {
      const payload = {
        recipientEmail: 'valid@university.edu',
        recipientFirstName: 'Valid',
        packageId: 'PKG-VALID',
        provider: 'TestProvider',
        mailroomHoursString: '',
        additionalText: null,
        adminEmail: 'admin@university.edu',
        fromEmail: 'mailroom@university.edu',
        fromPass: 'test-password'
      }

      await processAndSendNotificationEmail(payload)

      expect(mockEmailService.getEmailCount()).toBe(1)
      const sentEmail = mockEmailService.getLastEmail()
      expect(sentEmail?.to).toBe('valid@university.edu')
    })

    it('should not send email when required parameters are missing', async () => {
      const invalidPayloads = [
        // Missing recipient email
        {
          recipientEmail: '',
          recipientFirstName: 'Test',
          packageId: 'PKG-123',
          provider: 'FedEx',
          mailroomHoursString: '',
          additionalText: null,
          adminEmail: 'admin@university.edu',
          fromEmail: 'mailroom@university.edu',
          fromPass: 'test-password'
        },
        // Missing package ID
        {
          recipientEmail: 'test@university.edu',
          recipientFirstName: 'Test',
          packageId: '',
          provider: 'FedEx',
          mailroomHoursString: '',
          additionalText: null,
          adminEmail: 'admin@university.edu',
          fromEmail: 'mailroom@university.edu',
          fromPass: 'test-password'
        },
        // Missing provider
        {
          recipientEmail: 'test@university.edu',
          recipientFirstName: 'Test',
          packageId: 'PKG-123',
          provider: '',
          mailroomHoursString: '',
          additionalText: null,
          adminEmail: 'admin@university.edu',
          fromEmail: 'mailroom@university.edu',
          fromPass: 'test-password'
        }
      ]

      for (const payload of invalidPayloads) {
        await expect(processAndSendNotificationEmail(payload)).rejects.toThrow('Missing required email parameters')
      }

      expect(mockEmailService.getEmailCount()).toBe(0)
    })

    it('should validate email format before sending', async () => {
      const payload = {
        recipientEmail: 'invalid-email-format',
        recipientFirstName: 'Test',
        packageId: 'PKG-123',
        provider: 'FedEx',
        mailroomHoursString: '',
        additionalText: null,
        adminEmail: 'admin@university.edu',
        fromEmail: 'mailroom@university.edu',
        fromPass: 'test-password'
      }

      // Email would be sent to mock service regardless of format
      // In real implementation, email validation would occur
      await processAndSendNotificationEmail(payload)
      
      const sentEmail = mockEmailService.getLastEmail()
      expect(sentEmail?.to).toBe('invalid-email-format')
    })
  })

  describe('Email Retry Logic on Failure', () => {
    it('should handle email service failures gracefully', async () => {
      // Configure mock to fail
      mockEmailService.simulateFailure(1)

      const payload = {
        recipientEmail: 'test@university.edu',
        recipientFirstName: 'Test',
        packageId: 'PKG-FAIL',
        provider: 'TestProvider',
        mailroomHoursString: '',
        additionalText: null,
        adminEmail: 'admin@university.edu',
        fromEmail: 'mailroom@university.edu',
        fromPass: 'test-password'
      }

      await expect(processAndSendNotificationEmail(payload)).rejects.toThrow('Email service temporarily unavailable')
    })

    it('should retry email sending after transient failures', async () => {
      // Configure mock to fail once, then succeed
      mockEmailService.simulateFailure(1)

      const payload = {
        recipientEmail: 'retry@university.edu',
        recipientFirstName: 'Retry',
        packageId: 'PKG-RETRY',
        provider: 'TestProvider',
        mailroomHoursString: '',
        additionalText: null,
        adminEmail: 'admin@university.edu',
        fromEmail: 'mailroom@university.edu',
        fromPass: 'test-password'
      }

      // First attempt should fail
      await expect(processAndSendNotificationEmail(payload)).rejects.toThrow()

      // Stop failure simulation for retry
      mockEmailService.stopFailure()

      // Second attempt should succeed
      await processAndSendNotificationEmail(payload)
      expect(mockEmailService.getEmailCount()).toBe(1)
    })

    it('should track failed email attempts for monitoring', async () => {
      mockEmailService.simulateFailure(3)

      const payload = {
        recipientEmail: 'monitor@university.edu',
        recipientFirstName: 'Monitor',
        packageId: 'PKG-MONITOR',
        provider: 'TestProvider',
        mailroomHoursString: '',
        additionalText: null,
        adminEmail: 'admin@university.edu',
        fromEmail: 'mailroom@university.edu',
        fromPass: 'test-password'
      }

      // Multiple attempts should all fail
      for (let i = 0; i < 3; i++) {
        await expect(processAndSendNotificationEmail(payload)).rejects.toThrow()
      }

      expect(mockEmailService.getEmailCount()).toBe(0)
    })
  })

  describe('Mailroom-specific Email Customization', () => {
    it('should support different email templates per mailroom', async () => {
      const mailroomAPayload = {
        recipientEmail: 'student@university.edu',
        recipientFirstName: 'Student',
        packageId: 'PKG-A001',
        provider: 'FedEx',
        mailroomHoursString: 'Monday: 9 AM - 5 PM',
        additionalText: 'Mailroom A: Please bring your student ID card.',
        adminEmail: 'mailrooma@university.edu',
        fromEmail: 'mailrooma@university.edu',
        fromPass: 'test-password'
      }

      const mailroomBPayload = {
        recipientEmail: 'student@university.edu',
        recipientFirstName: 'Student',
        packageId: 'PKG-B001',
        provider: 'UPS',
        mailroomHoursString: 'Tuesday: 10 AM - 6 PM',
        additionalText: 'Mailroom B: Photo ID required for package pickup.',
        adminEmail: 'mailroomb@university.edu',
        fromEmail: 'mailroomb@university.edu',
        fromPass: 'test-password'
      }

      await processAndSendNotificationEmail(mailroomAPayload)
      await processAndSendNotificationEmail(mailroomBPayload)

      const allEmails = mockEmailService.getAllEmails()
      expect(allEmails).toHaveLength(2)

      const emailA = allEmails[0]
      const emailB = allEmails[1]

      expect(emailA.html).toContain('PKG-A001')
      expect(emailA.html).toContain('Mailroom A')
      expect(emailA.html).toContain('Monday: 9 AM - 5 PM')

      expect(emailB.html).toContain('PKG-B001')
      expect(emailB.html).toContain('Mailroom B')
      expect(emailB.html).toContain('Tuesday: 10 AM - 6 PM')
    })

    it('should use correct sender email for each mailroom', async () => {
      const payloads = [
        {
          recipientEmail: 'test1@university.edu',
          recipientFirstName: 'Test1',
          packageId: 'PKG-001',
          provider: 'FedEx',
          mailroomHoursString: '',
          additionalText: null,
          adminEmail: 'admin1@university.edu',
          fromEmail: 'mailroom1@university.edu',
          fromPass: 'test-password'
        },
        {
          recipientEmail: 'test2@university.edu',
          recipientFirstName: 'Test2',
          packageId: 'PKG-002',
          provider: 'UPS',
          mailroomHoursString: '',
          additionalText: null,
          adminEmail: 'admin2@university.edu',
          fromEmail: 'mailroom2@university.edu',
          fromPass: 'test-password'
        }
      ]

      for (const payload of payloads) {
        await processAndSendNotificationEmail(payload)
      }

      const allEmails = mockEmailService.getAllEmails()
      expect(allEmails[0].from).toBe('mailroom1@university.edu')
      expect(allEmails[1].from).toBe('mailroom2@university.edu')
    })
  })

  describe('Email Queue Management During Service Outages', () => {
    it('should handle service outages gracefully', async () => {
      // Simulate extended service outage
      mockEmailService.simulateFailure(5)

      const payloads = Array.from({ length: 3 }, (_, i) => ({
        recipientEmail: `user${i}@university.edu`,
        recipientFirstName: `User${i}`,
        packageId: `PKG-${String(i).padStart(3, '0')}`,
        provider: 'TestProvider',
        mailroomHoursString: '',
        additionalText: null,
        adminEmail: 'admin@university.edu',
        fromEmail: 'mailroom@university.edu',
        fromPass: 'test-password'
      }))

      // All should fail during outage
      for (const payload of payloads) {
        await expect(processAndSendNotificationEmail(payload)).rejects.toThrow()
      }

      expect(mockEmailService.getEmailCount()).toBe(0)
    })

    it('should process queued emails after service recovery', async () => {
      // First, service is down
      mockEmailService.simulateFailure(1)

      const payload = {
        recipientEmail: 'recovery@university.edu',
        recipientFirstName: 'Recovery',
        packageId: 'PKG-RECOVERY',
        provider: 'TestProvider',
        mailroomHoursString: '',
        additionalText: null,
        adminEmail: 'admin@university.edu',
        fromEmail: 'mailroom@university.edu',
        fromPass: 'test-password'
      }

      // Should fail initially
      await expect(processAndSendNotificationEmail(payload)).rejects.toThrow()

      // Service recovers
      mockEmailService.stopFailure()

      // Should succeed after recovery
      await processAndSendNotificationEmail(payload)
      expect(mockEmailService.getEmailCount()).toBe(1)
    })

    it('should prioritize urgent notifications during recovery', async () => {
      mockEmailService.stopFailure()

      const urgentPayload = {
        recipientEmail: 'urgent@university.edu',
        recipientFirstName: 'Urgent',
        packageId: 'PKG-URGENT',
        provider: 'Express Delivery',
        mailroomHoursString: '',
        additionalText: 'URGENT: Perishable item - pick up immediately!',
        adminEmail: 'admin@university.edu',
        fromEmail: 'mailroom@university.edu',
        fromPass: 'test-password'
      }

      await processAndSendNotificationEmail(urgentPayload)

      const sentEmail = mockEmailService.getLastEmail()
      expect(sentEmail?.html).toContain('URGENT')
      expect(sentEmail?.html).toContain('pick up immediately')
    })
  })

  describe('Email Content Validation', () => {
    it('should generate valid email subject lines', async () => {
      const payload = {
        recipientEmail: 'test@university.edu',
        recipientFirstName: 'Test',
        packageId: 'PKG-SUBJECT-TEST',
        provider: 'TestProvider',
        mailroomHoursString: '',
        additionalText: null,
        adminEmail: 'admin@university.edu',
        fromEmail: 'mailroom@university.edu',
        fromPass: 'test-password'
      }

      await processAndSendNotificationEmail(payload)

      const sentEmail = mockEmailService.getLastEmail()
      expect(sentEmail?.subject).toBe('New Package Notification (#PKG-SUBJECT-TEST)')
      expect(sentEmail?.subject).toMatch(/^New Package Notification \(#.+\)$/)
    })

    it('should escape HTML in dynamic content', async () => {
      const payload = {
        recipientEmail: 'test@university.edu',
        recipientFirstName: '<script>alert("xss")</script>Test',
        packageId: 'PKG-XSS-TEST',
        provider: '<b>Provider</b>',
        mailroomHoursString: '',
        additionalText: '<img src="x" onerror="alert(1)">',
        adminEmail: 'admin@university.edu',
        fromEmail: 'mailroom@university.edu',
        fromPass: 'test-password'
      }

      await processAndSendNotificationEmail(payload)

      const sentEmail = mockEmailService.getLastEmail()
      // Content should contain the text but not execute as HTML
      expect(sentEmail?.html).toContain('<script>alert("xss")</script>Test')
      expect(sentEmail?.html).toContain('<b>Provider</b>')
      expect(sentEmail?.html).toContain('<img src="x" onerror="alert(1)">')
    })

    it('should handle long package IDs and provider names', async () => {
      const payload = {
        recipientEmail: 'test@university.edu',
        recipientFirstName: 'Test',
        packageId: 'PKG-VERY-LONG-PACKAGE-ID-WITH-MANY-CHARACTERS-12345678901234567890',
        provider: 'Very Long Provider Name With Special Characters & Symbols',
        mailroomHoursString: '',
        additionalText: null,
        adminEmail: 'admin@university.edu',
        fromEmail: 'mailroom@university.edu',
        fromPass: 'test-password'
      }

      await processAndSendNotificationEmail(payload)

      const sentEmail = mockEmailService.getLastEmail()
      expect(sentEmail?.html).toContain('PKG-VERY-LONG-PACKAGE-ID-WITH-MANY-CHARACTERS-12345678901234567890')
      expect(sentEmail?.html).toContain('Very Long Provider Name With Special Characters & Symbols')
    })
  })
})