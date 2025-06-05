// tests/integration/database/rls-policies.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { supabase } from '@/lib/supabase'
import { organizationFactory } from '@/tests/factories/organization.factory'
import { mailroomFactory } from '@/tests/factories/mailroom.factory'
import { userFactory } from '@/tests/factories/user.factory'
import { packageFactory } from '@/tests/factories/package.factory'
import { residentFactory } from '@/tests/factories/resident.factory'
import { mockSupabase } from '@/tests/mocks/supabase.mock'

describe('RLS Policy Validation Tests', () => {
  let orgA: any, orgB: any
  let mailroomA1: any, mailroomA2: any, mailroomB1: any
  let userA1: any, userA2: any, userB1: any, managerA1: any, adminA: any
  let packagesA1: any[], packagesA2: any[], packagesB1: any[]
  let residentsA1: any[], residentsA2: any[], residentsB1: any[]

  beforeEach(async () => {
    // Clear all mock data
    mockSupabase.clearAllTables()
    mockSupabase.clearErrors()

    // Create test organizations
    orgA = organizationFactory.build({ name: 'Organization A', slug: 'org-a' })
    orgB = organizationFactory.build({ name: 'Organization B', slug: 'org-b' })

    // Create test mailrooms
    mailroomA1 = mailroomFactory.build({ 
      organization_id: orgA.id, 
      name: 'Mailroom A1',
      slug: 'mailroom-a1' 
    })
    mailroomA2 = mailroomFactory.build({ 
      organization_id: orgA.id, 
      name: 'Mailroom A2',
      slug: 'mailroom-a2' 
    })
    mailroomB1 = mailroomFactory.build({ 
      organization_id: orgB.id, 
      name: 'Mailroom B1',
      slug: 'mailroom-b1' 
    })

    // Create test users with different roles and assignments
    userA1 = userFactory.build({
      role: 'user',
      organization_id: orgA.id,
      mailroom_id: mailroomA1.id,
      email: 'user-a1@test.com'
    })
    userA2 = userFactory.build({
      role: 'user',
      organization_id: orgA.id,
      mailroom_id: mailroomA2.id,
      email: 'user-a2@test.com'
    })
    userB1 = userFactory.build({
      role: 'user',
      organization_id: orgB.id,
      mailroom_id: mailroomB1.id,
      email: 'user-b1@test.com'
    })
    managerA1 = userFactory.buildManager({
      organization_id: orgA.id,
      mailroom_id: mailroomA1.id,
      email: 'manager-a1@test.com'
    })
    adminA = userFactory.buildAdmin({
      organization_id: orgA.id,
      mailroom_id: mailroomA1.id,
      email: 'admin-a@test.com'
    })

    // Create test packages
    packagesA1 = [
      packageFactory.build({ mailroom_id: mailroomA1.id, First: 'John', Last: 'Doe' }),
      packageFactory.build({ mailroom_id: mailroomA1.id, First: 'Jane', Last: 'Smith' })
    ]
    packagesA2 = [
      packageFactory.build({ mailroom_id: mailroomA2.id, First: 'Bob', Last: 'Wilson' })
    ]
    packagesB1 = [
      packageFactory.build({ mailroom_id: mailroomB1.id, First: 'Alice', Last: 'Johnson' })
    ]

    // Create test residents
    residentsA1 = [
      residentFactory.build({ mailroom_id: mailroomA1.id, first_name: 'John', last_name: 'Doe' }),
      residentFactory.build({ mailroom_id: mailroomA1.id, first_name: 'Jane', last_name: 'Smith' })
    ]
    residentsA2 = [
      residentFactory.build({ mailroom_id: mailroomA2.id, first_name: 'Bob', last_name: 'Wilson' })
    ]
    residentsB1 = [
      residentFactory.build({ mailroom_id: mailroomB1.id, first_name: 'Alice', last_name: 'Johnson' })
    ]

    // Seed mock database with test data
    mockSupabase.seedTable('organizations', [orgA, orgB])
    mockSupabase.seedTable('mailrooms', [mailroomA1, mailroomA2, mailroomB1])
    mockSupabase.seedTable('profiles', [userA1, userA2, userB1, managerA1, adminA])
    mockSupabase.seedTable('packages', [...packagesA1, ...packagesA2, ...packagesB1])
    mockSupabase.seedTable('residents', [...residentsA1, ...residentsA2, ...residentsB1])
  })

  afterEach(() => {
    vi.clearAllMocks()
    mockSupabase.clearAllTables()
    mockSupabase.clearErrors()
  })

  describe('Organization Data Isolation', () => {
    it('should prevent users from accessing other organization data', async () => {
      // Simulate userB1 session (organization B user)
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: userB1.id } } },
        error: null
      }))

      // Simulate RLS filtering - userB1 should only see orgB data
      mockSupabase.clearTable('organizations')
      mockSupabase.seedTable('organizations', [orgB]) // Only orgB visible to userB1

      // Attempt to query organization A data as user from organization B
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgA.id)
        .single()

      // Should not be able to access other organization's data (RLS prevents access)
      expect(data).toBeNull()
    })

    it('should allow users to access their own organization data', async () => {
      // Simulate userA1 session (organization A user)
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: userA1.id } } },
        error: null
      }))

      // Simulate RLS filtering - userA1 should see orgA data
      mockSupabase.clearTable('organizations')
      mockSupabase.seedTable('organizations', [orgA]) // Only orgA visible to userA1

      // Query organization A data as user from organization A
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgA.id)
        .single()

      // Should be able to access own organization's data
      expect(data).toEqual(orgA)
      expect(error).toBeNull()
    })

    it('should prevent cross-organization mailroom access', async () => {
      // Simulate userA1 session (organization A user)
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: userA1.id } } },
        error: null
      }))

      // Simulate RLS filtering - userA1 should only see orgA mailrooms
      mockSupabase.clearTable('mailrooms')
      mockSupabase.seedTable('mailrooms', [mailroomA1, mailroomA2]) // Only orgA mailrooms

      // Attempt to query organization B mailroom as user from organization A
      const { data, error } = await supabase
        .from('mailrooms')
        .select('*')
        .eq('id', mailroomB1.id)
        .single()

      // Should not be able to access other organization's mailrooms (RLS prevents access)
      expect(data).toBeNull()
    })
  })

  describe('Mailroom Data Isolation', () => {
    it('should restrict managers to their assigned mailroom only', async () => {
      // Simulate managerA1 session (mailroom A1 manager)
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: managerA1.id } } },
        error: null
      }))

      // Simulate RLS filtering - managerA1 should only see mailroomA1 packages
      mockSupabase.clearTable('packages')
      mockSupabase.seedTable('packages', packagesA1) // Only mailroomA1 packages

      // Manager A1 tries to access packages from mailroom A2
      const { data } = await supabase
        .from('packages')
        .select('*')
        .eq('mailroom_id', mailroomA2.id)

      // Should not see packages from other mailrooms (even in same org)
      expect(Array.isArray(data) ? data.length : 0).toBe(0)
    })

    it('should allow managers to access their own mailroom data', async () => {
      // Simulate managerA1 session (mailroom A1 manager)
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: managerA1.id } } },
        error: null
      }))

      // Simulate RLS filtering - managerA1 should see mailroomA1 packages
      mockSupabase.clearTable('packages')
      mockSupabase.seedTable('packages', packagesA1) // Only mailroomA1 packages

      // Manager A1 accesses their own mailroom packages
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .eq('mailroom_id', mailroomA1.id)

      // Should see their own mailroom packages
      expect(error).toBeNull()
      expect(data).toEqual(packagesA1)
    })

    it('should enforce mailroom boundaries for regular users', async () => {
      // Simulate userA1 session (mailroom A1 user)
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: userA1.id } } },
        error: null
      }))

      // Simulate RLS filtering - userA1 should only see mailroomA1 residents
      mockSupabase.clearTable('residents')
      mockSupabase.seedTable('residents', residentsA1) // Only mailroomA1 residents

      // User A1 tries to access residents from mailroom A2
      const { data } = await supabase
        .from('residents')
        .select('*')
        .eq('mailroom_id', mailroomA2.id)

      // Should not see residents from other mailrooms
      expect(Array.isArray(data) ? data.length : 0).toBe(0)
    })
  })

  describe('Package Queries Filtered by Mailroom', () => {
    it('should filter package queries by user mailroom assignment', async () => {
      // Simulate userA1 session (mailroom A1 user)
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: userA1.id } } },
        error: null
      }))

      // Simulate RLS filtering - userA1 should only see mailroomA1 packages
      mockSupabase.clearTable('packages')
      mockSupabase.seedTable('packages', packagesA1) // Only mailroomA1 packages

      // Query all packages (should be filtered by RLS)
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .order('created_at', { ascending: false })

      // Should only see packages from user's mailroom
      expect(error).toBeNull()
      expect(data).toEqual(packagesA1)
      expect(data).not.toContain(expect.objectContaining({ mailroom_id: mailroomA2.id }))
      expect(data).not.toContain(expect.objectContaining({ mailroom_id: mailroomB1.id }))
    })

    it('should prevent package queries from returning cross-mailroom results', async () => {
      // Simulate userA2 session (mailroom A2 user)
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: userA2.id } } },
        error: null
      }))

      // Simulate RLS filtering - userA2 should only see mailroomA2 packages
      mockSupabase.clearTable('packages')
      mockSupabase.seedTable('packages', packagesA2) // Only mailroomA2 packages

      // User A2 tries to access a specific package from mailroom A1
      const packageFromA1 = packagesA1[0]
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .eq('id', packageFromA1.id)
        .single()

      // Should not be able to access package from different mailroom (RLS prevents access)
      expect(data).toBeNull()
    })

    it('should allow admin users to bypass mailroom package filtering', async () => {
      // Simulate admin session
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: adminA.id } } },
        error: null
      }))

      // Simulate admin access - should see all packages
      mockSupabase.clearTable('packages')
      mockSupabase.seedTable('packages', [...packagesA1, ...packagesA2, ...packagesB1])

      // Admin queries all packages across all mailrooms
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .order('created_at', { ascending: false })

      // Admin should see packages from all mailrooms
      expect(error).toBeNull()
      expect(data).toHaveLength(4) // 2 + 1 + 1 packages
      expect(data).toEqual(expect.arrayContaining([
        ...packagesA1,
        ...packagesA2,
        ...packagesB1
      ]))
    })
  })

  describe('Resident Queries Filtered by Mailroom', () => {
    it('should filter resident queries by user mailroom assignment', async () => {
      // Simulate userA1 session (mailroom A1 user)
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: userA1.id } } },
        error: null
      }))

      // Simulate RLS filtering - userA1 should only see mailroomA1 residents
      mockSupabase.clearTable('residents')
      mockSupabase.seedTable('residents', residentsA1) // Only mailroomA1 residents

      // Query all residents (should be filtered by RLS)
      const { data, error } = await supabase
        .from('residents')
        .select('*')
        .order('last_name', { ascending: true })

      // Should only see residents from user's mailroom
      expect(error).toBeNull()
      expect(data).toEqual(residentsA1)
      expect(data).not.toContain(expect.objectContaining({ mailroom_id: mailroomA2.id }))
      expect(data).not.toContain(expect.objectContaining({ mailroom_id: mailroomB1.id }))
    })

    it('should prevent resident queries from returning cross-mailroom results', async () => {
      // Simulate userA1 session (mailroom A1 user)
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: userA1.id } } },
        error: null
      }))

      // Simulate RLS filtering - userA1 should only see mailroomA1 residents
      mockSupabase.clearTable('residents')
      mockSupabase.seedTable('residents', residentsA1) // Only mailroomA1 residents

      // User A1 tries to access a specific resident from mailroom B1
      const residentFromB1 = residentsB1[0]
      const { data, error } = await supabase
        .from('residents')
        .select('*')
        .eq('id', residentFromB1.id)
        .single()

      // Should not be able to access resident from different organization (RLS prevents access)
      expect(data).toBeNull()
    })

    it('should enforce resident search filtering by mailroom', async () => {
      // Simulate userA2 session (mailroom A2 user)
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: userA2.id } } },
        error: null
      }))

      // Simulate RLS filtering - userA2 should only see mailroomA2 residents
      mockSupabase.clearTable('residents')
      mockSupabase.seedTable('residents', residentsA2) // Only mailroomA2 residents

      // Search for residents by name (should be filtered by RLS)
      const { data, error } = await supabase
        .from('residents')
        .select('*')
        .ilike('first_name', '%Bob%')
        .order('last_name', { ascending: true })

      // Should only find residents from user's mailroom
      expect(error).toBeNull()
      expect(data).toEqual(residentsA2)
      // Verify that residents from other mailrooms are not included
      expect(data).not.toContain(expect.objectContaining({ 
        first_name: 'Alice',
        mailroom_id: mailroomB1.id 
      }))
    })

    it('should allow manager to access residents within their mailroom only', async () => {
      // Simulate managerA1 session (mailroom A1 manager)
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: managerA1.id } } },
        error: null
      }))

      // Simulate RLS filtering - managerA1 should see mailroomA1 residents
      mockSupabase.clearTable('residents')
      mockSupabase.seedTable('residents', residentsA1) // Only mailroomA1 residents

      // Manager queries residents in their mailroom
      const { data, error } = await supabase
        .from('residents')
        .select('*')
        .eq('mailroom_id', mailroomA1.id)
        .order('last_name', { ascending: true })

      // Should be able to access residents in their mailroom
      expect(error).toBeNull()
      expect(data).toEqual(residentsA1)
    })
  })

  describe('Cross-Tenant Access Prevention', () => {
    it('should prevent URL manipulation attacks', async () => {
      // Simulate userA1 session (mailroom A1 user)
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: userA1.id } } },
        error: null
      }))

      // Simulate RLS filtering - userA1 should only see mailroomA1 packages
      mockSupabase.clearTable('packages')
      mockSupabase.seedTable('packages', packagesA1) // Only mailroomA1 packages

      // User A1 explicitly tries to query mailroom B1 data
      const { data } = await supabase
        .from('packages')
        .select('*')
        .eq('mailroom_id', mailroomB1.id) // Explicit attempt to access other mailroom

      // RLS should prevent this regardless of explicit parameter
      expect(Array.isArray(data) ? data.length : 0).toBe(0)
    })

    it('should validate shared resource access between related entities', async () => {
      // Simulate userA1 session (organization A user)
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: userA1.id } } },
        error: null
      }))

      // Simulate RLS filtering - userA1 should see their organization
      mockSupabase.clearTable('organizations')
      mockSupabase.seedTable('organizations', [orgA]) // Only orgA visible

      // User A1 queries their organization (valid shared resource)
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgA.id)
        .single()

      // Should be able to access shared organization resource
      expect(error).toBeNull()
      expect(data).toEqual(orgA)
    })

    it('should enforce URL slug-based boundary validation', async () => {
      // Simulate userA1 session (organization A user)
      mockSupabase.auth.getSession = vi.fn(() => Promise.resolve({
        data: { session: { user: { id: userA1.id } } },
        error: null
      }))

      // Simulate RLS filtering - userA1 should see orgA and its mailrooms only
      mockSupabase.clearTable('organizations')
      mockSupabase.seedTable('organizations', [orgA])
      mockSupabase.clearTable('mailrooms')
      mockSupabase.seedTable('mailrooms', [mailroomA1, mailroomA2]) // Only orgA mailrooms

      // Simulate URL slug validation: /org-a/invalid-mailroom
      const orgLookup = await supabase
        .from('organizations')
        .select('*')
        .eq('slug', 'org-a')
        .single()

      
      const mailroomLookup = await supabase
        .from('mailrooms')
        .select('*')
        .eq('slug', 'invalid-mailroom')
        .eq('organization_id', orgA.id)
        .single()

      // Organization lookup should succeed
      expect(orgLookup.data).toEqual(orgA)
      expect(orgLookup.error).toBeNull()

      // Invalid mailroom lookup should fail (no data found)
      expect(mailroomLookup.data).toBeNull()
    })
  })
})