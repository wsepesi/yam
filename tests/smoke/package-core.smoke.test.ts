/**
 * Package Lifecycle Smoke Tests
 * 
 * Critical path validation for core package functionality.
 * These tests must run fast (<30s) and cover the essential package flow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMocks } from 'node-mocks-http'
import addPackageHandler from '@/pages/api/add-package'
import getPackagesHandler from '@/pages/api/get-packages'
import logPackageHandler from '@/pages/api/log-package'
import sendNotificationHandler from '@/pages/api/send-notification-email'

// Mock email service
vi.mock('nodemailer', () => ({
  createTransporter: vi.fn(() => ({
    sendMail: vi.fn(() => Promise.resolve({ messageId: 'test-id' }))
  }))
}))

// Mock Supabase for smoke tests
const mockSupabaseResponse = {
  data: null,
  error: null,
  status: 200,
  statusText: 'OK'
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn(() => Promise.resolve({ 
        data: [{ id: 'test-package-id', package_number: 123 }], 
        error: null 
      })),
      update: vi.fn(() => Promise.resolve(mockSupabaseResponse)),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(() => Promise.resolve({ 
        data: { id: 'test-resident-id', first_name: 'John', last_name: 'Doe', email: 'john@test.com' }, 
        error: null 
      })),
      order: vi.fn().mockReturnThis()
    })),
    rpc: vi.fn((procedure) => {
      if (procedure === 'get_next_package_number') {
        return Promise.resolve({ data: 123, error: null })
      }
      if (procedure === 'release_package_number') {
        return Promise.resolve({ data: true, error: null })
      }
      return Promise.resolve(mockSupabaseResponse)
    })
  }
}))

// Mock session validation
vi.mock('@/lib/handleSession', () => ({
  default: vi.fn(() => Promise.resolve({
    user: { id: 'test-user-id' },
    mailroom: { id: 'test-mailroom-id', name: 'Test Mailroom' },
    organization: { id: 'test-org-id', name: 'Test Org' }
  }))
}))

describe('Package Lifecycle Smoke Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('staff can register a new package', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        residentId: 'test-resident-id',
        provider: 'FedEx',
        orgSlug: 'test-org',
        mailroomSlug: 'test-mailroom',
        First: 'John',
        Last: 'Doe',
        Email: 'john@test.com'
      },
      headers: {
        authorization: 'Bearer test-token'
      }
    })

    await addPackageHandler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data).toBeDefined()
  }, 5000)

  it('package appears in packages list', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: { mailroom: 'test-mailroom-id' }
    })

    // Mock packages response
    const mockPackages = [{
      id: 'test-package-id',
      package_number: 123,
      status: 'WAITING',
      provider: 'FedEx',
      resident_id: 'test-resident-id',
      created_at: new Date().toISOString()
    }]

    // Update the mock for this specific test
    const supabaseMock = require('@/lib/supabase')
    supabaseMock.supabase.from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn(() => Promise.resolve({ data: mockPackages, error: null }))
    }))

    await getPackagesHandler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data.packages).toBeDefined()
    expect(Array.isArray(data.packages)).toBe(true)
    expect(data.packages.length).toBeGreaterThan(0)
  }, 5000)

  it('package status updates correctly', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        packageId: 'test-package-id'
      }
    })

    await logPackageHandler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data).toBeDefined()
  }, 5000)

  it('email notification sends successfully', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        recipientEmail: 'john@test.com',
        recipientFirstName: 'John',
        packageId: 'test-package-123',
        provider: 'FedEx',
        mailroomHoursString: 'Monday: 9-5',
        additionalText: 'Test message',
        adminEmail: 'admin@test.com',
        fromEmail: 'mailroom@test.com',
        fromPass: 'test-password'
      }
    })

    await sendNotificationHandler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data.success).toBe(true)
  }, 5000)

  it('complete package flow works end-to-end', async () => {
    // 1. Register package
    const { req: addReq, res: addRes } = createMocks({
      method: 'POST',
      body: {
        residentId: 'test-resident-id',
        provider: 'UPS',
        orgSlug: 'test-org',
        mailroomSlug: 'test-mailroom',
        First: 'John',
        Last: 'Doe',
        Email: 'john@test.com'
      },
      headers: {
        authorization: 'Bearer test-token'
      }
    })

    await addPackageHandler(addReq, addRes)
    expect(addRes._getStatusCode()).toBe(200)

    // 2. Send notification
    const { req: emailReq, res: emailRes } = createMocks({
      method: 'POST',
      body: {
        recipientEmail: 'john@test.com',
        recipientFirstName: 'John',
        packageId: 'test-package-123',
        provider: 'UPS',
        mailroomHoursString: 'Monday: 9-5',
        additionalText: 'Test message',
        adminEmail: 'admin@test.com',
        fromEmail: 'mailroom@test.com',
        fromPass: 'test-password'
      }
    })

    await sendNotificationHandler(emailReq, emailRes)
    expect(emailRes._getStatusCode()).toBe(200)

    // 3. Mark as picked up
    const { req: logReq, res: logRes } = createMocks({
      method: 'POST',
      body: {
        packageId: 'test-package-id'
      }
    })

    await logPackageHandler(logReq, logRes)
    expect(logRes._getStatusCode()).toBe(200)
  }, 10000)
})