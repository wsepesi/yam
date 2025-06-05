// tests/unit/utils/data-validation.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import getUserId from '@/lib/handleSession'
import { createAdminClient } from '@/lib/supabase'

// Mock the supabase module
vi.mock('@/lib/supabase')

describe('Data Validation Helpers', () => {
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = {
      auth: {
        getUser: vi.fn()
      }
    }
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase)
  })

  describe('getUserId authentication validation', () => {
    it('should extract and validate user ID from valid Bearer token', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      }

      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null
      })

      const authHeader = 'Bearer valid-jwt-token'
      const result = await getUserId(mockSupabase, authHeader)

      expect(result).toBe('user-123')
      expect(mockSupabase.auth.getUser).toHaveBeenCalledWith('valid-jwt-token')
    })

    it('should throw error when authorization header is missing', async () => {
      await expect(getUserId(mockSupabase, undefined)).rejects.toThrow('Unauthorized: Missing or invalid token')
    })

    it('should throw error when authorization header does not start with Bearer', async () => {
      const invalidHeaders = [
        'Basic dXNlcjpwYXNz',
        'Token abc123',
        'invalid-header',
        'Bearer',
        ''
      ]

      for (const header of invalidHeaders) {
        await expect(getUserId(mockSupabase, header)).rejects.toThrow('Unauthorized: Missing or invalid token')
      }
    })

    it('should throw error when token is empty after Bearer', async () => {
      await expect(getUserId(mockSupabase, 'Bearer ')).rejects.toThrow('Unauthorized: Invalid token')
    })

    it('should throw error when auth service returns error', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Invalid token' }
      })

      const authHeader = 'Bearer invalid-token'
      
      await expect(getUserId(mockSupabase, authHeader)).rejects.toThrow('Unauthorized: Invalid token')
    })

    it('should throw error when user data is null', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null
      })

      const authHeader = 'Bearer expired-token'
      
      await expect(getUserId(mockSupabase, authHeader)).rejects.toThrow('Unauthorized: Invalid token')
    })

    it('should handle network/database errors gracefully', async () => {
      mockSupabase.auth.getUser.mockRejectedValueOnce(new Error('Database connection failed'))

      const authHeader = 'Bearer valid-token'
      
      await expect(getUserId(mockSupabase, authHeader)).rejects.toThrow('Database connection failed')
    })

    it('should extract token correctly from complex Bearer headers', async () => {
      const mockUser = { id: 'user-456', email: 'test2@example.com' }
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null
      })

      const authHeader = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.complex.jwt.token'
      const result = await getUserId(mockSupabase, authHeader)

      expect(result).toBe('user-456')
      expect(mockSupabase.auth.getUser).toHaveBeenCalledWith('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.complex.jwt.token')
    })
  })

  describe('General validation helpers', () => {
    describe('Email validation', () => {
      it('should validate correct email formats', () => {
        const validEmails = [
          'test@example.com',
          'user.name@domain.co.uk',
          'student123@university.edu',
          'admin+test@mailroom.org'
        ]

        validEmails.forEach(email => {
          expect(isValidEmail(email)).toBe(true)
        })
      })

      it('should reject invalid email formats', () => {
        const invalidEmails = [
          'invalid-email',
          '@domain.com',
          'user@',
          'user.domain.com',
          '',
          null,
          undefined
        ]

        invalidEmails.forEach(email => {
          expect(isValidEmail(email)).toBe(false)
        })
      })
    })

    describe('Package provider validation', () => {
      it('should validate common package providers', () => {
        const validProviders = [
          'UPS',
          'FedEx',
          'USPS',
          'DHL',
          'Amazon',
          'Personal Delivery'
        ]

        validProviders.forEach(provider => {
          expect(isValidPackageProvider(provider)).toBe(true)
        })
      })

      it('should reject invalid providers', () => {
        const invalidProviders = [
          '',
          '   ',
          null,
          undefined,
          'a'.repeat(101) // Too long
        ]

        invalidProviders.forEach(provider => {
          expect(isValidPackageProvider(provider)).toBe(false)
        })
      })
    })

    describe('Student ID validation', () => {
      it('should validate various student ID formats', () => {
        const validStudentIds = [
          '12345678',
          '0001234567',
          'ABC123',
          'S2024001'
        ]

        validStudentIds.forEach(id => {
          expect(isValidStudentId(id)).toBe(true)
        })
      })

      it('should preserve leading zeros in student IDs', () => {
        const studentIdWithZeros = '0001234'
        expect(normalizeStudentId(studentIdWithZeros)).toBe('0001234')
        expect(normalizeStudentId('  0001234  ')).toBe('0001234')
      })

      it('should reject invalid student IDs', () => {
        const invalidStudentIds = [
          '',
          '   ',
          null,
          undefined,
          'a'.repeat(51), // Too long
          'id with spaces'
        ]

        invalidStudentIds.forEach(id => {
          expect(isValidStudentId(id)).toBe(false)
        })
      })
    })

    describe('Organization/Mailroom slug validation', () => {
      it('should validate proper slug formats', () => {
        const validSlugs = [
          'test-org',
          'university-mailroom-01',
          'dorm-a',
          'main-office'
        ]

        validSlugs.forEach(slug => {
          expect(isValidSlug(slug)).toBe(true)
        })
      })

      it('should reject invalid slug formats', () => {
        const invalidSlugs = [
          'Test Org', // Spaces
          'test_org', // Underscores
          'TEST-ORG', // Uppercase
          'test-org-', // Trailing dash
          '-test-org', // Leading dash
          'test--org', // Double dash
          '',
          'a',
          'a'.repeat(101) // Too long
        ]

        invalidSlugs.forEach(slug => {
          expect(isValidSlug(slug)).toBe(false)
        })
      })
    })

    describe('Package status validation', () => {
      it('should validate allowed package statuses', () => {
        const validStatuses = ['WAITING', 'RETRIEVED', 'RESOLVED', 'FAILED']

        validStatuses.forEach(status => {
          expect(isValidPackageStatus(status)).toBe(true)
        })
      })

      it('should reject invalid package statuses', () => {
        const invalidStatuses = [
          'PENDING',
          'DELIVERED',
          'waiting', // lowercase
          'COMPLETE',
          '',
          null,
          undefined
        ]

        invalidStatuses.forEach(status => {
          expect(isValidPackageStatus(status)).toBe(false)
        })
      })
    })

    describe('User role validation', () => {
      it('should validate allowed user roles', () => {
        const validRoles = ['user', 'manager', 'admin', 'super_admin']

        validRoles.forEach(role => {
          expect(isValidUserRole(role)).toBe(true)
        })
      })

      it('should reject invalid user roles', () => {
        const invalidRoles = [
          'USER', // uppercase
          'staff',
          'owner',
          'moderator',
          '',
          null,
          undefined
        ]

        invalidRoles.forEach(role => {
          expect(isValidUserRole(role)).toBe(false)
        })
      })
    })
  })
})

// Helper validation functions (these would typically be in a separate utility file)
function isValidEmail(email: any): boolean {
  if (typeof email !== 'string') return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

function isValidPackageProvider(provider: any): boolean {
  if (typeof provider !== 'string') return false
  return provider.trim().length > 0 && provider.length <= 100
}

function isValidStudentId(id: any): boolean {
  if (typeof id !== 'string') return false
  const trimmed = id.trim()
  return trimmed.length > 0 && trimmed.length <= 50 && !/\s/.test(trimmed)
}

function normalizeStudentId(id: string): string {
  return id.trim()
}

function isValidSlug(slug: any): boolean {
  if (typeof slug !== 'string') return false
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
  return slugRegex.test(slug) && slug.length >= 2 && slug.length <= 100
}

function isValidPackageStatus(status: any): boolean {
  const validStatuses = ['WAITING', 'RETRIEVED', 'RESOLVED', 'FAILED']
  return validStatuses.includes(status)
}

function isValidUserRole(role: any): boolean {
  const validRoles = ['user', 'manager', 'admin', 'super_admin']
  return validRoles.includes(role)
}