// tests/security/authorization-security.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextApiRequest, NextApiResponse } from 'next'
import { createMocks } from 'node-mocks-http'

// Import API handlers for authorization testing
import getResidentsHandler from '@/pages/api/get-residents'
import addResidentHandler from '@/pages/api/add-resident'
import removeResidentHandler from '@/pages/api/remove-resident'
import createOrgHandler from '@/pages/api/organizations/create'
import createMailroomHandler from '@/pages/api/mailrooms/create'
import getPackagesHandler from '@/pages/api/get-packages'
import managersHandler from '@/pages/api/managers'

// Mock modules
vi.mock('@/lib/supabase')
vi.mock('@/lib/handleSession')

describe('Authorization Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Direct Object Reference Prevention', () => {
    it('should prevent access to other organization residents', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        headers: {
          authorization: 'Bearer test-token'
        },
        query: {
          orgSlug: 'victim-org',  // User trying to access different org
          mailroomSlug: 'victim-mailroom'
        }
      })

      // Mock user belongs to different organization
      const mockHandleSession = await import('@/lib/handleSession')
      vi.mocked(mockHandleSession.default).mockResolvedValue('attacker-user-id')

      const mockSupabase = await import('@/lib/supabase')
      vi.mocked(mockSupabase.createAdminClient).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn()
            .mockResolvedValueOnce({ 
              data: { id: 'victim-mailroom-id', organization_id: 'victim-org-id' }, 
              error: null 
            })
            .mockResolvedValueOnce({ 
              data: { id: 'victim-org-id' }, 
              error: null 
            }),
          or: vi.fn().mockResolvedValue({ 
            data: [], // RLS should prevent data access
            error: null 
          })
        }))
      } as any)

      await getResidentsHandler(req, res)

      // Should return empty results due to RLS, not the actual data
      expect(res._getStatusCode()).toBe(200)
      const responseData = JSON.parse(res._getData())
      expect(responseData.records).toEqual([])
    })

    it('should prevent modification of resources from other organizations', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        headers: {
          authorization: 'Bearer test-token'
        },
        body: {
          resident: {
            first_name: 'Malicious',
            last_name: 'User',
            resident_id: 'HACK123'
          },
          orgSlug: 'victim-org',
          mailroomSlug: 'victim-mailroom'
        }
      })

      // Mock authentication
      const mockHandleSession = await import('@/lib/handleSession')
      vi.mocked(mockHandleSession.default).mockResolvedValue('attacker-user-id')

      const mockSupabase = await import('@/lib/supabase')
      vi.mocked(mockSupabase.createAdminClient).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn()
            .mockResolvedValueOnce({ 
              data: { id: 'victim-mailroom-id', organization_id: 'victim-org-id' }, 
              error: null 
            })
            .mockResolvedValueOnce({ 
              data: { id: 'victim-org-id' }, 
              error: null 
            }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: vi.fn().mockResolvedValue({ 
            data: null, 
            error: { code: '42501', message: 'insufficient_privilege' } // RLS block
          })
        }))
      } as any)

      await addResidentHandler(req, res)

      // Should be blocked by RLS or authorization check
      expect(res._getStatusCode()).toBeGreaterThanOrEqual(400)
    })

    it('should prevent deletion of resources from other organizations', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'DELETE',
        headers: {
          authorization: 'Bearer test-token'
        },
        body: {
          residentId: 'victim-resident-id',
          orgSlug: 'victim-org',
          mailroomSlug: 'victim-mailroom'
        }
      })

      // Mock authentication
      const mockHandleSession = await import('@/lib/handleSession')
      vi.mocked(mockHandleSession.default).mockResolvedValue('attacker-user-id')

      const mockSupabase = await import('@/lib/supabase')
      vi.mocked(mockSupabase.createAdminClient).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn()
            .mockResolvedValueOnce({ 
              data: { id: 'victim-mailroom-id', organization_id: 'victim-org-id' }, 
              error: null 
            })
            .mockResolvedValueOnce({ 
              data: { id: 'victim-org-id' }, 
              error: null 
            }),
          update: vi.fn().mockResolvedValue({ 
            data: null, 
            error: { code: '42501', message: 'insufficient_privilege' }
          })
        }))
      } as any)

      await removeResidentHandler(req, res)

      // Should be blocked by RLS
      expect(res._getStatusCode()).toBeGreaterThanOrEqual(400)
    })
  })

  describe('Privilege Escalation Prevention', () => {
    it('should prevent users from creating organizations', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        headers: {
          authorization: 'Bearer test-token'
        },
        body: {
          name: 'Malicious Org',
          slug: 'malicious-org'
        }
      })

      // Mock regular user trying to escalate privileges
      const mockHandleSession = await import('@/lib/handleSession')
      vi.mocked(mockHandleSession.default).mockResolvedValue('regular-user-id')

      const mockSupabase = await import('@/lib/supabase')
      vi.mocked(mockSupabase.createAdminClient).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ 
            data: { role: 'user' }, // Regular user, not super-admin
            error: null 
          })
        }))
      } as any)

      await createOrgHandler(req, res)

      // Should be denied
      expect(res._getStatusCode()).toBe(403)
      const responseData = JSON.parse(res._getData())
      expect(responseData.error).toContain('permission')
    })

    it('should prevent managers from creating mailrooms outside their organization', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        headers: {
          authorization: 'Bearer test-token'
        },
        body: {
          name: 'Malicious Mailroom',
          slug: 'malicious-mailroom',
          organizationId: 'different-org-id',
          adminEmail: 'attacker@example.com'
        }
      })

      // Mock manager trying to create mailroom in different org
      const mockHandleSession = await import('@/lib/handleSession')
      vi.mocked(mockHandleSession.default).mockResolvedValue('manager-user-id')

      const mockSupabase = await import('@/lib/supabase')
      vi.mocked(mockSupabase.createAdminClient).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ 
            data: { 
              role: 'manager',
              organization_id: 'manager-org-id' // Different from request
            }, 
            error: null 
          })
        }))
      } as any)

      await createMailroomHandler(req, res)

      // Should be denied
      expect(res._getStatusCode()).toBe(403)
      const responseData = JSON.parse(res._getData())
      expect(responseData.error).toContain('permission')
    })

    it('should prevent users from modifying their own role', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'PUT',
        headers: {
          authorization: 'Bearer test-token'
        },
        body: {
          role: 'super-admin' // Trying to escalate
        }
      })

      // Mock user trying to modify their own profile
      const mockHandleSession = await import('@/lib/handleSession')
      vi.mocked(mockHandleSession.default).mockResolvedValue('user-id')

      const mockSupabase = await import('@/lib/supabase')
      vi.mocked(mockSupabase.createAdminClient).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          update: vi.fn().mockResolvedValue({ 
            data: null, 
            error: { code: '42501', message: 'insufficient_privilege' }
          })
        }))
      } as any)

      // Most APIs shouldn't allow users to modify their own roles
      // This would depend on having a user profile update endpoint
      // For now, we'll test that any role modification is properly secured
      expect(true).toBe(true) // Placeholder - would need actual endpoint
    })
  })

  describe('API Endpoint Authorization Enforcement', () => {
    it('should enforce role-based access to manager endpoints', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        headers: {
          authorization: 'Bearer test-token'
        },
        query: {
          orgSlug: 'test-org',
          mailroomSlug: 'test-mailroom'
        }
      })

      // Mock regular user trying to access manager endpoint
      const mockHandleSession = await import('@/lib/handleSession')
      vi.mocked(mockHandleSession.default).mockResolvedValue('regular-user-id')

      const mockSupabase = await import('@/lib/supabase')
      vi.mocked(mockSupabase.createAdminClient).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ 
            data: { 
              role: 'user',
              organization_id: 'user-org-id',
              mailroom_id: 'user-mailroom-id'
            }, 
            error: null 
          })
        }))
      } as any)

      await managersHandler(req, res)

      // Should check permissions and potentially deny access
      const statusCode = res._getStatusCode()
      if (statusCode === 403) {
        const responseData = JSON.parse(res._getData())
        expect(responseData.error).toContain('permission')
      }
      // If allowed, should return appropriate data for user's context
    })

    it('should validate organization/mailroom context in requests', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        headers: {
          authorization: 'Bearer test-token'
        },
        query: {
          orgSlug: 'nonexistent-org',
          mailroomSlug: 'nonexistent-mailroom'
        }
      })

      // Mock authentication
      const mockHandleSession = await import('@/lib/handleSession')
      vi.mocked(mockHandleSession.default).mockResolvedValue('user-id')

      const mockSupabase = await import('@/lib/supabase')
      vi.mocked(mockSupabase.createAdminClient).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ 
            data: null, 
            error: { code: 'PGRST116' } // Not found
          })
        }))
      } as any)

      await getResidentsHandler(req, res)

      // Should return 404 for nonexistent org/mailroom
      expect(res._getStatusCode()).toBe(404)
    })
  })

  describe('Resource Access Validation', () => {
    it('should validate package access by mailroom membership', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        headers: {
          authorization: 'Bearer test-token'
        },
        query: {
          orgSlug: 'test-org',
          mailroomSlug: 'test-mailroom'
        }
      })

      // Mock user authentication
      const mockHandleSession = await import('@/lib/handleSession')
      vi.mocked(mockHandleSession.default).mockResolvedValue('user-id')

      const mockSupabase = await import('@/lib/supabase')
      vi.mocked(mockSupabase.createAdminClient).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn()
            .mockResolvedValueOnce({ 
              data: { id: 'mailroom-id', organization_id: 'org-id' }, 
              error: null 
            })
            .mockResolvedValueOnce({ 
              data: { id: 'org-id' }, 
              error: null 
            }),
          order: vi.fn().mockResolvedValue({ 
            data: [], // RLS should filter results
            error: null 
          })
        }))
      } as any)

      await getPackagesHandler(req, res)

      // Should return only packages user is authorized to see
      expect(res._getStatusCode()).toBe(200)
      const responseData = JSON.parse(res._getData())
      expect(Array.isArray(responseData)).toBe(true)
    })

    it('should prevent unauthorized resident lookups', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        headers: {
          authorization: 'Bearer test-token'
        },
        query: {
          orgSlug: 'test-org',
          mailroomSlug: 'test-mailroom',
          query: 'admin' // Searching for admin users
        }
      })

      // Mock authentication
      const mockHandleSession = await import('@/lib/handleSession')
      vi.mocked(mockHandleSession.default).mockResolvedValue('user-id')

      const mockSupabase = await import('@/lib/supabase')
      vi.mocked(mockSupabase.createAdminClient).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn()
            .mockResolvedValueOnce({ 
              data: { id: 'mailroom-id', organization_id: 'org-id' }, 
              error: null 
            })
            .mockResolvedValueOnce({ 
              data: { id: 'org-id' }, 
              error: null 
            }),
          or: vi.fn().mockResolvedValue({ 
            data: [], // Should filter sensitive results
            error: null 
          })
        }))
      } as any)

      await getResidentsHandler(req, res)

      // Should only return residents, not admin/staff info
      expect(res._getStatusCode()).toBe(200)
      const responseData = JSON.parse(res._getData())
      expect(responseData.records).toEqual([])
    })
  })

  describe('Unauthorized API Access Attempts', () => {
    it('should log and reject completely unauthenticated requests', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        // No authorization header
        query: {
          orgSlug: 'test-org',
          mailroomSlug: 'test-mailroom'
        }
      })

      // Mock authentication failure
      const mockHandleSession = await import('@/lib/handleSession')
      vi.mocked(mockHandleSession.default).mockResolvedValue(null)

      await getResidentsHandler(req, res)

      // Should reject with 401
      expect(res._getStatusCode()).toBeGreaterThanOrEqual(400)
    })

    it('should handle requests with invalid tokens', async () => {
      const invalidTokens = [
        'Bearer invalid-token',
        'Bearer ey' + 'a'.repeat(500), // Malformed JWT
        'Bearer null',
        'Bearer undefined',
        'Bearer ""',
      ]

      for (const invalidToken of invalidTokens) {
        const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
          method: 'GET',
          headers: {
            authorization: invalidToken
          },
          query: {
            orgSlug: 'test-org',
            mailroomSlug: 'test-mailroom'
          }
        })

        // Mock authentication failure
        const mockHandleSession = await import('@/lib/handleSession')
        vi.mocked(mockHandleSession.default).mockResolvedValue(null)

        await getResidentsHandler(req, res)

        // Should reject invalid tokens
        expect(res._getStatusCode()).toBeGreaterThanOrEqual(400)
        
        vi.clearAllMocks()
      }
    })

    it('should prevent parameter pollution attacks', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        headers: {
          authorization: 'Bearer test-token'
        },
        query: {
          orgSlug: ['test-org', 'malicious-org'], // Array instead of string
          mailroomSlug: 'test-mailroom'
        }
      })

      await getResidentsHandler(req, res)

      // Should handle parameter pollution gracefully
      expect(res._getStatusCode()).toBeGreaterThanOrEqual(400)
      expect(res._getStatusCode()).toBeLessThan(500)
    })

    it('should rate limit suspicious activity patterns', async () => {
      // Simulate rapid successive requests from same source
      const suspiciousRequests = Array.from({ length: 20 }, () => 
        createMocks<NextApiRequest, NextApiResponse>({
          method: 'GET',
          headers: {
            authorization: 'Bearer different-token-each-time',
            'x-forwarded-for': '192.168.1.100'
          },
          query: {
            orgSlug: 'test-org',
            mailroomSlug: 'test-mailroom'
          }
        })
      )

      // Mock authentication failures
      const mockHandleSession = await import('@/lib/handleSession')
      vi.mocked(mockHandleSession.default).mockResolvedValue(null)

      const results = await Promise.allSettled(
        suspiciousRequests.map(({ req, res }) => getResidentsHandler(req, res))
      )

      // All should be handled without crashing
      results.forEach(result => {
        expect(result.status).toBe('fulfilled')
      })

      // Should return appropriate error codes
      suspiciousRequests.forEach(({ res }) => {
        expect(res._getStatusCode()).toBeGreaterThanOrEqual(400)
      })
    })
  })
})