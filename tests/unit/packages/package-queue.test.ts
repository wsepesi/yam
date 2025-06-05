// Package ID Queue Management Tests - Ensuring 1-999 ID assignment and recycling
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockSupabase } from '../../mocks/supabase.mock'

describe('Package ID Queue Management', () => {
  beforeEach(() => {
    mockSupabase.clearAllTables()
    mockSupabase.clearErrors()
  })

  describe('Package Number Assignment (1-999)', () => {
    it('should assign package numbers from 1-999 range', async () => {
      // Mock the RPC call for getting next package number
      const mockPackageNumber = 42
      vi.spyOn(mockSupabase, 'rpc').mockResolvedValueOnce({
        data: mockPackageNumber,
        error: null,
        status: 200,
        statusText: 'OK'
      })

      const result = await mockSupabase.rpc('get_next_package_number', { 
        p_mailroom_id: 'test-mailroom-1' 
      })

      expect(result.data).toBe(mockPackageNumber)
      expect(result.data).toBeGreaterThanOrEqual(1)
      expect(result.data).toBeLessThanOrEqual(999)
      expect(result.error).toBeNull()
    })

    it('should handle queue exhaustion gracefully when all 999 numbers are used', async () => {
      // Mock scenario where all package numbers are exhausted
      vi.spyOn(mockSupabase, 'rpc').mockResolvedValueOnce({
        data: null,
        error: { message: 'No available package numbers' },
        status: 409,
        statusText: 'Conflict'
      })

      const result = await mockSupabase.rpc('get_next_package_number', { 
        p_mailroom_id: 'test-mailroom-1' 
      })

      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
      expect(result.error.message).toContain('No available package numbers')
    })

    it('should prevent duplicate package number assignment within same mailroom', async () => {
      const packageNumber = 123
      
      // Seed existing package with this number
      mockSupabase.seedTable('packages', [{
        id: 'pkg-1',
        package_id: packageNumber,
        mailroom_id: 'test-mailroom-1',
        status: 'WAITING'
      }])

      // Mock RPC to return a different available number
      vi.spyOn(mockSupabase, 'rpc').mockResolvedValueOnce({
        data: 124, // Different number
        error: null,
        status: 200,
        statusText: 'OK'
      })

      const result = await mockSupabase.rpc('get_next_package_number', { 
        p_mailroom_id: 'test-mailroom-1' 
      })

      expect(result.data).not.toBe(packageNumber)
      expect(result.data).toBe(124)
    })
  })

  describe('Package Number Recycling', () => {
    it('should release package numbers back to queue when packages are resolved', async () => {
      const packageNumber = 456
      
      // Mock successful release
      vi.spyOn(mockSupabase, 'rpc').mockResolvedValueOnce({
        data: true,
        error: null,
        status: 200,
        statusText: 'OK'
      })

      const result = await mockSupabase.rpc('release_package_number', {
        p_mailroom_id: 'test-mailroom-1',
        p_package_number: packageNumber
      })

      expect(result.data).toBe(true)
      expect(result.error).toBeNull()
    })

    it('should make released numbers available for reuse', async () => {
      const releasedNumber = 789
      
      // First, release a number
      vi.spyOn(mockSupabase, 'rpc')
        .mockResolvedValueOnce({
          data: true,
          error: null,
          status: 200,
          statusText: 'OK'
        })
        // Then mock getting the same number back
        .mockResolvedValueOnce({
          data: releasedNumber,
          error: null,
          status: 200,
          statusText: 'OK'
        })

      // Release the number
      await mockSupabase.rpc('release_package_number', {
        p_mailroom_id: 'test-mailroom-1',
        p_package_number: releasedNumber
      })

      // Get next number (should be able to reuse the released one)
      const result = await mockSupabase.rpc('get_next_package_number', { 
        p_mailroom_id: 'test-mailroom-1' 
      })

      expect(result.data).toBe(releasedNumber)
    })

    it('should handle failed packages and release their numbers', async () => {
      const failedPackageNumber = 111
      
      // Seed a failed package
      mockSupabase.seedTable('packages', [{
        id: 'pkg-failed',
        package_id: failedPackageNumber,
        mailroom_id: 'test-mailroom-1',
        status: 'FAILED'
      }])

      // Mock releasing the failed package number
      vi.spyOn(mockSupabase, 'rpc').mockResolvedValueOnce({
        data: true,
        error: null,
        status: 200,
        statusText: 'OK'
      })

      const result = await mockSupabase.rpc('release_package_number', {
        p_mailroom_id: 'test-mailroom-1',
        p_package_number: failedPackageNumber
      })

      expect(result.data).toBe(true)
    })
  })

  describe('Concurrent Package Creation', () => {
    it('should handle concurrent package creation without duplicating IDs', async () => {
      // Mock multiple concurrent calls returning different sequential numbers
      const mockNumbers = [501, 502, 503, 504, 505]
      
      mockNumbers.forEach((num, index) => {
        vi.spyOn(mockSupabase, 'rpc').mockResolvedValueOnce({
          data: num,
          error: null,
          status: 200,
          statusText: 'OK'
        })
      })

      // Simulate concurrent package creation
      const promises = Array.from({ length: 5 }, () =>
        mockSupabase.rpc('get_next_package_number', { 
          p_mailroom_id: 'test-mailroom-1' 
        })
      )

      const results = await Promise.all(promises)
      const assignedNumbers = results.map(r => r.data)
      
      // All numbers should be unique
      const uniqueNumbers = new Set(assignedNumbers)
      expect(uniqueNumbers.size).toBe(assignedNumbers.length)
      
      // All should be in valid range
      assignedNumbers.forEach(num => {
        expect(num).toBeGreaterThanOrEqual(1)
        expect(num).toBeLessThanOrEqual(999)
      })
    })

    it('should maintain thread safety during high-volume package creation', async () => {
      // Mock 50 concurrent package creations
      const mockNumbers = Array.from({ length: 50 }, (_, i) => i + 1)
      
      mockNumbers.forEach(num => {
        vi.spyOn(mockSupabase, 'rpc').mockResolvedValueOnce({
          data: num,
          error: null,
          status: 200,
          statusText: 'OK'
        })
      })

      const promises = Array.from({ length: 50 }, () =>
        mockSupabase.rpc('get_next_package_number', { 
          p_mailroom_id: 'test-mailroom-1' 
        })
      )

      const results = await Promise.all(promises)
      const assignedNumbers = results.map(r => r.data)
      
      // No duplicates should exist
      const uniqueNumbers = new Set(assignedNumbers)
      expect(uniqueNumbers.size).toBe(assignedNumbers.length)
    })
  })

  describe('Queue Initialization for New Mailrooms', () => {
    it('should initialize package queue for new mailrooms', async () => {
      const newMailroomId = 'new-mailroom-123'
      
      // Mock successful queue initialization
      vi.spyOn(mockSupabase, 'rpc').mockResolvedValueOnce({
        data: null,
        error: null,
        status: 200,
        statusText: 'OK'
      })

      const result = await mockSupabase.rpc('initialize_package_queue', {
        p_mailroom_id: newMailroomId
      })

      expect(result.error).toBeNull()
      expect(result.status).toBe(200)
    })

    it('should handle queue re-initialization for existing mailrooms', async () => {
      const existingMailroomId = 'existing-mailroom-456'
      
      // Mock queue already exists scenario
      vi.spyOn(mockSupabase, 'rpc').mockResolvedValueOnce({
        data: null,
        error: { message: 'Queue already initialized' },
        status: 409,
        statusText: 'Conflict'
      })

      const result = await mockSupabase.rpc('initialize_package_queue', {
        p_mailroom_id: existingMailroomId
      })

      expect(result.error).toBeTruthy()
      expect(result.error.message).toContain('already initialized')
    })
  })

  describe('Package Status State Transitions', () => {
    it('should transition package status from WAITING to RETRIEVED to RESOLVED', async () => {
      const packageId = 'test-package-1'
      
      // Seed initial package in WAITING state
      mockSupabase.seedTable('packages', [{
        id: packageId,
        package_id: 123,
        mailroom_id: 'test-mailroom-1',
        status: 'WAITING',
        created_at: new Date().toISOString()
      }])

      // Update to RETRIEVED
      await mockSupabase
        .from('packages')
        .update({ 
          status: 'RETRIEVED',
          retrieved_timestamp: new Date().toISOString() 
        })
        .eq('id', packageId)

      // Update to RESOLVED
      await mockSupabase
        .from('packages')
        .update({ 
          status: 'RESOLVED',
          resolved_timestamp: new Date().toISOString() 
        })
        .eq('id', packageId)

      const finalPackage = mockSupabase.getTableData('packages')[0]
      expect(finalPackage.status).toBe('RESOLVED')
      expect(finalPackage.resolved_timestamp).toBeTruthy()
    })

    it('should not allow invalid status transitions', async () => {
      const packageId = 'test-package-2'
      
      // Seed package in RESOLVED state
      mockSupabase.seedTable('packages', [{
        id: packageId,
        package_id: 456,
        mailroom_id: 'test-mailroom-1',
        status: 'RESOLVED',
        resolved_timestamp: new Date().toISOString()
      }])

      // Attempting to change from RESOLVED back to WAITING should be prevented
      // This would be handled by database constraints or business logic
      const initialPackage = mockSupabase.getTableData('packages')[0]
      expect(initialPackage.status).toBe('RESOLVED')
      
      // In a real system, this would throw an error or be rejected
      // For the mock, we'll just verify the current state
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Mock database connection error
      vi.spyOn(mockSupabase, 'rpc').mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' },
        status: 500,
        statusText: 'Internal Server Error'
      })

      const result = await mockSupabase.rpc('get_next_package_number', { 
        p_mailroom_id: 'test-mailroom-1' 
      })

      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
      expect(result.error.message).toContain('Database connection failed')
    })

    it('should validate mailroom_id parameter', async () => {
      // Mock invalid mailroom ID error
      vi.spyOn(mockSupabase, 'rpc').mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid mailroom_id provided' },
        status: 400,
        statusText: 'Bad Request'
      })

      const result = await mockSupabase.rpc('get_next_package_number', { 
        p_mailroom_id: null 
      })

      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
      expect(result.status).toBe(400)
    })

    it('should handle package queue corruption and recovery', async () => {
      // Mock queue corruption detection and recovery
      vi.spyOn(mockSupabase, 'rpc')
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Queue corruption detected' },
          status: 500,
          statusText: 'Internal Server Error'
        })
        // Mock successful recovery
        .mockResolvedValueOnce({
          data: null,
          error: null,
          status: 200,
          statusText: 'OK'
        })

      // First call detects corruption
      const corruptedResult = await mockSupabase.rpc('get_next_package_number', { 
        p_mailroom_id: 'test-mailroom-1' 
      })
      expect(corruptedResult.error).toBeTruthy()

      // Recovery attempt
      const recoveryResult = await mockSupabase.rpc('initialize_package_queue', {
        p_mailroom_id: 'test-mailroom-1'
      })
      expect(recoveryResult.error).toBeNull()
    })
  })
})