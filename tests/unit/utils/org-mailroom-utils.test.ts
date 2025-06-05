// tests/unit/utils/org-mailroom-utils.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { 
  getUserOrg, 
  getUserMailroom, 
  getUserRedirectPath,
  getMailroomDisplayName,
  getOrgDisplayName,
  DEFAULT_ORG,
  DEFAULT_MAILROOM
} from '@/lib/userPreferences'
import { supabase } from '@/lib/supabase'

// Mock the supabase module
vi.mock('@/lib/supabase')

// Mock localStorage for browser environment tests
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn()
}

// Mock global localStorage for Node.js environment
Object.defineProperty(global, 'localStorage', { 
  value: localStorageMock,
  writable: true
})

// Also mock window.localStorage if it exists
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', { value: localStorageMock })
}

describe('Organization and Mailroom Utilities', () => {
  const mockUserProfile = {
    id: 'user-123',
    organization_id: 'org-123',
    mailroom_id: 'mail-123',
    role: 'user' as const,
    status: 'ACTIVE' as const
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  describe('getUserOrg', () => {
    it('should return organization slug for valid user profile', async () => {
      const mockedSupabase = vi.mocked(supabase)
      mockedSupabase.rpc.mockResolvedValueOnce({
        data: 'test-org',
        error: null,
        count: null,
        status: 200,
        statusText: 'OK'
      })

      const result = await getUserOrg(mockUserProfile)
      
      expect(result).toBe('test-org')
      expect(mockedSupabase.rpc).toHaveBeenCalledWith('get_organization_slug_by_id', {
        org_id_param: mockUserProfile.organization_id
      })
    })

    it('should return DEFAULT_ORG when user profile is null', async () => {
      const result = await getUserOrg(null)
      expect(result).toBe(DEFAULT_ORG)
    })

    it('should return DEFAULT_ORG when organization_id is missing', async () => {
      const profileWithoutOrg = { ...mockUserProfile, organization_id: undefined }
      const result = await getUserOrg(profileWithoutOrg as any)
      expect(result).toBe(DEFAULT_ORG)
    })

    it('should return DEFAULT_ORG when RPC call fails', async () => {
      const mockedSupabase = vi.mocked(supabase)
      mockedSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Organization not found' },
        count: null,
        status: 404,
        statusText: 'Not Found'
      })

      const result = await getUserOrg(mockUserProfile)
      expect(result).toBe(DEFAULT_ORG)
    })

    it('should handle RPC exceptions gracefully', async () => {
      const mockedSupabase = vi.mocked(supabase)
      mockedSupabase.rpc.mockRejectedValueOnce(new Error('Network error'))

      const result = await getUserOrg(mockUserProfile)
      expect(result).toBe(DEFAULT_ORG)
    })
  })

  describe('getUserMailroom', () => {
    it('should return mailroom slug for valid user profile', async () => {
      const mockedSupabase = vi.mocked(supabase)
      mockedSupabase.rpc.mockResolvedValueOnce({
        data: 'test-mailroom',
        error: null,
        count: null,
        status: 200,
        statusText: 'OK'
      })

      const result = await getUserMailroom(mockUserProfile)
      
      expect(result).toBe('test-mailroom')
      expect(mockedSupabase.rpc).toHaveBeenCalledWith('get_mailroom_slug_by_id', {
        mailroom_id_param: mockUserProfile.mailroom_id
      })
    })

    it('should return DEFAULT_MAILROOM when user profile is null', async () => {
      const result = await getUserMailroom(null)
      expect(result).toBe(DEFAULT_MAILROOM)
    })

    it('should return DEFAULT_MAILROOM when mailroom_id is missing', async () => {
      const profileWithoutMailroom = { ...mockUserProfile, mailroom_id: undefined }
      const result = await getUserMailroom(profileWithoutMailroom as any)
      expect(result).toBe(DEFAULT_MAILROOM)
    })
  })

  describe('getUserRedirectPath', () => {
    it('should return correct path when both org and mailroom are found', async () => {
      const mockedSupabase = vi.mocked(supabase)
      mockedSupabase.rpc
        .mockResolvedValueOnce({ data: 'test-org', error: null })
        .mockResolvedValueOnce({ data: 'test-mailroom', error: null })

      const result = await getUserRedirectPath(mockUserProfile)
      expect(result).toBe('/test-org/test-mailroom')
    })

    it('should throw error when both org and mailroom are defaults', async () => {
      const mockedSupabase = vi.mocked(supabase)
      mockedSupabase.rpc
        .mockResolvedValueOnce({ data: null, error: { message: 'Not found' } })
        .mockResolvedValueOnce({ data: null, error: { message: 'Not found' } })

      await expect(getUserRedirectPath(mockUserProfile)).rejects.toThrow('No organization or mailroom found')
    })

    it('should work with partial data (org found, mailroom default)', async () => {
      const mockedSupabase = vi.mocked(supabase)
      mockedSupabase.rpc
        .mockResolvedValueOnce({ data: 'test-org', error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'Not found' } })

      const result = await getUserRedirectPath(mockUserProfile)
      expect(result).toBe('/test-org/default')
    })
  })

  describe('getMailroomDisplayName', () => {
    it('should return cached display name when available', async () => {
      localStorageMock.getItem.mockReturnValue('CACHED MAILROOM')

      const result = await getMailroomDisplayName('test-mailroom')
      
      expect(result).toBe('CACHED MAILROOM')
      expect(localStorageMock.getItem).toHaveBeenCalledWith('mailroom-name-test-mailroom')
    })

    it('should fetch and cache display name when not cached', async () => {
      const mockedSupabase = vi.mocked(supabase)
      mockedSupabase.rpc.mockResolvedValueOnce({
        data: 'test mailroom',
        error: null
      })

      const result = await getMailroomDisplayName('test-mailroom')
      
      expect(result).toBe('TEST MAILROOM')
      expect(mockedSupabase.rpc).toHaveBeenCalledWith('get_mailroom_name_by_slug', {
        mailroom_slug_param: 'test-mailroom'
      })
      expect(localStorageMock.setItem).toHaveBeenCalledWith('mailroom-name-test-mailroom', 'TEST MAILROOM')
    })

    it('should handle case conversion correctly', async () => {
      const mockedSupabase = vi.mocked(supabase)
      mockedSupabase.rpc.mockResolvedValueOnce({
        data: 'MiXeD cAsE mAiLrOoM',
        error: null
      })

      const result = await getMailroomDisplayName('TEST-MAILROOM')
      
      expect(result).toBe('MIXED CASE MAILROOM')
      expect(mockedSupabase.rpc).toHaveBeenCalledWith('get_mailroom_name_by_slug', {
        mailroom_slug_param: 'test-mailroom'
      })
    })

    it('should return null when mailroom not found', async () => {
      const mockedSupabase = vi.mocked(supabase)
      mockedSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Mailroom not found' }
      })

      const result = await getMailroomDisplayName('nonexistent-mailroom')
      expect(result).toBeNull()
    })

    it('should handle RPC exceptions gracefully', async () => {
      const mockedSupabase = vi.mocked(supabase)
      mockedSupabase.rpc.mockRejectedValueOnce(new Error('Network error'))

      const result = await getMailroomDisplayName('test-mailroom')
      expect(result).toBeNull()
    })
  })

  describe('getOrgDisplayName', () => {
    it('should return organization display name in uppercase', async () => {
      const mockedSupabase = vi.mocked(supabase)
      mockedSupabase.rpc.mockResolvedValueOnce({
        data: 'test organization',
        error: null
      })

      const result = await getOrgDisplayName('test-org')
      
      expect(result).toBe('TEST ORGANIZATION')
      expect(mockedSupabase.rpc).toHaveBeenCalledWith('get_organization_name_by_slug', {
        org_slug_param: 'test-org'
      })
    })

    it('should handle case conversion with slug parameter', async () => {
      const mockedSupabase = vi.mocked(supabase)
      mockedSupabase.rpc.mockResolvedValueOnce({
        data: 'university name',
        error: null
      })

      const result = await getOrgDisplayName('UNIVERSITY-NAME')
      
      expect(result).toBe('UNIVERSITY NAME')
      expect(mockedSupabase.rpc).toHaveBeenCalledWith('get_organization_name_by_slug', {
        org_slug_param: 'university-name'
      })
    })

    it('should return null when organization not found', async () => {
      const mockedSupabase = vi.mocked(supabase)
      mockedSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Organization not found' }
      })

      const result = await getOrgDisplayName('nonexistent-org')
      expect(result).toBeNull()
    })

    it('should handle RPC exceptions gracefully', async () => {
      const mockedSupabase = vi.mocked(supabase)
      mockedSupabase.rpc.mockRejectedValueOnce(new Error('Database connection failed'))

      const result = await getOrgDisplayName('test-org')
      expect(result).toBeNull()
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle empty string slugs', async () => {
      const result1 = await getMailroomDisplayName('')
      const result2 = await getOrgDisplayName('')
      
      expect(result1).toBeNull()
      expect(result2).toBeNull()
    })

    it('should handle special characters in slugs', async () => {
      const mockedSupabase = vi.mocked(supabase)
      mockedSupabase.rpc.mockResolvedValueOnce({
        data: 'Special Org',
        error: null
      })

      const result = await getOrgDisplayName('org-with-special-chars-123')
      expect(result).toBe('SPECIAL ORG')
    })

    it('should handle localStorage not available (SSR)', async () => {
      // Mock window as undefined to simulate SSR
      const originalWindow = global.window
      delete (global as any).window

      const mockedSupabase = vi.mocked(supabase)
      mockedSupabase.rpc.mockResolvedValueOnce({
        data: 'test mailroom',
        error: null
      })

      const result = await getMailroomDisplayName('test-mailroom')
      
      expect(result).toBe('TEST MAILROOM')
      
      // Restore window
      if (originalWindow) {
        global.window = originalWindow
      }
    })
  })
})