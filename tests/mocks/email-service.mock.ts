// Email service mock for testing notification functionality
import { vi } from 'vitest'

export interface MockEmailOptions {
  to: string
  subject: string
  html: string
  from?: string
}

export interface MockEmailResult {
  messageId: string
  accepted: string[]
  rejected: string[]
  response: string
}

class EmailServiceMock {
  private sentEmails: MockEmailOptions[] = []
  private shouldFail = false
  private failureCount = 0
  private maxFailures = 0

  async sendEmail(options: MockEmailOptions): Promise<MockEmailResult> {
    if (this.shouldFail && this.failureCount < this.maxFailures) {
      this.failureCount++
      throw new Error('Email service temporarily unavailable')
    }

    this.sentEmails.push(options)
    
    return {
      messageId: `test-message-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      accepted: [options.to],
      rejected: [],
      response: '250 Message accepted'
    }
  }

  // Test utilities
  getLastEmail(): MockEmailOptions | undefined {
    return this.sentEmails[this.sentEmails.length - 1]
  }

  getAllEmails(): MockEmailOptions[] {
    return [...this.sentEmails]
  }

  getEmailsToRecipient(email: string): MockEmailOptions[] {
    return this.sentEmails.filter(e => e.to === email)
  }

  getEmailCount(): number {
    return this.sentEmails.length
  }

  hasEmailWithSubject(subject: string): boolean {
    return this.sentEmails.some(e => e.subject.includes(subject))
  }

  reset(): void {
    this.sentEmails = []
    this.shouldFail = false
    this.failureCount = 0
    this.maxFailures = 0
  }

  simulateFailure(maxFailures = 1): void {
    this.shouldFail = true
    this.maxFailures = maxFailures
    this.failureCount = 0
  }

  stopFailure(): void {
    this.shouldFail = false
  }
}

export const mockEmailService = new EmailServiceMock()

// Mock the actual email sending function
export const mockSendEmail = vi.fn().mockImplementation(mockEmailService.sendEmail.bind(mockEmailService))

// Template validation helpers
export const EmailTestUtils = {
  validatePackageNotificationEmail: (email: MockEmailOptions, packageId: string, residentName: string) => {
    expect(email.subject).toContain('package')
    expect(email.subject).toContain(packageId)
    expect(email.html).toContain(residentName)
    expect(email.html).toContain(packageId)
    expect(email.html).toContain('pick up')
  },

  validateInvitationEmail: (email: MockEmailOptions, inviterName: string, organizationName: string) => {
    expect(email.subject).toContain('invitation')
    expect(email.html).toContain(inviterName)
    expect(email.html).toContain(organizationName)
    expect(email.html).toContain('accept')
  },

  validatePasswordResetEmail: (email: MockEmailOptions) => {
    expect(email.subject).toContain('password')
    expect(email.html).toContain('reset')
    expect(email.html).toMatch(/https?:\/\/.*\/reset/)
  }
}

// Mock the nodemailer default export
const mockNodemailer = {
  createTransport: vi.fn(() => ({
    verify: vi.fn(() => Promise.resolve(true)),
    sendMail: vi.fn(() => Promise.resolve({
      messageId: `test-message-${Date.now()}`,
      accepted: [],
      rejected: [],
      response: '250 Message accepted'
    }))
  }))
}

export default mockNodemailer