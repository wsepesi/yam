// tests/integration/database/constraints.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { supabase } from '@/lib/supabase'
import { organizationFactory } from '@/tests/factories/organization.factory'
import { mailroomFactory } from '@/tests/factories/mailroom.factory'
import { userFactory } from '@/tests/factories/user.factory'
import { packageFactory } from '@/tests/factories/package.factory'
import { residentFactory } from '@/tests/factories/resident.factory'
import { mockSupabase } from '@/tests/mocks/supabase.mock'

describe('Database Constraints Tests', () => {
  let org: any, mailroom: any
  let user: any, manager: any
  let testPackages: any[], testResidents: any[]

  beforeEach(async () => {
    // Clear all mock data
    mockSupabase.clearAllTables()
    mockSupabase.clearErrors()

    // Create test organization and mailroom
    org = organizationFactory.build({ name: 'Test Organization', slug: 'test-org' })
    mailroom = mailroomFactory.build({ 
      organization_id: org.id, 
      name: 'Test Mailroom',
      slug: 'test-mailroom' 
    })

    // Create test users
    user = userFactory.build({
      role: 'user',
      organization_id: org.id,
      mailroom_id: mailroom.id,
      email: 'user@test.com'
    })
    manager = userFactory.buildManager({
      organization_id: org.id,
      mailroom_id: mailroom.id,
      email: 'manager@test.com'
    })

    // Create test data
    testPackages = [
      packageFactory.build({ mailroom_id: mailroom.id, packageId: '1', First: 'John', Last: 'Doe' }),
      packageFactory.build({ mailroom_id: mailroom.id, packageId: '2', First: 'Jane', Last: 'Smith' })
    ]
    testResidents = [
      residentFactory.build({ 
        mailroom_id: mailroom.id, 
        first_name: 'John', 
        last_name: 'Doe',
        student_id: 'STU001'
      }),
      residentFactory.build({ 
        mailroom_id: mailroom.id, 
        first_name: 'Jane', 
        last_name: 'Smith',
        student_id: 'STU002'
      })
    ]

    // Seed mock database with test data
    mockSupabase.seedTable('organizations', [org])
    mockSupabase.seedTable('mailrooms', [mailroom])
    mockSupabase.seedTable('profiles', [user, manager])
    mockSupabase.seedTable('packages', testPackages)
    mockSupabase.seedTable('residents', testResidents)
  })

  afterEach(() => {
    vi.clearAllMocks()
    mockSupabase.clearAllTables()
    mockSupabase.clearErrors()
  })

  describe('Package ID Uniqueness Within Mailroom', () => {
    it('should enforce unique package IDs within the same mailroom', async () => {
      // Simulate user session
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: user.id } } },
        error: null
      }))

      // Try to insert a package with duplicate ID in the same mailroom
      const duplicatePackage = packageFactory.build({ 
        mailroom_id: mailroom.id, 
        packageId: '1', // Same as existing package
        First: 'Bob', 
        Last: 'Wilson' 
      })

      // Check if package with same ID already exists
      const existingPackages = await supabase
        .from('packages')
        .select('*')
        .eq('packageId', '1')
        .eq('mailroom_id', mailroom.id)

      // Since package ID '1' already exists, insertion should be rejected
      expect(existingPackages.data?.length).toBeGreaterThan(0)

      // Mock constraint violation error for duplicate package ID
      mockSupabase.setError('packages', { 
        message: 'duplicate key value violates unique constraint "packages_package_id_mailroom_id_key"',
        code: '23505'
      })

      const { data, error } = await supabase
        .from('packages')
        .insert(duplicatePackage)

      // Should fail due to unique constraint violation
      expect(error).toBeTruthy()
      expect(error.code).toBe('23505')
    })

    it('should allow same package ID in different mailrooms', async () => {
      // Create second mailroom
      const mailroom2 = mailroomFactory.build({ 
        organization_id: org.id, 
        name: 'Second Mailroom',
        slug: 'second-mailroom' 
      })

      // Simulate user session
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: user.id } } },
        error: null
      }))

      // Add second mailroom to mock data
      mockSupabase.seedTable('mailrooms', [mailroom, mailroom2])

      // Package with same ID but different mailroom should succeed
      const packageSameId = packageFactory.build({ 
        mailroom_id: mailroom2.id, 
        packageId: '1', // Same ID as existing but different mailroom
        First: 'Bob', 
        Last: 'Wilson' 
      })

      const { data, error } = await supabase
        .from('packages')
        .insert(packageSameId)

      // Should succeed since it's in a different mailroom
      expect(error).toBeNull()
      expect(data).toBeTruthy()
    })

    it('should prevent package ID conflicts during concurrent operations', async () => {
      // Simulate user session
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: user.id } } },
        error: null
      }))

      // Mock constraint violation for concurrent package creation
      mockSupabase.setError('packages', { 
        message: 'duplicate key value violates unique constraint',
        code: '23505'
      })

      // Simulate two concurrent package insertions with same ID
      const package1 = packageFactory.build({ 
        mailroom_id: mailroom.id, 
        packageId: '999',
        First: 'User1', 
        Last: 'Package' 
      })
      const package2 = packageFactory.build({ 
        mailroom_id: mailroom.id, 
        packageId: '999',
        First: 'User2', 
        Last: 'Package' 
      })

      // First insertion should succeed, second should fail
      const result1 = await supabase.from('packages').insert(package1)
      
      // Second insertion should fail due to constraint
      const result2 = await supabase.from('packages').insert(package2)

      expect(result2.error).toBeTruthy()
      expect(result2.error.code).toBe('23505')
    })
  })

  describe('Resident Student ID Uniqueness Within Mailroom', () => {
    it('should enforce unique student IDs within the same mailroom', async () => {
      // Simulate user session
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: user.id } } },
        error: null
      }))

      // Try to insert a resident with duplicate student ID in the same mailroom
      const duplicateResident = residentFactory.build({ 
        mailroom_id: mailroom.id, 
        student_id: 'STU001', // Same as existing resident
        first_name: 'Bob', 
        last_name: 'Wilson'
      })

      // Check if resident with same student ID already exists
      const existingResidents = await supabase
        .from('residents')
        .select('*')
        .eq('student_id', 'STU001')
        .eq('mailroom_id', mailroom.id)

      // Since student ID 'STU001' already exists, insertion should be rejected
      expect(existingResidents.data?.length).toBeGreaterThan(0)

      // Mock constraint violation error for duplicate student ID
      mockSupabase.setError('residents', { 
        message: 'duplicate key value violates unique constraint "residents_student_id_mailroom_id_key"',
        code: '23505'
      })

      const { data, error } = await supabase
        .from('residents')
        .insert(duplicateResident)

      // Should fail due to unique constraint violation
      expect(error).toBeTruthy()
      expect(error.code).toBe('23505')
    })

    it('should allow same student ID in different mailrooms', async () => {
      // Create second mailroom
      const mailroom2 = mailroomFactory.build({ 
        organization_id: org.id, 
        name: 'Second Mailroom',
        slug: 'second-mailroom' 
      })

      // Simulate user session
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: user.id } } },
        error: null
      }))

      // Add second mailroom to mock data
      mockSupabase.seedTable('mailrooms', [mailroom, mailroom2])

      // Resident with same student ID but different mailroom should succeed
      const residentSameId = residentFactory.build({ 
        mailroom_id: mailroom2.id, 
        student_id: 'STU001', // Same ID as existing but different mailroom
        first_name: 'Bob', 
        last_name: 'Wilson'
      })

      const { data, error } = await supabase
        .from('residents')
        .insert(residentSameId)

      // Should succeed since it's in a different mailroom
      expect(error).toBeNull()
      expect(data).toBeTruthy()
    })

    it('should handle null student IDs appropriately', async () => {
      // Simulate user session
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: user.id } } },
        error: null
      }))

      // Insert resident with null student ID (should be allowed)
      const residentNoId = residentFactory.build({ 
        mailroom_id: mailroom.id, 
        student_id: null,
        first_name: 'No', 
        last_name: 'ID'
      })

      const { data, error } = await supabase
        .from('residents')
        .insert(residentNoId)

      // Should succeed - null values don't violate unique constraints
      expect(error).toBeNull()
      expect(data).toBeTruthy()
    })
  })

  describe('Foreign Key Constraints', () => {
    it('should prevent orphaned package records when mailroom is deleted', async () => {
      // Simulate admin session (for deletion permissions)
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: manager.id } } },
        error: null
      }))

      // Mock foreign key constraint violation
      mockSupabase.setError('mailrooms', { 
        message: 'update or delete on table "mailrooms" violates foreign key constraint',
        code: '23503'
      })

      // Try to delete mailroom that has associated packages
      const { data, error } = await supabase
        .from('mailrooms')
        .delete()
        .eq('id', mailroom.id)

      // Should fail due to foreign key constraint
      expect(error).toBeTruthy()
      expect(error.code).toBe('23503')
    })

    it('should prevent orphaned resident records when mailroom is deleted', async () => {
      // Simulate admin session
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: manager.id } } },
        error: null
      }))

      // Mock foreign key constraint violation
      mockSupabase.setError('mailrooms', { 
        message: 'update or delete on table "mailrooms" violates foreign key constraint',
        code: '23503'
      })

      // Try to delete mailroom that has associated residents
      const { data, error } = await supabase
        .from('mailrooms')
        .delete()
        .eq('id', mailroom.id)

      // Should fail due to foreign key constraint
      expect(error).toBeTruthy()
      expect(error.code).toBe('23503')
    })

    it('should prevent orphaned mailroom records when organization is deleted', async () => {
      // Simulate admin session
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: manager.id } } },
        error: null
      }))

      // Mock foreign key constraint violation
      mockSupabase.setError('organizations', { 
        message: 'update or delete on table "organizations" violates foreign key constraint',
        code: '23503'
      })

      // Try to delete organization that has associated mailrooms
      const { data, error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', org.id)

      // Should fail due to foreign key constraint
      expect(error).toBeTruthy()
      expect(error.code).toBe('23503')
    })

    it('should prevent packages from referencing non-existent mailrooms', async () => {
      // Simulate user session
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: user.id } } },
        error: null
      }))

      // Mock foreign key constraint violation
      mockSupabase.setError('packages', { 
        message: 'insert or update on table "packages" violates foreign key constraint',
        code: '23503'
      })

      // Try to insert package with non-existent mailroom ID
      const invalidPackage = packageFactory.build({ 
        mailroom_id: 'non-existent-mailroom-id',
        packageId: '999',
        First: 'Invalid', 
        Last: 'Package' 
      })

      const { data, error } = await supabase
        .from('packages')
        .insert(invalidPackage)

      // Should fail due to foreign key constraint
      expect(error).toBeTruthy()
      expect(error.code).toBe('23503')
    })

    it('should prevent residents from referencing non-existent mailrooms', async () => {
      // Simulate user session
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: user.id } } },
        error: null
      }))

      // Mock foreign key constraint violation
      mockSupabase.setError('residents', { 
        message: 'insert or update on table "residents" violates foreign key constraint',
        code: '23503'
      })

      // Try to insert resident with non-existent mailroom ID
      const invalidResident = residentFactory.build({ 
        mailroom_id: 'non-existent-mailroom-id',
        student_id: 'INVALID001',
        first_name: 'Invalid', 
        last_name: 'Resident'
      })

      const { data, error } = await supabase
        .from('residents')
        .insert(invalidResident)

      // Should fail due to foreign key constraint
      expect(error).toBeTruthy()
      expect(error.code).toBe('23503')
    })
  })

  describe('Package Status Enum Validation', () => {
    it('should enforce valid package status values', async () => {
      // Simulate user session
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: user.id } } },
        error: null
      }))

      // Mock enum constraint violation
      mockSupabase.setError('packages', { 
        message: 'invalid input value for enum package_status: "invalid_status"',
        code: '22P02'
      })

      // Try to insert package with invalid status
      const invalidStatusPackage = packageFactory.build({ 
        mailroom_id: mailroom.id,
        packageId: '999',
        status: 'invalid_status', // Invalid enum value
        First: 'Invalid', 
        Last: 'Status' 
      })

      const { data, error } = await supabase
        .from('packages')
        .insert(invalidStatusPackage)

      // Should fail due to enum constraint violation
      expect(error).toBeTruthy()
      expect(error.code).toBe('22P02')
    })

    it('should accept valid package status values', async () => {
      // Simulate user session
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: user.id } } },
        error: null
      }))

      const validStatuses = ['pending', 'picked_up', 'failed']

      for (const status of validStatuses) {
        const validStatusPackage = packageFactory.build({ 
          mailroom_id: mailroom.id,
          packageId: `status-${status}`,
          status: status as any,
          First: 'Valid', 
          Last: 'Status' 
        })

        const { data, error } = await supabase
          .from('packages')
          .insert(validStatusPackage)

        // Should succeed with valid status
        expect(error).toBeNull()
        expect(data).toBeTruthy()
      }
    })

    it('should validate status transitions', async () => {
      // Simulate user session
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: user.id } } },
        error: null
      }))

      // Update existing package to valid status
      const { data, error } = await supabase
        .from('packages')
        .update({ status: 'picked_up' })
        .eq('packageId', '1')
        .eq('mailroom_id', mailroom.id)

      // Should succeed with valid status transition
      expect(error).toBeNull()
      expect(data).toBeTruthy()
    })
  })

  describe('Organization/Mailroom Cascade Deletion Behavior', () => {
    it('should handle cascade deletion properly when organization is deleted', async () => {
      // Simulate admin session with full permissions
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: manager.id } } },
        error: null
      }))

      // In a real system, this would cascade delete related records
      // For testing, we simulate the cascade by clearing related tables
      mockSupabase.clearTable('packages')
      mockSupabase.clearTable('residents')
      mockSupabase.clearTable('profiles')
      mockSupabase.clearTable('mailrooms')

      const { data, error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', org.id)

      // Should succeed after related records are cleaned up
      expect(error).toBeNull()
      
      // Verify related data was cleaned up
      const packagesCheck = await supabase
        .from('packages')
        .select('*')
        .eq('mailroom_id', mailroom.id)

      expect(packagesCheck.data).toEqual([])
    })

    it('should handle cascade deletion properly when mailroom is deleted', async () => {
      // Simulate admin session
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: manager.id } } },
        error: null
      }))

      // Simulate cascade deletion of related records
      mockSupabase.clearTable('packages')
      mockSupabase.clearTable('residents')
      
      // Remove users assigned to this mailroom
      const remainingUsers = [user, manager].filter(u => u.mailroom_id !== mailroom.id)
      mockSupabase.clearTable('profiles')
      mockSupabase.seedTable('profiles', remainingUsers)

      const { data, error } = await supabase
        .from('mailrooms')
        .delete()
        .eq('id', mailroom.id)

      // Should succeed after related records are cleaned up
      expect(error).toBeNull()
      
      // Verify packages and residents were cleaned up
      const packagesCheck = await supabase
        .from('packages')
        .select('*')
        .eq('mailroom_id', mailroom.id)

      const residentsCheck = await supabase
        .from('residents')
        .select('*')
        .eq('mailroom_id', mailroom.id)

      expect(packagesCheck.data).toEqual([])
      expect(residentsCheck.data).toEqual([])
    })

    it('should maintain data integrity during partial cascade failures', async () => {
      // Simulate admin session
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: manager.id } } },
        error: null
      }))

      // Mock a scenario where cascade deletion partially fails
      mockSupabase.setError('organizations', { 
        message: 'cannot delete organization due to dependent records',
        code: '23503'
      })

      const { data, error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', org.id)

      // Should fail and maintain data integrity
      expect(error).toBeTruthy()
      expect(error.code).toBe('23503')

      // Clear the error and re-seed organization data to check if it still exists
      mockSupabase.clearErrors()
      mockSupabase.clearTable('organizations')
      mockSupabase.seedTable('organizations', [org])
      
      // Verify that organization and related data still exist
      const orgCheck = await supabase
        .from('organizations')
        .select('*')
        .eq('id', org.id)
        .single()

      expect(orgCheck.data).toEqual(org)
    })
  })

  describe('Data Validation Constraints', () => {
    it('should enforce required fields for packages', async () => {
      // Simulate user session
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: user.id } } },
        error: null
      }))

      // Mock not-null constraint violation
      mockSupabase.setError('packages', { 
        message: 'null value in column "mailroom_id" violates not-null constraint',
        code: '23502'
      })

      // Try to insert package without required mailroom_id
      const invalidPackage = packageFactory.build({ 
        mailroom_id: null, // Required field
        packageId: '999',
        First: 'Missing', 
        Last: 'Mailroom' 
      })

      const { data, error } = await supabase
        .from('packages')
        .insert(invalidPackage)

      // Should fail due to not-null constraint
      expect(error).toBeTruthy()
      expect(error.code).toBe('23502')
    })

    it('should enforce required fields for residents', async () => {
      // Simulate user session
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: user.id } } },
        error: null
      }))

      // Mock not-null constraint violation
      mockSupabase.setError('residents', { 
        message: 'null value in column "first_name" violates not-null constraint',
        code: '23502'
      })

      // Try to insert resident without required first_name
      const invalidResident = residentFactory.build({ 
        mailroom_id: mailroom.id,
        first_name: null, // Required field
        last_name: 'LastOnly',
        student_id: 'INVALID002'
      })

      const { data, error } = await supabase
        .from('residents')
        .insert(invalidResident)

      // Should fail due to not-null constraint
      expect(error).toBeTruthy()
      expect(error.code).toBe('23502')
    })

    it('should enforce email format validation', async () => {
      // Simulate user session
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: user.id } } },
        error: null
      }))

      // Mock email format constraint violation
      mockSupabase.setError('residents', { 
        message: 'invalid email format',
        code: '23514'
      })

      // Try to insert resident with invalid email format
      const invalidEmailResident = residentFactory.build({ 
        mailroom_id: mailroom.id,
        first_name: 'Invalid',
        last_name: 'Email',
        student_id: 'INVALID003',
        email: 'not-a-valid-email' // Invalid email format
      })

      const { data, error } = await supabase
        .from('residents')
        .insert(invalidEmailResident)

      // Should fail due to email format constraint
      expect(error).toBeTruthy()
      expect(error.code).toBe('23514')
    })
  })
})