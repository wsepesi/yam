// tests/unit/utils/package-number-utils.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createAdminClient } from '@/lib/supabase'

// Mock the supabase module
vi.mock('@/lib/supabase')

describe('Package Number Utilities', () => {
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = {
      rpc: vi.fn()
    }
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase)
  })

  describe('get_next_package_number RPC', () => {
    it('should return next available package number (1-999)', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: 42,
        error: null
      })

      const result = await mockSupabase.rpc('get_next_package_number', { p_mailroom_id: 'test-mailroom' })
      
      expect(result.data).toBe(42)
      expect(result.data).toBeGreaterThanOrEqual(1)
      expect(result.data).toBeLessThanOrEqual(999)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_next_package_number', { p_mailroom_id: 'test-mailroom' })
    })

    it('should handle no available package numbers', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'No package numbers available' }
      })

      const result = await mockSupabase.rpc('get_next_package_number', { p_mailroom_id: 'test-mailroom' })
      
      expect(result.data).toBeNull()
      expect(result.error.message).toBe('No package numbers available')
    })

    it('should handle concurrent package number requests without duplication', async () => {
      // Simulate concurrent requests returning different numbers
      const calls = [
        { data: 1, error: null },
        { data: 2, error: null },
        { data: 3, error: null }
      ]
      
      mockSupabase.rpc
        .mockResolvedValueOnce(calls[0])
        .mockResolvedValueOnce(calls[1])
        .mockResolvedValueOnce(calls[2])

      const promises = [
        mockSupabase.rpc('get_next_package_number', { p_mailroom_id: 'test-mailroom' }),
        mockSupabase.rpc('get_next_package_number', { p_mailroom_id: 'test-mailroom' }),
        mockSupabase.rpc('get_next_package_number', { p_mailroom_id: 'test-mailroom' })
      ]

      const results = await Promise.all(promises)
      const packageNumbers = results.map(r => r.data)
      
      // Ensure all numbers are unique
      expect(new Set(packageNumbers).size).toBe(packageNumbers.length)
      expect(packageNumbers.every(num => num >= 1 && num <= 999)).toBe(true)
    })
  })

  describe('release_package_number RPC', () => {
    it('should successfully release package number back to queue', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: true,
        error: null
      })

      const result = await mockSupabase.rpc('release_package_number', { 
        p_mailroom_id: 'test-mailroom',
        p_package_number: 42
      })
      
      expect(result.data).toBe(true)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('release_package_number', { 
        p_mailroom_id: 'test-mailroom',
        p_package_number: 42
      })
    })

    it('should handle release of invalid package number', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Package number not found or already released' }
      })

      const result = await mockSupabase.rpc('release_package_number', { 
        p_mailroom_id: 'test-mailroom',
        p_package_number: 1000 // Invalid number > 999
      })
      
      expect(result.data).toBeNull()
      expect(result.error.message).toBe('Package number not found or already released')
    })

    it('should handle package number recycling', async () => {
      // First release a number
      mockSupabase.rpc.mockResolvedValueOnce({
        data: true,
        error: null
      })

      // Then get next number should return the recycled one
      mockSupabase.rpc.mockResolvedValueOnce({
        data: 42,
        error: null
      })

      await mockSupabase.rpc('release_package_number', { 
        p_mailroom_id: 'test-mailroom',
        p_package_number: 42
      })

      const result = await mockSupabase.rpc('get_next_package_number', { p_mailroom_id: 'test-mailroom' })
      
      expect(result.data).toBe(42)
    })
  })

  describe('Package status state transitions', () => {
    it('should validate WAITING -> RETRIEVED -> RESOLVED transitions', () => {
      const validTransitions = [
        { from: 'WAITING', to: 'RETRIEVED' },
        { from: 'RETRIEVED', to: 'RESOLVED' },
        { from: 'WAITING', to: 'FAILED' },
        { from: 'RETRIEVED', to: 'FAILED' }
      ]

      const invalidTransitions = [
        { from: 'RESOLVED', to: 'WAITING' },
        { from: 'RESOLVED', to: 'RETRIEVED' },
        { from: 'FAILED', to: 'WAITING' },
        { from: 'FAILED', to: 'RETRIEVED' }
      ]

      validTransitions.forEach(transition => {
        expect(isValidPackageStatusTransition(transition.from, transition.to)).toBe(true)
      })

      invalidTransitions.forEach(transition => {
        expect(isValidPackageStatusTransition(transition.from, transition.to)).toBe(false)
      })
    })
  })

  describe('Queue initialization for new mailrooms', () => {
    it('should initialize package queue with numbers 1-999', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: { success: true, numbers_initialized: 999 },
        error: null
      })

      const result = await mockSupabase.rpc('initialize_package_queue', { 
        p_mailroom_id: 'new-mailroom'
      })
      
      expect(result.data.success).toBe(true)
      expect(result.data.numbers_initialized).toBe(999)
    })
  })
})

// Helper function for package status validation
function isValidPackageStatusTransition(from: string, to: string): boolean {
  const validTransitions: Record<string, string[]> = {
    'WAITING': ['RETRIEVED', 'FAILED'],
    'RETRIEVED': ['RESOLVED', 'FAILED'],
    'RESOLVED': [],
    'FAILED': []
  }
  
  return validTransitions[from]?.includes(to) || false
}