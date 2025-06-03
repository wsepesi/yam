// tests/unit/api/packages/get-current.test.ts
import { describe, expect, it, vi } from 'vitest'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase'
import { createMocks } from 'node-mocks-http'
import getUserId from '@/lib/handleSession'
import handler from '@/pages/api/packages/get-current'

// Mock dependencies
vi.mock('@/lib/supabase')
vi.mock('@/lib/handleSession')

describe('/api/packages/get-current', () => {
  it('returns packages for valid mailroom', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: { mailroomId: 'test-mailroom' },
      headers: { authorization: 'Bearer test-token' }
    })

    // Mock successful response
    vi.mocked(getUserId).mockResolvedValue('user-123')
    
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      returns: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'pkg-1',
            provider: 'UPS',
            created_at: '2025-01-01',
            package_id: '001',
            residents: {
              first_name: 'John',
              last_name: 'Doe',
              email: 'john@example.com',
              student_id: '12345'
            }
          }
        ],
        error: null
      })
    }

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(() => mockQuery)
    } as unknown as SupabaseClient)

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data.packages).toHaveLength(1)
    expect(data.packages[0].residentName).toBe('John Doe')
  })

  it('returns 500 for unauthenticated requests', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: { mailroomId: 'test-mailroom' }
    })

    // Mock getUserId to throw an error for unauthenticated requests
    vi.mocked(getUserId).mockRejectedValue(new Error('Unauthorized: Missing or invalid token'))

    await handler(req, res)

    expect(res._getStatusCode()).toBe(500)
  })
})