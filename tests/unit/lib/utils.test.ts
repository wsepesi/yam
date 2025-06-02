// tests/unit/lib/utils.test.ts
import { describe, expect, it, vi } from 'vitest'

import { cn } from '@/lib/utils'
import { getUserOrg } from '@/lib/userPreferences'
import { supabase } from '@/lib/supabase'

// Mock the supabase module
vi.mock('@/lib/supabase')

describe('Utils', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2')
      expect(cn('class1', undefined, 'class2')).toBe('class1 class2')
    })
  })
})

describe('User Preferences', () => {
  describe('getUserOrg', () => {
    it('should return organization slug for valid user profile', async () => {
      const mockProfile = {
        id: '123',
        organization_id: 'org-123',
        mailroom_id: 'mail-123',
        role: 'user' as const,
        status: 'ACTIVE' as const
      }
      
      // Mock the Supabase RPC call - access the mock directly
      const mockedSupabase = vi.mocked(supabase)
      mockedSupabase.rpc.mockResolvedValueOnce({
        data: 'test-org',
        error: null,
        count: null,
        status: 200,
        statusText: 'OK'
      })
      
      const result = await getUserOrg(mockProfile)
      expect(result).toBe('test-org')
      expect(mockedSupabase.rpc).toHaveBeenCalledWith('get_organization_slug_by_id', {
        org_id_param: mockProfile.organization_id
      })
    })
  })
})