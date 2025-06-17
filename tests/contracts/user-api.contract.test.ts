// tests/contracts/user-api.contract.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextApiRequest, NextApiResponse } from 'next'
import { createMocks } from 'node-mocks-http'

// Test handlers
import usersMailroomHandler from '@/pages/api/users/mailroom'
import managersIndexHandler from '@/pages/api/managers/index'
import managersUpdateHandler from '@/pages/api/managers/[id]'

// Mock modules
vi.mock('@/lib/supabase')
vi.mock('@/lib/handleSession')

describe('User API Contract Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/users/mailroom', () => {
    it('should return users and invitations with correct response schema', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        headers: {
          authorization: 'Bearer test-token'
        },
        query: {
          mailroomId: 'mailroom-123'
        }
      })

      // Mock authentication
      const mockHandleSession = await import('@/lib/handleSession')
      vi.mocked(mockHandleSession.default).mockResolvedValue('user-id')

      const mockUsers = [
        {
          id: 'user-1',
          role: 'manager',
          created_at: '2023-01-01T00:00:00Z',
          email: 'manager@test.edu',
          status: 'ACTIVE'
        }
      ]

      const mockInvitations = [
        {
          id: 'inv-1',
          email: 'pending@test.edu',
          role: 'user',
          created_at: '2023-01-01T00:00:00Z',
          expires_at: '2023-01-08T00:00:00Z',
          status: 'PENDING'
        }
      ]

      // Simplified mock setup to prevent timeout issues
      const mockSupabase = await import('@/lib/supabase')
      
      let profileCallCount = 0
      
      vi.mocked(mockSupabase.createAdminClient).mockReturnValue({
        from: vi.fn((table) => {
          if (table === 'profiles') {
            profileCallCount++
            if (profileCallCount === 1) {
              // First profile call - user auth check
              return {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ 
                  data: { 
                    role: 'admin',
                    organization_id: 'org-id',
                    mailroom_id: 'mailroom-123'
                  }, 
                  error: null 
                })
              }
            } else {
              // Second profile call - users query
              return {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockResolvedValue({ 
                  data: mockUsers, 
                  error: null 
                })
              }
            }
          } else if (table === 'mailrooms') {
            // Mailroom validation
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ 
                data: { 
                  id: 'mailroom-123',
                  organization_id: 'org-id'
                }, 
                error: null 
              })
            }
          } else if (table === 'invitations') {
            // Invitations query with two eq() calls
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ 
                  data: mockInvitations, 
                  error: null 
                })
              }))
            }
          }
          return {}
        })
      } as any)

      await usersMailroomHandler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const responseData = JSON.parse(res._getData())
      
      // Validate response schema
      expect(responseData).toMatchObject({
        users: expect.any(Array),
        invitations: expect.any(Array)
      })

      if (responseData.users.length > 0) {
        expect(responseData.users[0]).toMatchObject({
          id: expect.any(String),
          role: expect.any(String),
          created_at: expect.any(String),
          email: expect.any(String),
          status: expect.any(String)
        })
      }

      if (responseData.invitations.length > 0) {
        expect(responseData.invitations[0]).toMatchObject({
          id: expect.any(String),
          email: expect.any(String),
          role: expect.any(String),
          created_at: expect.any(String),
          expires_at: expect.any(String),
          status: expect.any(String)
        })
      }
    })

    it('should return 400 for missing mailroomId', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        headers: {
          authorization: 'Bearer test-token'
        },
        query: {} // Missing mailroomId
      })

      await usersMailroomHandler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('error')
      expect(responseData.error).toContain('Missing or invalid mailroom ID')
    })

    it('should return 405 for non-GET methods', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST'
      })

      await usersMailroomHandler(req, res)

      expect(res._getStatusCode()).toBe(405)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('error', 'Method not allowed')
    })
  })

  describe('GET /api/managers', () => {
    it('should return managers list with correct response schema', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        headers: {
          authorization: 'Bearer test-token'
        },
        query: {
          mailroomId: 'mailroom-123'
        }
      })

      // Mock authentication
      const mockHandleSession = await import('@/lib/handleSession')
      vi.mocked(mockHandleSession.default).mockResolvedValue('user-id')

      const mockManagers = [
        {
          id: 'manager-1',
          role: 'manager',
          created_at: '2023-01-01T00:00:00Z'
        }
      ]

      const mockUsers = [
        {
          id: 'manager-1',
          email: 'manager1@test.edu'
        }
      ]

      const mockSupabase = await import('@/lib/supabase')
      
      // Track calls to handle multiple queries
      let callCount = 0
      const mockSupabaseClient = {
        from: vi.fn((table) => {
          callCount++
          if (callCount === 1 && table === 'profiles') {
            // User profile check
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ 
                data: { 
                  role: 'admin',
                  organization_id: 'org-id',
                  mailroom_id: 'mailroom-123'
                }, 
                error: null 
              })
            }
          } else if (callCount === 2 && table === 'mailrooms') {
            // Mailroom check
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ 
                data: { organization_id: 'org-id' }, 
                error: null 
              })
            }
          } else if (callCount === 3 && table === 'profiles') {
            // Managers query
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({ 
                data: mockManagers, 
                error: null 
              })
            }
          } else if (callCount === 4 && table === 'users') {
            // User emails query
            return {
              select: vi.fn().mockReturnThis(),
              in: vi.fn().mockResolvedValue({ 
                data: mockUsers, 
                error: null 
              })
            }
          }
          return {}
        })
      }
      
      // Mock the supabase client
      Object.defineProperty(mockSupabase, 'supabase', {
        value: mockSupabaseClient,
        writable: true
      })

      await managersIndexHandler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const responseData = JSON.parse(res._getData())
      
      // Validate response schema - array of formatted managers
      expect(Array.isArray(responseData)).toBe(true)
      if (responseData.length > 0) {
        expect(responseData[0]).toMatchObject({
          id: expect.any(String),
          email: expect.any(String),
          role: expect.any(String),
          createdAt: expect.any(String)
        })
      }
    })

    it('should return 400 for missing mailroomId', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        headers: {
          authorization: 'Bearer test-token'
        },
        query: {} // Missing mailroomId
      })

      await managersIndexHandler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('error')
      expect(responseData.error).toContain('Missing required mailroomId parameter')
    })

    it('should return 405 for non-GET methods', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST'
      })

      await managersIndexHandler(req, res)

      expect(res._getStatusCode()).toBe(405)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('error', 'Method not allowed')
    })
  })

  describe('PUT /api/managers/[id]', () => {
    it('should update manager with correct request/response schema', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'PUT',
        headers: {
          authorization: 'Bearer test-token'
        },
        query: {
          id: 'manager-id'
        },
        body: {
          role: 'user',
          status: 'ACTIVE'
        }
      })

      // Mock authentication
      const mockHandleSession = await import('@/lib/handleSession')
      vi.mocked(mockHandleSession.default).mockResolvedValue('admin-user-id')

      const mockSupabase = await import('@/lib/supabase')
      let callCount = 0
      vi.mocked(mockSupabase.createAdminClient).mockReturnValue({
        from: vi.fn((table) => {
          callCount++
          if (callCount === 1 && table === 'profiles') {
            // Admin user profile check
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ 
                data: { 
                  role: 'admin',
                  organization_id: 'org-id',
                  mailroom_id: 'mailroom-123'
                }, 
                error: null 
              })
            }
          } else if (callCount === 2 && table === 'profiles') {
            // Target manager profile check
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ 
                data: { 
                  role: 'manager',
                  organization_id: 'org-id',
                  mailroom_id: 'mailroom-123'
                }, 
                error: null 
              })
            }
          } else if (callCount === 3 && table === 'profiles') {
            // Update query
            return {
              update: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ 
                data: {}, 
                error: null 
              })
            }
          }
          return {}
        })
      } as any)

      await managersUpdateHandler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const responseData = JSON.parse(res._getData())
      
      // Validate response schema
      expect(responseData).toMatchObject({
        message: expect.any(String)
      })
      expect(responseData.message).toContain('updated successfully')
    })

    it('should return 400 for missing required fields', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'PUT',
        headers: {
          authorization: 'Bearer test-token'
        },
        query: {
          id: 'manager-id'
        },
        body: {
          // Missing role
        }
      })

      await managersUpdateHandler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('error')
      expect(responseData.error).toContain('Missing required parameters')
    })

    it('should return 400 for invalid role', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'PUT',
        headers: {
          authorization: 'Bearer test-token'
        },
        query: {
          id: 'manager-id'
        },
        body: {
          role: 'invalid-role'
        }
      })

      await managersUpdateHandler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('error')
      expect(responseData.error).toContain('Invalid target role value')
    })

    it('should return 405 for non-PUT methods', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET'
      })

      await managersUpdateHandler(req, res)

      expect(res._getStatusCode()).toBe(405)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('error', 'Method not allowed')
    })
  })
})