// tests/unit/utils/email-utils.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import sendEmailWithContent from '@/lib/sendEmail'
import nodemailer from 'nodemailer'

// Mock nodemailer
vi.mock('nodemailer')

describe('Email Formatting Utilities', () => {
  let mockTransporter: any

  beforeEach(() => {
    mockTransporter = {
      verify: vi.fn(),
      sendMail: vi.fn()
    }
    vi.mocked(nodemailer.createTransport).mockReturnValue(mockTransporter)
  })

  describe('sendEmailWithContent', () => {
    const defaultEmailParams = {
      toEmail: 'resident@university.edu',
      content: 'Test email content',
      adminEmail: 'admin@mailroom.edu',
      fromEmail: 'noreply@mailroom.edu',
      fromPass: 'secure-password',
      subject: 'Test Subject'
    }

    it('should send email with correct configuration', async () => {
      mockTransporter.verify.mockResolvedValueOnce(true)
      mockTransporter.sendMail.mockResolvedValueOnce({ rejected: [] })

      await sendEmailWithContent(
        defaultEmailParams.toEmail,
        defaultEmailParams.content,
        defaultEmailParams.adminEmail,
        defaultEmailParams.fromEmail,
        defaultEmailParams.fromPass,
        defaultEmailParams.subject
      )

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        service: 'gmail',
        auth: {
          user: defaultEmailParams.fromEmail,
          pass: defaultEmailParams.fromPass
        }
      })

      expect(mockTransporter.verify).toHaveBeenCalled()
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: defaultEmailParams.fromEmail,
        to: defaultEmailParams.toEmail,
        subject: defaultEmailParams.subject,
        text: defaultEmailParams.content,
        replyTo: defaultEmailParams.adminEmail,
        dsn: {
          id: '53201',
          return: 'headers',
          notify: ['failure', 'delay'],
          recipient: defaultEmailParams.adminEmail
        }
      })
    })

    it('should throw error when password is undefined', async () => {
      await expect(sendEmailWithContent(
        defaultEmailParams.toEmail,
        defaultEmailParams.content,
        defaultEmailParams.adminEmail,
        defaultEmailParams.fromEmail,
        undefined,
        defaultEmailParams.subject
      )).rejects.toThrow('pass not set')
    })

    it('should throw error when transporter verification fails', async () => {
      mockTransporter.verify.mockResolvedValueOnce(false)

      await expect(sendEmailWithContent(
        defaultEmailParams.toEmail,
        defaultEmailParams.content,
        defaultEmailParams.adminEmail,
        defaultEmailParams.fromEmail,
        defaultEmailParams.fromPass,
        defaultEmailParams.subject
      )).rejects.toThrow('transporter verification failed')
    })

    it('should throw error when email sending fails', async () => {
      mockTransporter.verify.mockResolvedValueOnce(true)
      mockTransporter.sendMail.mockResolvedValueOnce({ 
        rejected: ['resident@university.edu'] 
      })

      await expect(sendEmailWithContent(
        defaultEmailParams.toEmail,
        defaultEmailParams.content,
        defaultEmailParams.adminEmail,
        defaultEmailParams.fromEmail,
        defaultEmailParams.fromPass,
        defaultEmailParams.subject
      )).rejects.toThrow('transporter sendMail failed')
    })

    it('should handle network errors during verification', async () => {
      mockTransporter.verify.mockRejectedValueOnce(new Error('Network timeout'))

      await expect(sendEmailWithContent(
        defaultEmailParams.toEmail,
        defaultEmailParams.content,
        defaultEmailParams.adminEmail,
        defaultEmailParams.fromEmail,
        defaultEmailParams.fromPass,
        defaultEmailParams.subject
      )).rejects.toThrow('Network timeout')
    })

    it('should handle network errors during sending', async () => {
      mockTransporter.verify.mockResolvedValueOnce(true)
      mockTransporter.sendMail.mockRejectedValueOnce(new Error('SMTP server unavailable'))

      await expect(sendEmailWithContent(
        defaultEmailParams.toEmail,
        defaultEmailParams.content,
        defaultEmailParams.adminEmail,
        defaultEmailParams.fromEmail,
        defaultEmailParams.fromPass,
        defaultEmailParams.subject
      )).rejects.toThrow('SMTP server unavailable')
    })
  })

  describe('Email content formatting helpers', () => {
    describe('formatPackageNotificationContent', () => {
      it('should format package notification with all details', () => {
        const packageInfo = {
          recipientFirstName: 'John',
          packageId: '123',
          provider: 'UPS',
          mailroomHours: 'Monday-Friday: 9:00 AM - 5:00 PM\nSaturday: 10:00 AM - 2:00 PM\nSunday: Closed',
          additionalText: 'Please bring your student ID for pickup.'
        }

        const result = formatPackageNotificationContent(packageInfo)

        expect(result).toContain('Hello John')
        expect(result).toContain('Package ID: 123')
        expect(result).toContain('Provider: UPS')
        expect(result).toContain('Monday-Friday: 9:00 AM - 5:00 PM')
        expect(result).toContain('Please bring your student ID for pickup.')
      })

      it('should handle missing recipient name gracefully', () => {
        const packageInfo = {
          recipientFirstName: null,
          packageId: '456',
          provider: 'FedEx',
          mailroomHours: 'Daily: 8:00 AM - 6:00 PM',
          additionalText: null
        }

        const result = formatPackageNotificationContent(packageInfo)

        expect(result).toContain('Hello')
        expect(result).toContain('Package ID: 456')
        expect(result).not.toContain('null')
      })

      it('should format mailroom hours correctly', () => {
        const hoursFormats = [
          'Monday-Friday: 9:00 AM - 5:00 PM\nSaturday: 10:00 AM - 2:00 PM',
          'Daily: 24/7',
          'Weekdays: 8-17\nWeekends: Closed'
        ]

        hoursFormats.forEach(hours => {
          const result = formatPackageNotificationContent({
            recipientFirstName: 'Test',
            packageId: '123',
            provider: 'USPS',
            mailroomHours: hours,
            additionalText: ''
          })

          expect(result).toContain(hours)
        })
      })
    })

    describe('formatSubjectLine', () => {
      it('should create proper subject line for package notifications', () => {
        const result = formatSubjectLine('package_notification', '123', 'UPS')
        expect(result).toBe('Package Notification - ID: 123 (UPS)')
      })

      it('should create proper subject line for pickup reminders', () => {
        const result = formatSubjectLine('pickup_reminder', '456', 'FedEx')
        expect(result).toBe('Package Pickup Reminder - ID: 456 (FedEx)')
      })

      it('should handle unknown email types', () => {
        const result = formatSubjectLine('unknown_type', '789', 'DHL')
        expect(result).toBe('Mailroom Notification - ID: 789 (DHL)')
      })
    })

    describe('validateEmailParameters', () => {
      it('should validate correct email parameters', () => {
        const validParams = {
          toEmail: 'test@university.edu',
          fromEmail: 'noreply@mailroom.edu',
          adminEmail: 'admin@mailroom.edu',
          content: 'Valid email content',
          subject: 'Valid Subject'
        }

        expect(validateEmailParameters(validParams)).toBe(true)
      })

      it('should reject invalid email addresses', () => {
        const invalidEmails = [
          'invalid-email',
          '@domain.com',
          'user@',
          '',
          null,
          undefined
        ]

        invalidEmails.forEach(email => {
          const params = {
            toEmail: email,
            fromEmail: 'valid@domain.com',
            adminEmail: 'admin@domain.com',
            content: 'Content',
            subject: 'Subject'
          }
          expect(validateEmailParameters(params)).toBe(false)
        })
      })

      it('should reject empty content or subject', () => {
        const invalidParams = [
          { content: '', subject: 'Valid Subject' },
          { content: 'Valid Content', subject: '' },
          { content: null, subject: 'Valid Subject' },
          { content: 'Valid Content', subject: null }
        ]

        invalidParams.forEach(partial => {
          const params = {
            toEmail: 'test@domain.com',
            fromEmail: 'from@domain.com',
            adminEmail: 'admin@domain.com',
            ...partial
          }
          expect(validateEmailParameters(params)).toBe(false)
        })
      })
    })

    describe('sanitizeEmailContent', () => {
      it('should remove potentially harmful HTML tags', () => {
        const htmlContent = 'Hello <script>alert("xss")</script> <b>John</b>'
        const result = sanitizeEmailContent(htmlContent)
        
        expect(result).not.toContain('<script>')
        expect(result).not.toContain('alert')
        expect(result).toContain('John')
      })

      it('should preserve safe formatting', () => {
        const content = 'Package ID: 123\nProvider: UPS\n\nPlease pickup soon.'
        const result = sanitizeEmailContent(content)
        
        expect(result).toBe(content)
      })

      it('should handle special characters correctly', () => {
        const content = 'Package from José & María (50% off!)'
        const result = sanitizeEmailContent(content)
        
        expect(result).toContain('José')
        expect(result).toContain('María')
        expect(result).toContain('50%')
      })
    })
  })

  describe('Email retry and queue management', () => {
    describe('retryEmailSending', () => {
      it('should retry failed email sending up to max attempts', async () => {
        const maxRetries = 3
        let attempts = 0

        const mockSendFunction = vi.fn().mockImplementation(() => {
          attempts++
          if (attempts < maxRetries) {
            throw new Error('Temporary network error')
          }
          return Promise.resolve({ rejected: [] })
        })

        const result = await retryEmailSending(mockSendFunction, maxRetries)
        
        expect(attempts).toBe(maxRetries)
        expect(result).toEqual({ rejected: [] })
      })

      it('should fail after max retries exceeded', async () => {
        const maxRetries = 2
        const mockSendFunction = vi.fn().mockRejectedValue(new Error('Persistent error'))

        await expect(retryEmailSending(mockSendFunction, maxRetries))
          .rejects.toThrow('Persistent error')
        
        expect(mockSendFunction).toHaveBeenCalledTimes(maxRetries)
      })
    })

    describe('queueEmailForRetry', () => {
      it('should queue failed email for later retry', () => {
        const emailData = {
          toEmail: 'test@university.edu',
          content: 'Test content',
          subject: 'Test subject',
          retryCount: 0
        }

        const queue = queueEmailForRetry(emailData)
        
        expect(queue).toContain(emailData)
        expect(emailData.retryCount).toBe(1)
      })

      it('should not queue email after max retry attempts', () => {
        const emailData = {
          toEmail: 'test@university.edu',
          content: 'Test content',
          subject: 'Test subject',
          retryCount: 5 // Already at max
        }

        const queue = queueEmailForRetry(emailData, 5)
        
        expect(queue).not.toContain(emailData)
      })
    })
  })
})

// Helper functions for email formatting (these would typically be in a separate utility file)
function formatPackageNotificationContent(packageInfo: {
  recipientFirstName: string | null
  packageId: string
  provider: string
  mailroomHours: string
  additionalText: string | null
}): string {
  const greeting = packageInfo.recipientFirstName ? `Hello ${packageInfo.recipientFirstName}` : 'Hello'
  
  let content = `${greeting},\n\n`
  content += `You have a new package available for pickup:\n\n`
  content += `Package ID: ${packageInfo.packageId}\n`
  content += `Provider: ${packageInfo.provider}\n\n`
  content += `Mailroom Hours:\n${packageInfo.mailroomHours}\n\n`
  
  if (packageInfo.additionalText) {
    content += `${packageInfo.additionalText}\n\n`
  }
  
  content += `Please pickup your package as soon as possible.\n\n`
  content += `Thank you!`
  
  return content
}

function formatSubjectLine(emailType: string, packageId: string, provider: string): string {
  switch (emailType) {
    case 'package_notification':
      return `Package Notification - ID: ${packageId} (${provider})`
    case 'pickup_reminder':
      return `Package Pickup Reminder - ID: ${packageId} (${provider})`
    default:
      return `Mailroom Notification - ID: ${packageId} (${provider})`
  }
}

function validateEmailParameters(params: any): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  
  return !!(
    params.toEmail && emailRegex.test(params.toEmail) &&
    params.fromEmail && emailRegex.test(params.fromEmail) &&
    params.adminEmail && emailRegex.test(params.adminEmail) &&
    params.content && params.content.trim().length > 0 &&
    params.subject && params.subject.trim().length > 0
  )
}

function sanitizeEmailContent(content: string): string {
  // Remove script tags and other potentially harmful content
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '') // Remove all HTML tags for plain text email
    .trim()
}

async function retryEmailSending(sendFunction: () => Promise<any>, maxRetries: number): Promise<any> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await sendFunction()
    } catch (error) {
      lastError = error as Error
      if (attempt === maxRetries) {
        throw lastError
      }
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
    }
  }
  
  throw lastError
}

function queueEmailForRetry(emailData: any, maxRetries: number = 5): any[] {
  if (emailData.retryCount >= maxRetries) {
    console.error('Email exceeded max retry attempts:', emailData.toEmail)
    return []
  }
  
  emailData.retryCount = (emailData.retryCount || 0) + 1
  console.log(`Queueing email for retry (attempt ${emailData.retryCount}):`, emailData.toEmail)
  
  // In a real implementation, this would add to a persistent queue
  return [emailData]
}