import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DatabaseTestHelper } from '../utils/db-test-helper'
import { sendEmail } from '../../lib/sendEmail'
import { setupEmailPerformanceTest, collectPerformanceMetrics } from '../utils/performance-config'

vi.mock('nodemailer')

describe.sequential('Email Performance Tests', () => {
  const dbHelper = DatabaseTestHelper.getInstance()
  
  let org: any
  let mailroom: any
  let mockTransporter: any
  
  beforeEach(async () => {
    // Configure email performance test settings
    const config = setupEmailPerformanceTest()
    console.log(`Email performance test configured with ${config.bulkEmailLimit} email limit, timeout: 3 minutes`)
    
    await dbHelper.cleanup()
    
    org = await dbHelper.createTestOrg('Email Perf University')
    
    // Update org with email settings
    const supabase = dbHelper.getClient()
    await supabase.from('organizations').update({
      notification_email: 'test@university.edu',
      notification_email_password: 'test-password'
    }).eq('id', org.id)
    
    mailroom = await dbHelper.createTestMailroom(org.id)
    
    // Update mailroom with admin email
    await supabase.from('mailrooms').update({
      admin_email: 'admin@university.edu'
    }).eq('id', mailroom.id)
    
    mockTransporter = {
      verify: vi.fn().mockResolvedValue(true),
      sendMail: vi.fn().mockResolvedValue({
        accepted: ['test@example.com'],
        rejected: [],
        messageId: 'test-id'
      })
    }
    
    const nodemailer = await import('nodemailer')
    vi.mocked(nodemailer.createTransport).mockReturnValue(mockTransporter as any)
  })
  
  afterEach(async () => {
    await dbHelper.cleanup()
    vi.clearAllMocks()
  })
  
  describe('Bulk Email Performance', () => {
    it('should send 200 emails within performance limits', async () => {
      const emailCount = 200
      const startTime = performance.now()
      
      const emailPromises = Array.from({ length: emailCount }, (_, i) =>
        sendEmail(
          `user${i}@test.edu`,
          'Performance Test',
          'Test email body',
          mailroom.admin_email,
          org.notification_email,
          org.notification_email_password
        )
      )
      
      await Promise.all(emailPromises)
      const totalTime = performance.now() - startTime
      
      expect(totalTime).toBeLessThan(180000) // Under 3 minutes (increased for bulk email performance)
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(emailCount)
      
      console.log(`${emailCount} emails sent in ${totalTime.toFixed(2)}ms`)
      console.log(`Average: ${(totalTime / emailCount).toFixed(2)}ms per email`)
    }, 300000) // 5 minute timeout for bulk email test
  })
})