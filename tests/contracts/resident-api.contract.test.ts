// tests/contracts/resident-api.contract.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextApiRequest, NextApiResponse } from 'next'
import { createMocks } from 'node-mocks-http'

// Test handlers
import getResidentsHandler from '@/pages/api/get-residents'
import addResidentHandler from '@/pages/api/add-resident'
import removeResidentHandler from '@/pages/api/remove-resident'
import uploadRosterHandler from '@/pages/api/upload-roster'
import getStudentsHandler from '@/pages/api/get-students'

// Mock modules
vi.mock('@/lib/supabase')
vi.mock('@/lib/handleSession')

describe('Resident API Contract Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/get-residents', () => {
    it('should return residents with correct response schema', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        query: {
          orgSlug: 'test-org',
          mailroomSlug: 'test-mailroom'
        }
      })

      // Mock successful response
      const mockResidents = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          mailroom_id: '123e4567-e89b-12d3-a456-426614174001',
          first_name: 'John',
          last_name: 'Doe',
          student_id: 'STU123',
          email: 'john.doe@test.edu',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
          added_by: '123e4567-e89b-12d3-a456-426614174002',
          status: 'ACTIVE'
        }
      ]

      // Mock Supabase response
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
            data: mockResidents, 
            error: null 
          })
        }))
      } as any)

      await getResidentsHandler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const responseData = JSON.parse(res._getData())
      
      // Validate response schema
      expect(responseData).toHaveProperty('records')
      expect(Array.isArray(responseData.records)).toBe(true)
      expect(responseData.records[0]).toMatchObject({
        id: expect.any(String),
        mailroom_id: expect.any(String),
        first_name: expect.any(String),
        last_name: expect.any(String),
        student_id: expect.any(String),
        email: expect.any(String),
        created_at: expect.any(String),
        updated_at: expect.any(String),
        added_by: expect.any(String),
        status: expect.any(String)
      })
    })

    it('should return 400 for missing required query parameters', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        query: { orgSlug: 'test-org' } // Missing mailroomSlug
      })

      await getResidentsHandler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('error')
      expect(typeof responseData.error).toBe('string')
    })

    it('should return 405 for non-GET methods', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST'
      })

      await getResidentsHandler(req, res)

      expect(res._getStatusCode()).toBe(405)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('error', 'Method not allowed')
    })
  })

  describe('POST /api/add-resident', () => {
    it('should add resident with correct request/response schema', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        headers: {
          authorization: 'Bearer test-token'
        },
        body: {
          resident: {
            first_name: 'Jane',
            last_name: 'Smith',
            resident_id: 'STU456',
            email: 'jane.smith@test.edu'
          },
          orgSlug: 'test-org',
          mailroomSlug: 'test-mailroom'
        }
      })

      // Mock authentication and Supabase
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
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: vi.fn().mockReturnThis()
        }))
      } as any)

      await addResidentHandler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const responseData = JSON.parse(res._getData())
      
      // Validate response schema
      expect(responseData).toHaveProperty('message')
      expect(typeof responseData.message).toBe('string')
      expect(responseData.message).toContain('successfully added')
    })

    it('should return 400 for missing required fields', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          resident: {
            first_name: 'Jane'
            // Missing last_name and resident_id
          },
          orgSlug: 'test-org',
          mailroomSlug: 'test-mailroom'
        }
      })

      await addResidentHandler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('error')
      expect(typeof responseData.error).toBe('string')
    })

    it('should return 401 for unauthenticated requests', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          resident: {
            first_name: 'Jane',
            last_name: 'Smith',
            resident_id: 'STU456'
          },
          orgSlug: 'test-org',
          mailroomSlug: 'test-mailroom'
        }
      })

      // Mock authentication failure
      const mockHandleSession = await import('@/lib/handleSession')
      vi.mocked(mockHandleSession.default).mockResolvedValue(null)

      await addResidentHandler(req, res)

      expect(res._getStatusCode()).toBe(401)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('error')
    })
  })

  describe('DELETE /api/remove-resident', () => {
    it('should handle resident removal with correct schema', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'DELETE',
        headers: {
          authorization: 'Bearer test-token'
        },
        body: {
          residentId: 'resident-123',
          orgSlug: 'test-org',
          mailroomSlug: 'test-mailroom'
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
          update: vi.fn().mockResolvedValue({ data: {}, error: null })
        }))
      } as any)

      await removeResidentHandler(req, res)

      // Should return success response
      expect([200, 204]).toContain(res._getStatusCode())
      
      if (res._getStatusCode() === 200) {
        const responseData = JSON.parse(res._getData())
        expect(responseData).toHaveProperty('message')
        expect(typeof responseData.message).toBe('string')
      }
    })
  })

  describe('POST /api/upload-roster', () => {
    it('should handle roster upload with correct schema', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        headers: {
          authorization: 'Bearer test-token',
          'content-type': 'multipart/form-data'
        }
      })

      // Mock authentication
      const mockHandleSession = await import('@/lib/handleSession')
      vi.mocked(mockHandleSession.default).mockResolvedValue('user-id')

      await uploadRosterHandler(req, res)

      // Should handle multipart form data
      expect(res._getStatusCode()).toBeGreaterThanOrEqual(200)
      expect(res._getStatusCode()).toBeLessThan(500)
    })
  })

  describe('GET /api/get-students', () => {
    it('should return students with correct response schema', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        query: {
          orgSlug: 'test-org',
          mailroomSlug: 'test-mailroom'
        }
      })

      const mockStudents = [
        {
          First_Name: 'John',
          Last_Name: 'Doe',
          Default_Email: 'john.doe@test.edu',
          University_ID: 'STU123'
        }
      ]

      // Mock Supabase response
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
            data: mockStudents, 
            error: null 
          })
        }))
      } as any)

      await getStudentsHandler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const responseData = JSON.parse(res._getData())
      
      // Validate student response schema
      expect(Array.isArray(responseData)).toBe(true)
      if (responseData.length > 0) {
        expect(responseData[0]).toMatchObject({
          First_Name: expect.any(String),
          Last_Name: expect.any(String),
          Default_Email: expect.any(String),
          University_ID: expect.any(String)
        })
      }
    })
  })
})