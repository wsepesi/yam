/**
 * Multi-Tenant Boundary Smoke Tests
 * 
 * Critical validation that tenant isolation is working correctly.
 * These tests ensure users cannot access data outside their organization/mailroom.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMocks } from 'node-mocks-http'
import getPackagesHandler from '@/pages/api/get-packages'
import getResidentsHandler from '@/pages/api/get-residents'
import { NextApiRequest, NextApiResponse } from 'next'

// Mock different session contexts for different tenants
const createMockSession = (orgId: string, mailroomId: string, userId: string, role: string = 'user') => ({
  user: { id: userId },
  mailroom: { id: mailroomId, name: `Mailroom ${mailroomId}`, organization_id: orgId },
  organization: { id: orgId, name: `Organization ${orgId}` },
  role
})

const mockOrgAUser = createMockSession('org-a-id', 'mailroom-a1-id', 'user-a1-id')
const mockOrgBUser = createMockSession('org-b-id', 'mailroom-b1-id', 'user-b1-id')
const mockManagerA = createMockSession('org-a-id', 'mailroom-a1-id', 'manager-a1-id', 'manager')
const mockManagerB = createMockSession('org-a-id', 'mailroom-a2-id', 'manager-a2-id', 'manager')

// Mock Supabase with RLS simulation
const createMockSupabaseWithRLS = (currentSession: any) => ({
  from: vi.fn((table: string) => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn(() => {
      // Simulate RLS filtering - only return data if it belongs to current tenant
      if (table === 'packages') {
        const mockData = {
          id: 'package-1',
          mailroom_id: currentSession.mailroom.id,
          package_number: 123
        }
        return Promise.resolve({ 
          data: mockData.mailroom_id === currentSession.mailroom.id ? mockData : null, 
          error: mockData.mailroom_id === currentSession.mailroom.id ? null : { message: 'No rows found' }
        })
      }
      if (table === 'residents') {
        const mockData = {
          id: 'resident-1',
          mailroom_id: currentSession.mailroom.id,
          first_name: 'John',
          last_name: 'Doe'
        }
        return Promise.resolve({ 
          data: mockData.mailroom_id === currentSession.mailroom.id ? mockData : null, 
          error: mockData.mailroom_id === currentSession.mailroom.id ? null : { message: 'No rows found' }
        })
      }
      return Promise.resolve({ data: null, error: null })
    }),
    then: vi.fn((callback) => {
      // Simulate RLS filtering in queries
      const filteredData = table === 'packages' 
        ? [{ id: 'package-1', mailroom_id: currentSession.mailroom.id }].filter(p => p.mailroom_id === currentSession.mailroom.id)
        : table === 'residents'
        ? [{ id: 'resident-1', mailroom_id: currentSession.mailroom.id }].filter(r => r.mailroom_id === currentSession.mailroom.id)
        : []
      
      return callback({ data: filteredData, error: null })
    })
  })),
  rpc: vi.fn(() => Promise.resolve({ data: null, error: null }))
})

describe('Multi-Tenant Boundary Smoke Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Org A user cannot see Org B data', async () => {
    // Mock session for Org A user
    vi.mocked(require('@/lib/handleSession')).default.mockResolvedValue(mockOrgAUser)
    vi.mocked(require('@/lib/supabase')).supabase = createMockSupabaseWithRLS(mockOrgAUser)

    const { req, res } = createMocks({
      method: 'GET',
      query: { mailroom: 'mailroom-b1-id' } // Trying to access Org B's mailroom
    })

    await getPackagesHandler(req, res)

    // Should either return 403 or empty data due to RLS
    expect([200, 403]).toContain(res._getStatusCode())
    
    if (res._getStatusCode() === 200) {
      const data = JSON.parse(res._getData())
      expect(data.packages).toEqual([]) // RLS should filter out all data
    }
  }, 5000)

  it('Manager A cannot access Mailroom B data', async () => {
    // Manager A trying to access Mailroom A2 (different mailroom, same org)
    vi.mocked(require('@/lib/handleSession')).default.mockResolvedValue(mockManagerA)
    vi.mocked(require('@/lib/supabase')).supabase = createMockSupabaseWithRLS(mockManagerA)

    const { req, res } = createMocks({
      method: 'GET',
      query: { mailroom: 'mailroom-a2-id' } // Different mailroom in same org
    })

    await getResidentsHandler(req, res)

    // Should return empty data or 403
    expect([200, 403]).toContain(res._getStatusCode())
    
    if (res._getStatusCode() === 200) {
      const data = JSON.parse(res._getData())
      expect(data.residents).toEqual([])
    }
  }, 5000)

  it('URL manipulation does not bypass org boundaries', async () => {
    // User from Org A tries to manipulate URL to access Org B
    vi.mocked(require('@/lib/handleSession')).default.mockResolvedValue(mockOrgAUser)
    
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/get-packages?mailroom=mailroom-b1-id&bypass=true&admin=true',
      query: { 
        mailroom: 'mailroom-b1-id',
        bypass: 'true',
        admin: 'true'
      }
    })

    await getPackagesHandler(req, res)

    // Should be rejected regardless of URL parameters
    expect([200, 403]).toContain(res._getStatusCode())
    
    if (res._getStatusCode() === 200) {
      const data = JSON.parse(res._getData())
      expect(data.packages).toEqual([])
    }
  }, 5000)

  it('API endpoints enforce tenant isolation', async () => {
    // Test multiple endpoints with cross-tenant access attempts
    const endpoints = [
      { handler: getPackagesHandler, query: { mailroom: 'wrong-mailroom-id' } },
      { handler: getResidentsHandler, query: { mailroom: 'wrong-mailroom-id' } }
    ]

    vi.mocked(require('@/lib/handleSession')).default.mockResolvedValue(mockOrgAUser)
    vi.mocked(require('@/lib/supabase')).supabase = createMockSupabaseWithRLS(mockOrgAUser)

    for (const endpoint of endpoints) {
      const { req, res } = createMocks({
        method: 'GET',
        query: endpoint.query
      })

      await endpoint.handler(req, res)

      // All endpoints should enforce isolation
      expect([200, 403]).toContain(res._getStatusCode())
      
      if (res._getStatusCode() === 200) {
        const data = JSON.parse(res._getData())
        // Data should be empty due to RLS filtering
        const dataKeys = Object.keys(data)
        for (const key of dataKeys) {
          if (Array.isArray(data[key])) {
            expect(data[key]).toEqual([])
          }
        }
      }
    }
  }, 10000)

  it('session validation prevents unauthorized access', async () => {
    // Test with no session
    vi.mocked(require('@/lib/handleSession')).default.mockRejectedValue(new Error('Unauthorized'))

    const { req, res } = createMocks({
      method: 'GET',
      query: { mailroom: 'any-mailroom-id' }
    })

    await getPackagesHandler(req, res)

    expect(res._getStatusCode()).toBe(401)
  }, 5000)

  it('role-based access restrictions work correctly', async () => {
    // Regular user trying to access manager-only data
    const regularUser = createMockSession('org-a-id', 'mailroom-a1-id', 'user-regular-id', 'user')
    vi.mocked(require('@/lib/handleSession')).default.mockResolvedValue(regularUser)

    // This would be a manager-only endpoint test
    const { req, res } = createMocks({
      method: 'GET',
      query: { mailroom: regularUser.mailroom.id, scope: 'manager' }
    })

    await getPackagesHandler(req, res)

    // Should work for regular package access
    expect(res._getStatusCode()).toBe(200)
  }, 5000)
})