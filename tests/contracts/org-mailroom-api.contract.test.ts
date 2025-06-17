// tests/contracts/org-mailroom-api.contract.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextApiRequest, NextApiResponse } from 'next'
import { createMocks } from 'node-mocks-http'

// Test handlers
import createOrgHandler from '@/pages/api/organizations/create'
import listAllOrgsHandler from '@/pages/api/organizations/list-all'
import orgDetailsHandler from '@/pages/api/organizations/details'
import createMailroomHandler from '@/pages/api/mailrooms/create'
import mailroomDetailsHandler from '@/pages/api/mailrooms/details'
import populatePackageQueueHandler from '@/pages/api/mailrooms/populate-package-queue'

// Mock modules
vi.mock('@/lib/supabase')
vi.mock('@/lib/handleSession')

describe('Organization & Mailroom API Contract Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/organizations/create', () => {
    it('should create organization with correct request/response schema', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        headers: {
          authorization: 'Bearer test-token'
        },
        body: {
          name: 'Test University',
          slug: 'test-university',
          status: 'ACTIVE'
        }
      })

      // Mock authentication and authorization
      const mockHandleSession = await import('@/lib/handleSession')
      vi.mocked(mockHandleSession.default).mockResolvedValue('user-id')

      const mockSupabase = await import('@/lib/supabase')
      const mockNewOrg = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test University',
        slug: 'test-university',
        created_by: 'user-id',
        status: 'PENDING_SETUP',
        created_at: '2023-01-01T00:00:00Z'
      }
      
      // Track call count to return different responses for different calls
      let fromCallCount = 0
      vi.mocked(mockSupabase.createAdminClient).mockReturnValue({
        from: vi.fn((table) => {
          fromCallCount++
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ 
                data: { role: 'super-admin' }, 
                error: null 
              })
            }
          } else if (table === 'organizations') {
            if (fromCallCount === 2) {
              // This is the slug check call
              return {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
              }
            } else {
              // This is the insert call
              return {
                insert: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ 
                  data: mockNewOrg, 
                  error: null 
                })
              }
            }
          }
          return {}
        })
      } as any)

      await createOrgHandler(req, res)

      expect(res._getStatusCode()).toBe(201)
      const responseData = JSON.parse(res._getData())
      
      // Validate response schema - should return the created organization
      expect(responseData).toMatchObject({
        name: expect.any(String),
        slug: expect.any(String),
        created_by: expect.any(String),
        status: expect.any(String)
      })
    })

    it('should return 400 for missing required fields', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        headers: {
          authorization: 'Bearer test-token'
        },
        body: {
          name: 'Test University'
          // Missing slug
        }
      })

      await createOrgHandler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('error')
      expect(typeof responseData.error).toBe('string')
    })

    it('should return 403 for non-super-admin users', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        headers: {
          authorization: 'Bearer test-token'
        },
        body: {
          name: 'Test University',
          slug: 'test-university'
        }
      })

      // Mock authentication but non-super-admin role
      const mockHandleSession = await import('@/lib/handleSession')
      vi.mocked(mockHandleSession.default).mockResolvedValue('user-id')

      const mockSupabase = await import('@/lib/supabase')
      vi.mocked(mockSupabase.createAdminClient).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ 
            data: { role: 'user' }, 
            error: null 
          })
        }))
      } as any)

      await createOrgHandler(req, res)

      expect(res._getStatusCode()).toBe(403)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('error')
    })

    it('should validate slug format', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        headers: {
          authorization: 'Bearer test-token'
        },
        body: {
          name: 'Test University',
          slug: 'Invalid Slug!' // Invalid format
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
            data: { role: 'super-admin' }, 
            error: null 
          })
        }))
      } as any)

      await createOrgHandler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const responseData = JSON.parse(res._getData())
      expect(responseData.error).toContain('Invalid slug format')
    })
  })

  describe('GET /api/organizations/list-all', () => {
    it('should return organizations list with correct response schema', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        headers: {
          authorization: 'Bearer test-token'
        }
      })

      // Mock authentication
      const mockHandleSession = await import('@/lib/handleSession')
      vi.mocked(mockHandleSession.default).mockResolvedValue('user-id')

      const mockOrganizations = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test University',
          slug: 'test-university',
          status: 'ACTIVE',
          created_at: '2023-01-01T00:00:00Z',
          created_by: 'user-id'
        }
      ]

      const mockSupabase = await import('@/lib/supabase')
      const mockOrgsWithCounts = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test University',
          slug: 'test-university',
          created_at: '2023-01-01T00:00:00Z',
          status: 'ACTIVE',
          mailrooms: [{ count: 2 }],
          profiles: [{ count: 15 }]
        }
      ]
      
      vi.mocked(mockSupabase.createAdminClient).mockReturnValue({
        from: vi.fn((table) => {
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ 
                data: { role: 'super-admin' }, 
                error: null 
              })
            }
          } else if (table === 'organizations') {
            return {
              select: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({ 
                data: mockOrgsWithCounts, 
                error: null 
              })
            }
          }
          return {}
        })
      } as any)

      await listAllOrgsHandler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const responseData = JSON.parse(res._getData())
      
      // Validate response schema - should match OrganizationListItem interface
      expect(Array.isArray(responseData)).toBe(true)
      if (responseData.length > 0) {
        expect(responseData[0]).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          slug: expect.any(String),
          createdAt: expect.any(String), // Note: formatted as camelCase
          status: expect.any(String),
          totalMailrooms: expect.any(Number),
          totalUsers: expect.any(Number)
        })
      }
    })
  })

  describe('GET /api/organizations/details', () => {
    it('should return organization details with correct response schema', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        headers: {
          authorization: 'Bearer test-token'
        },
        query: {
          slug: 'test-university'
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
            data: { 
              id: '123e4567-e89b-12d3-a456-426614174000',
              name: 'Test University'
            }, 
            error: null 
          })
        }))
      } as any)

      await orgDetailsHandler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const responseData = JSON.parse(res._getData())
      
      // Validate response schema
      expect(responseData).toMatchObject({
        organizationId: expect.any(String),
        organizationName: expect.any(String)
      })
    })

    it('should return 404 for non-existent organization', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        headers: {
          authorization: 'Bearer test-token'
        },
        query: {
          slug: 'non-existent'
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
            error: { code: 'PGRST116' }
          })
        }))
      } as any)

      await orgDetailsHandler(req, res)

      expect(res._getStatusCode()).toBe(404)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('error')
    })
  })

  describe('POST /api/mailrooms/create', () => {
    it('should create mailroom with correct request/response schema', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        headers: {
          authorization: 'Bearer test-token'
        },
        body: {
          name: 'Test Mailroom',
          slug: 'test-mailroom',
          organizationId: '123e4567-e89b-12d3-a456-426614174000',
          adminEmail: 'admin@test.edu'
        }
      })

      // Mock authentication and authorization
      const mockHandleSession = await import('@/lib/handleSession')
      vi.mocked(mockHandleSession.default).mockResolvedValue('user-id')

      const mockSupabase = await import('@/lib/supabase')
      const mockNewMailroom = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Test Mailroom',
        slug: 'test-mailroom',
        organization_id: '123e4567-e89b-12d3-a456-426614174000',
        created_by: 'user-id',
        status: 'ACTIVE',
        admin_email: 'admin@test.edu',
        created_at: '2023-01-01T00:00:00Z'
      }
      
      vi.mocked(mockSupabase.createAdminClient).mockReturnValue({
        from: vi.fn((table) => {
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ 
                data: { 
                  role: 'admin',
                  organization_id: '123e4567-e89b-12d3-a456-426614174000',
                  email: 'admin@test.edu'
                }, 
                error: null 
              })
            }
          } else if (table === 'mailrooms') {
            return {
              insert: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ 
                data: mockNewMailroom, 
                error: null 
              })
            }
          }
          return {}
        })
      } as any)

      await createMailroomHandler(req, res)

      expect(res._getStatusCode()).toBe(201)
      const responseData = JSON.parse(res._getData())
      
      // Validate response schema - should return the created mailroom
      expect(responseData).toMatchObject({
        name: expect.any(String),
        slug: expect.any(String),
        organization_id: expect.any(String),
        created_by: expect.any(String),
        admin_email: expect.any(String)
      })
    })

    it('should return 400 for missing required fields', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        headers: {
          authorization: 'Bearer test-token'
        },
        body: {
          name: 'Test Mailroom'
          // Missing slug, organizationId, adminEmail
        }
      })

      await createMailroomHandler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('error')
      expect(typeof responseData.error).toBe('string')
    })

    it('should return 403 for unauthorized users', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        headers: {
          authorization: 'Bearer test-token'
        },
        body: {
          name: 'Test Mailroom',
          slug: 'test-mailroom',
          organizationId: '123e4567-e89b-12d3-a456-426614174000',
          adminEmail: 'admin@test.edu'
        }
      })

      // Mock authentication but unauthorized role
      const mockHandleSession = await import('@/lib/handleSession')
      vi.mocked(mockHandleSession.default).mockResolvedValue('user-id')

      const mockSupabase = await import('@/lib/supabase')
      vi.mocked(mockSupabase.createAdminClient).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ 
            data: { 
              role: 'user',
              organization_id: 'different-org-id'
            }, 
            error: null 
          })
        }))
      } as any)

      await createMailroomHandler(req, res)

      expect(res._getStatusCode()).toBe(403)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('error')
    })
  })

  describe('GET /api/mailrooms/details', () => {
    it('should return mailroom details with correct response schema', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        headers: {
          authorization: 'Bearer test-token'
        },
        query: {
          orgSlug: 'test-university',
          mailroomSlug: 'test-mailroom'
        }
      })

      // Mock authentication
      const mockHandleSession = await import('@/lib/handleSession')
      vi.mocked(mockHandleSession.default).mockResolvedValue('user-id')

      const mockSupabase = await import('@/lib/supabase')
      vi.mocked(mockSupabase.createAdminClient).mockReturnValue({
        from: vi.fn((table) => {
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ 
                data: { 
                  role: 'admin',
                  organization_id: '123e4567-e89b-12d3-a456-426614174000'
                }, 
                error: null 
              })
            }
          } else if (table === 'organizations') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ 
                data: { id: '123e4567-e89b-12d3-a456-426614174000' }, 
                error: null 
              })
            }
          } else if (table === 'mailrooms') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ 
                data: { 
                  id: '123e4567-e89b-12d3-a456-426614174001',
                  organization_id: '123e4567-e89b-12d3-a456-426614174000'
                }, 
                error: null 
              })
            }
          }
          return {}
        })
      } as any)

      await mailroomDetailsHandler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const responseData = JSON.parse(res._getData())
      
      // Validate response schema - API returns organizationId and mailroomId
      expect(responseData).toMatchObject({
        organizationId: expect.any(String),
        mailroomId: expect.any(String)
      })
    })
  })

  describe('POST /api/mailrooms/populate-package-queue', () => {
    it('should handle package queue population with correct schema', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        headers: {
          authorization: 'Bearer test-token'
        },
        body: {
          mailroomId: '123e4567-e89b-12d3-a456-426614174001'
        }
      })

      // Mock authentication
      const mockHandleSession = await import('@/lib/handleSession')
      vi.mocked(mockHandleSession.default).mockResolvedValue('user-id')

      const mockSupabase = await import('@/lib/supabase')
      vi.mocked(mockSupabase.createAdminClient).mockReturnValue({
        from: vi.fn((table) => {
          if (table === 'package_ids') {
            return {
              insert: vi.fn().mockResolvedValue({ 
                data: null, 
                error: null 
              })
            }
          }
          return {}
        })
      } as any)

      await populatePackageQueueHandler(req, res)

      // Should return success response - API returns 201 with message
      expect(res._getStatusCode()).toBe(201)
      
      const responseData = JSON.parse(res._getData())
      expect(responseData).toMatchObject({
        message: expect.any(String)
      })
    })

    it('should return 400 for missing mailroomId', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        headers: {
          authorization: 'Bearer test-token'
        },
        body: {}
      })

      await populatePackageQueueHandler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('error')
    })
  })
})