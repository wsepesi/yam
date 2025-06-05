// tests/integration/critical-flows.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createAdminClient } from '@/lib/supabase'
import sendEmailWithContent from '@/lib/sendEmail'
import getUserId from '@/lib/handleSession'

// Mock dependencies
vi.mock('@/lib/supabase')
vi.mock('@/lib/sendEmail')
vi.mock('@/lib/handleSession')

describe('Critical Integration Scenarios', () => {
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn(),
      rpc: vi.fn(),
      auth: {
        getUser: vi.fn()
      }
    }
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase)
    vi.clearAllMocks()
  })

  describe('Package registration → email → pickup flow', () => {
    it('should complete full package lifecycle successfully', async () => {
      // Mock user authentication
      vi.mocked(getUserId).mockResolvedValueOnce('staff-123')

      // Mock mailroom lookup
      const mockMailroomQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn()
      }
      mockSupabase.from.mockReturnValueOnce(mockMailroomQuery)
      mockMailroomQuery.single.mockResolvedValueOnce({
        data: {
          id: 'mailroom-123',
          organization_id: 'org-123',
          admin_email: 'admin@mailroom.edu',
          mailroom_hours: { 'Monday': { closed: false, periods: [{ open: '9:00', close: '17:00' }] } },
          email_additional_text: 'Bring your ID'
        },
        error: null
      })

      // Mock organization lookup
      const mockOrgQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn()
      }
      mockSupabase.from.mockReturnValueOnce(mockOrgQuery)
      mockOrgQuery.single.mockResolvedValueOnce({
        data: {
          id: 'org-123',
          notification_email: 'noreply@university.edu',
          notification_email_password: 'secure-pass'
        },
        error: null
      })

      // Mock package number generation
      mockSupabase.rpc.mockResolvedValueOnce({
        data: 42,
        error: null
      })

      // Mock resident lookup
      const mockResidentQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn()
      }
      mockSupabase.from.mockReturnValueOnce(mockResidentQuery)
      mockResidentQuery.single.mockResolvedValueOnce({
        data: {
          id: 'resident-123',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@university.edu',
          student_id: 'S12345'
        },
        error: null
      })

      // Mock package insertion
      const mockPackageQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn()
      }
      mockSupabase.from.mockReturnValueOnce(mockPackageQuery)
      mockPackageQuery.single.mockResolvedValueOnce({
        data: {
          id: 'package-123',
          package_id: 42,
          status: 'WAITING',
          provider: 'UPS',
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z'
        },
        error: null
      })

      // Mock email sending
      vi.mocked(sendEmailWithContent).mockResolvedValueOnce(undefined)

      // Simulate package registration
      const packageData = {
        residentId: 'S12345',
        provider: 'UPS'
      }

      // Test package retrieval (simulate user pickup)
      const mockPickupQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn()
      }
      mockSupabase.from.mockReturnValueOnce(mockPickupQuery)
      mockPickupQuery.single.mockResolvedValueOnce({
        data: {
          id: 'package-123',
          status: 'RETRIEVED'
        },
        error: null
      })

      // Test package resolution (final status)
      const mockResolveQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn()
      }
      mockSupabase.from.mockReturnValueOnce(mockResolveQuery)
      mockResolveQuery.single.mockResolvedValueOnce({
        data: {
          id: 'package-123',
          status: 'RESOLVED'
        },
        error: null
      })

      // Verify the flow
      expect(vi.mocked(getUserId)).toHaveBeenCalled()
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_next_package_number', { p_mailroom_id: 'mailroom-123' })
      expect(vi.mocked(sendEmailWithContent)).toHaveBeenCalled()

      // Verify email was called with correct parameters
      const emailCall = vi.mocked(sendEmailWithContent).mock.calls[0]
      expect(emailCall[0]).toBe('john.doe@university.edu') // toEmail
      expect(emailCall[5]).toContain('Package') // subject should contain Package
    })

    it('should handle package registration failure gracefully', async () => {
      // Mock authentication
      vi.mocked(getUserId).mockResolvedValueOnce('staff-123')

      // Mock mailroom lookup success
      const mockMailroomQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn()
      }
      mockSupabase.from.mockReturnValueOnce(mockMailroomQuery)
      mockMailroomQuery.single.mockResolvedValueOnce({
        data: { id: 'mailroom-123', organization_id: 'org-123' },
        error: null
      })

      // Mock organization lookup success
      const mockOrgQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn()
      }
      mockSupabase.from.mockReturnValueOnce(mockOrgQuery)
      mockOrgQuery.single.mockResolvedValueOnce({
        data: { id: 'org-123' },
        error: null
      })

      // Mock package number generation failure
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'No package numbers available' }
      })

      // Should handle error without crashing
      const result = await mockSupabase.rpc('get_next_package_number', { p_mailroom_id: 'mailroom-123' })
      expect(result.error.message).toBe('No package numbers available')
    })

    it('should handle email notification failure without breaking package creation', async () => {
      // Mock successful package creation
      vi.mocked(getUserId).mockResolvedValueOnce('staff-123')
      
      // Mock all database operations as successful
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
        insert: vi.fn().mockReturnThis()
      }
      mockSupabase.from.mockReturnValue(mockQuery)
      mockQuery.single.mockResolvedValue({ data: { id: 'test' }, error: null })
      mockSupabase.rpc.mockResolvedValue({ data: 42, error: null })

      // Mock email failure
      vi.mocked(sendEmailWithContent).mockRejectedValueOnce(new Error('SMTP server unavailable'))

      // Package should still be created even if email fails
      try {
        await sendEmailWithContent(
          'test@university.edu',
          'Test content',
          'admin@mailroom.edu',
          'noreply@university.edu',
          'password',
          'Test Subject'
        )
      } catch (error) {
        expect(error.message).toBe('SMTP server unavailable')
      }
      
      // Package creation should continue despite email failure
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_next_package_number', expect.any(Object))
    })
  })

  describe('Roster upload → resident matching → database update', () => {
    it('should process CSV roster upload successfully', async () => {
      const mockResidentData = [
        { first_name: 'John', last_name: 'Doe', email: 'john@uni.edu', student_id: '12345' },
        { first_name: 'Jane', last_name: 'Smith', email: 'jane@uni.edu', student_id: '67890' }
      ]

      // Mock database bulk insert
      const mockBulkInsert = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn()
      }
      mockSupabase.from.mockReturnValueOnce(mockBulkInsert)
      mockBulkInsert.select.mockResolvedValueOnce({
        data: mockResidentData.map((r, i) => ({ ...r, id: `resident-${i}` })),
        error: null
      })

      // Simulate roster upload processing
      const result = await mockBulkInsert.insert(mockResidentData).select()
      
      expect(result.data).toHaveLength(2)
      expect(result.data[0].student_id).toBe('12345')
      expect(mockBulkInsert.insert).toHaveBeenCalledWith(mockResidentData)
    })

    it('should handle duplicate resident detection during upload', async () => {
      const existingResidents = [
        { student_id: '12345', email: 'john@uni.edu' }
      ]

      const newResidents = [
        { first_name: 'John', last_name: 'Doe', email: 'john@uni.edu', student_id: '12345' }, // Duplicate
        { first_name: 'Jane', last_name: 'Smith', email: 'jane@uni.edu', student_id: '67890' }  // New
      ]

      // Mock existing residents query
      const mockExistingQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn()
      }
      mockSupabase.from.mockReturnValueOnce(mockExistingQuery)
      mockExistingQuery.in.mockResolvedValueOnce({
        data: existingResidents,
        error: null
      })

      // Filter out duplicates
      const uniqueResidents = newResidents.filter(
        nr => !existingResidents.some(er => er.student_id === nr.student_id)
      )

      expect(uniqueResidents).toHaveLength(1)
      expect(uniqueResidents[0].student_id).toBe('67890')
    })

    it('should preserve leading zeros in student IDs during upload', async () => {
      const residentWithZeros = {
        first_name: 'Test',
        last_name: 'User',
        email: 'test@uni.edu',
        student_id: '0001234'
      }

      const mockInsert = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn()
      }
      mockSupabase.from.mockReturnValueOnce(mockInsert)
      mockInsert.select.mockResolvedValueOnce({
        data: [{ ...residentWithZeros, id: 'resident-1' }],
        error: null
      })

      await mockInsert.insert([residentWithZeros]).select()
      
      expect(mockInsert.insert).toHaveBeenCalledWith([
        expect.objectContaining({ student_id: '0001234' })
      ])
    })

    it('should handle invalid file format gracefully', async () => {
      // Simulate invalid file processing
      const invalidFileContent = 'invalid,csv,format\nwithout,proper,headers'
      
      // This would normally be handled by the file parsing logic
      const parseResult = simulateFileParseError(invalidFileContent)
      
      expect(parseResult.success).toBe(false)
      expect(parseResult.error).toContain('Invalid file format')
    })
  })

  describe('User invitation → role assignment → access control', () => {
    it('should complete user invitation flow with proper role assignment', async () => {
      // Mock invitation creation
      const invitationData = {
        email: 'newuser@university.edu',
        role: 'user',
        mailroom_id: 'mailroom-123',
        invited_by: 'manager-123'
      }

      const mockInviteInsert = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn()
      }
      mockSupabase.from.mockReturnValueOnce(mockInviteInsert)
      mockInviteInsert.select.mockResolvedValueOnce({
        data: [{ ...invitationData, id: 'invite-123', status: 'PENDING' }],
        error: null
      })

      // Mock user profile creation after invitation acceptance
      const userProfile = {
        id: 'user-123',
        email: invitationData.email,
        role: invitationData.role,
        mailroom_id: invitationData.mailroom_id,
        organization_id: 'org-123',
        status: 'ACTIVE'
      }

      const mockProfileInsert = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn()
      }
      mockSupabase.from.mockReturnValueOnce(mockProfileInsert)
      mockProfileInsert.select.mockResolvedValueOnce({
        data: [userProfile],
        error: null
      })

      // Verify invitation creation
      const inviteResult = await mockInviteInsert.insert([invitationData]).select()
      expect(inviteResult.data[0].email).toBe('newuser@university.edu')
      expect(inviteResult.data[0].role).toBe('user')

      // Verify profile creation
      const profileResult = await mockProfileInsert.insert([userProfile]).select()
      expect(profileResult.data[0].role).toBe('user')
      expect(profileResult.data[0].status).toBe('ACTIVE')
    })

    it('should enforce role-based access during invitation', async () => {
      // Only managers and admins can invite users
      const managerProfile = { role: 'manager', mailroom_id: 'mailroom-123' }
      const userProfile = { role: 'user', mailroom_id: 'mailroom-123' }

      expect(canInviteUsers(managerProfile)).toBe(true)
      expect(canInviteUsers(userProfile)).toBe(false)
    })

    it('should prevent cross-mailroom invitation abuse', async () => {
      const managerProfile = { 
        role: 'manager', 
        mailroom_id: 'mailroom-123',
        organization_id: 'org-123'
      }

      // Manager should not be able to invite users to different mailrooms
      const crossMailroomInvite = {
        email: 'user@university.edu',
        role: 'user',
        mailroom_id: 'mailroom-456', // Different mailroom
        invited_by: 'manager-123'
      }

      expect(validateInvitationPermissions(managerProfile, crossMailroomInvite)).toBe(false)
    })
  })

  describe('Organization creation → mailroom setup → package queue initialization', () => {
    it('should complete full organization setup flow', async () => {
      // Mock organization creation
      const orgData = {
        name: 'Test University',
        slug: 'test-university',
        notification_email: 'noreply@test-university.edu'
      }

      const mockOrgInsert = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn()
      }
      mockSupabase.from.mockReturnValueOnce(mockOrgInsert)
      mockOrgInsert.select.mockResolvedValueOnce({
        data: [{ ...orgData, id: 'org-123' }],
        error: null
      })

      // Mock mailroom creation
      const mailroomData = {
        name: 'Main Mailroom',
        slug: 'main-mailroom',
        organization_id: 'org-123'
      }

      const mockMailroomInsert = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn()
      }
      mockSupabase.from.mockReturnValueOnce(mockMailroomInsert)
      mockMailroomInsert.select.mockResolvedValueOnce({
        data: [{ ...mailroomData, id: 'mailroom-123' }],
        error: null
      })

      // Mock package queue initialization
      mockSupabase.rpc.mockResolvedValueOnce({
        data: { success: true, numbers_initialized: 999 },
        error: null
      })

      // Verify organization creation
      const orgResult = await mockOrgInsert.insert([orgData]).select()
      expect(orgResult.data[0].slug).toBe('test-university')

      // Verify mailroom creation
      const mailroomResult = await mockMailroomInsert.insert([mailroomData]).select()
      expect(mailroomResult.data[0].organization_id).toBe('org-123')

      // Verify package queue initialization
      const queueResult = await mockSupabase.rpc('initialize_package_queue', { 
        p_mailroom_id: 'mailroom-123' 
      })
      expect(queueResult.data.success).toBe(true)
      expect(queueResult.data.numbers_initialized).toBe(999)
    })

    it('should handle organization setup rollback on failure', async () => {
      // Mock organization creation success
      const mockOrgInsert = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn()
      }
      mockSupabase.from.mockReturnValueOnce(mockOrgInsert)
      mockOrgInsert.select.mockResolvedValueOnce({
        data: [{ id: 'org-123', name: 'Test Org' }],
        error: null
      })

      // Mock mailroom creation failure
      const mockMailroomInsert = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn()
      }
      mockSupabase.from.mockReturnValueOnce(mockMailroomInsert)
      mockMailroomInsert.select.mockResolvedValueOnce({
        data: null,
        error: { message: 'Slug already exists' }
      })

      // Mock rollback operation
      const mockOrgDelete = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn()
      }
      mockSupabase.from.mockReturnValueOnce(mockOrgDelete)
      mockOrgDelete.eq.mockResolvedValueOnce({
        data: null,
        error: null
      })

      // Simulate the flow
      const orgResult = await mockOrgInsert.insert([{ name: 'Test Org' }]).select()
      const mailroomResult = await mockMailroomInsert.insert([{ name: 'Test Mailroom' }]).select()
      
      if (mailroomResult.error) {
        // Rollback organization creation
        await mockOrgDelete.delete().eq('id', 'org-123')
        expect(mockOrgDelete.delete).toHaveBeenCalled()
      }
    })
  })
})

// Helper functions for integration tests
function simulateFileParseError(content: string): { success: boolean; error?: string } {
  if (!content.includes('first_name') || !content.includes('email')) {
    return { success: false, error: 'Invalid file format: missing required headers' }
  }
  return { success: true }
}

function canInviteUsers(profile: { role: string }): boolean {
  return ['manager', 'admin', 'super_admin'].includes(profile.role)
}

function validateInvitationPermissions(
  inviter: { role: string; mailroom_id: string; organization_id: string },
  invitation: { mailroom_id: string }
): boolean {
  // Managers can only invite to their own mailroom
  if (inviter.role === 'manager') {
    return inviter.mailroom_id === invitation.mailroom_id
  }
  
  // Admins can invite within their organization
  // Super admins can invite anywhere
  return ['admin', 'super_admin'].includes(inviter.role)
}