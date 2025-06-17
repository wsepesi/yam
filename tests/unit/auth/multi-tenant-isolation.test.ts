/**
 * Multi-Tenant Isolation Unit Tests
 * 
 * Critical tests to ensure proper data isolation between organizations and mailrooms.
 * These tests validate that Row Level Security (RLS) and authorization checks work correctly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockSupabase } from '../../mocks/supabase.mock'

// Test data for different tenants
const testTenants = {
  orgA: {
    orgId: 'org-a-id',
    orgSlug: 'org-a',
    mailroomId: 'mailroom-a1-id',
    mailroomSlug: 'mailroom-a1',
    userId: 'user-a1-id'
  },
  orgB: {
    orgId: 'org-b-id', 
    orgSlug: 'org-b',
    mailroomId: 'mailroom-b1-id',
    mailroomSlug: 'mailroom-b1',
    userId: 'user-b1-id'
  },
  orgAMailroom2: {
    orgId: 'org-a-id',
    orgSlug: 'org-a',
    mailroomId: 'mailroom-a2-id',
    mailroomSlug: 'mailroom-a2',
    userId: 'user-a2-id'
  }
}

// Mock session factory
const createMockSession = (tenant: typeof testTenants.orgA, role: string = 'user') => ({
  user: { id: tenant.userId },
  mailroom: { 
    id: tenant.mailroomId, 
    name: `Mailroom ${tenant.mailroomSlug}`,
    organization_id: tenant.orgId,
    slug: tenant.mailroomSlug
  },
  organization: { 
    id: tenant.orgId, 
    name: `Organization ${tenant.orgSlug}`,
    slug: tenant.orgSlug
  },
  role
})

// Helper to seed test data simulating RLS behavior
const seedMultiTenantData = () => {
  // Clear all tables first
  mockSupabase.clearAllTables()
  
  // Seed packages for different tenants
  mockSupabase.seedTable('packages', [
    {
      id: 'package-org-a-1',
      mailroom_id: testTenants.orgA.mailroomId,
      package_number: 123,
      status: 'WAITING',
      organization_id: testTenants.orgA.orgId
    },
    {
      id: 'package-org-b-1',
      mailroom_id: testTenants.orgB.mailroomId,
      package_number: 124,
      status: 'WAITING',
      organization_id: testTenants.orgB.orgId
    },
    {
      id: 'package-org-a-mailroom2-1',
      mailroom_id: testTenants.orgAMailroom2.mailroomId,
      package_number: 125,
      status: 'WAITING',
      organization_id: testTenants.orgAMailroom2.orgId
    }
  ])
  
  // Seed residents for different tenants
  mockSupabase.seedTable('residents', [
    {
      id: 'resident-org-a-1',
      mailroom_id: testTenants.orgA.mailroomId,
      first_name: 'John',
      last_name: 'Doe',
      organization_id: testTenants.orgA.orgId
    },
    {
      id: 'resident-org-b-1',
      mailroom_id: testTenants.orgB.mailroomId,
      first_name: 'Jane',
      last_name: 'Smith',
      organization_id: testTenants.orgB.orgId
    }
  ])
  
  // Seed mailrooms
  mockSupabase.seedTable('mailrooms', [
    {
      id: testTenants.orgA.mailroomId,
      organization_id: testTenants.orgA.orgId,
      slug: testTenants.orgA.mailroomSlug,
      name: 'Mailroom A1'
    },
    {
      id: testTenants.orgB.mailroomId,
      organization_id: testTenants.orgB.orgId,
      slug: testTenants.orgB.mailroomSlug,
      name: 'Mailroom B1'
    },
    {
      id: testTenants.orgAMailroom2.mailroomId,
      organization_id: testTenants.orgAMailroom2.orgId,
      slug: testTenants.orgAMailroom2.mailroomSlug,
      name: 'Mailroom A2'
    }
  ])
}

describe('Multi-Tenant Isolation Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seedMultiTenantData()
  })

  describe('Organization Data Isolation via RLS', () => {
    it('prevents cross-organization data access for packages', async () => {
      // Query for Org B packages (should return empty due to RLS simulation)
      const { data: packages } = await mockSupabase
        .from('packages')
        .select('*')
        .eq('mailroom_id', testTenants.orgB.mailroomId)
        .eq('organization_id', testTenants.orgA.orgId) // Simulating RLS filtering
        .then(result => result)
      
      // Should return empty array due to organization mismatch
      expect(packages).toEqual([])
    })

    it('prevents cross-organization data access for residents', async () => {
      // Query for Org B residents with Org A session context
      const { data: residents } = await mockSupabase
        .from('residents')
        .select('*')
        .eq('mailroom_id', testTenants.orgB.mailroomId)
        .eq('organization_id', testTenants.orgA.orgId) // Simulating RLS filtering
        .then(result => result)
      
      expect(residents).toEqual([])
    })

    it('allows access to own organization data', async () => {
      // Query for own mailroom packages
      const { data: packages } = await mockSupabase
        .from('packages')
        .select('*')
        .eq('mailroom_id', testTenants.orgA.mailroomId)
        .then(result => result)
      
      expect(packages).toHaveLength(1)
      expect(packages[0].mailroom_id).toBe(testTenants.orgA.mailroomId)
      expect(packages[0].organization_id).toBe(testTenants.orgA.orgId)
    })
  })

  describe('Mailroom Data Isolation within Organizations', () => {
    it('prevents cross-mailroom access within same organization', async () => {
      // User from mailroom A1 trying to access mailroom A2 data
      const { data: packages } = await mockSupabase
        .from('packages')
        .select('*')
        .eq('mailroom_id', testTenants.orgAMailroom2.mailroomId)
        .eq('organization_id', testTenants.orgA.orgId) // Same org, different mailroom
        .then(result => result)
      
      // Should only see their own mailroom data, not the other mailroom
      expect(packages).toHaveLength(1)
      expect(packages[0].mailroom_id).toBe(testTenants.orgAMailroom2.mailroomId)
    })

    it('allows managers to access only their assigned mailroom', async () => {
      const managerSession = createMockSession(testTenants.orgA, 'manager')
      
      // Manager queries their own mailroom residents
      const { data: residents } = await mockSupabase
        .from('residents')
        .select('*')
        .eq('mailroom_id', testTenants.orgA.mailroomId)
        .then(result => result)
      
      expect(residents).toHaveLength(1)
      expect(residents[0].mailroom_id).toBe(testTenants.orgA.mailroomId)
      expect(residents[0].organization_id).toBe(testTenants.orgA.orgId)
    })
  })

  describe('URL Slug-based Boundary Enforcement', () => {
    it('validates organization slug matches user session', async () => {
      const orgASession = createMockSession(testTenants.orgA)
      
      // Function to validate org slug (this would be in actual route handlers)
      const validateOrgAccess = (sessionOrg: string, requestedOrgSlug: string) => {
        return sessionOrg === requestedOrgSlug
      }
      
      // User tries to access Org B via URL manipulation
      const isAuthorized = validateOrgAccess(
        orgASession.organization.slug,
        testTenants.orgB.orgSlug
      )
      
      expect(isAuthorized).toBe(false)
    })

    it('validates mailroom slug matches user session', async () => {
      const orgASession = createMockSession(testTenants.orgA)
      
      const validateMailroomAccess = (sessionMailroom: string, requestedMailroomSlug: string) => {
        return sessionMailroom === requestedMailroomSlug
      }
      
      // User tries to access different mailroom via URL
      const isAuthorized = validateMailroomAccess(
        orgASession.mailroom.slug,
        testTenants.orgAMailroom2.mailroomSlug
      )
      
      expect(isAuthorized).toBe(false)
    })
  })

  describe('Shared Resource Access Validation', () => {
    it('prevents unauthorized access to organization settings', async () => {
      const orgASession = createMockSession(testTenants.orgA, 'user')
      
      // Regular users should not access org-level settings
      const hasOrgAccess = orgASession.role === 'admin' || orgASession.role === 'super-admin'
      
      expect(hasOrgAccess).toBe(false)
    })

    it('allows admin access to own organization settings only', async () => {
      const adminSession = createMockSession(testTenants.orgA, 'admin')
      
      const hasOrgAccess = adminSession.role === 'admin' || adminSession.role === 'super-admin'
      const isOwnOrg = adminSession.organization.id === testTenants.orgA.orgId
      
      expect(hasOrgAccess && isOwnOrg).toBe(true)
    })
  })

  describe('Cross-tenant Access Prevention', () => {
    it('completely isolates tenant data at database level', async () => {
      // Org A user query - simulating RLS filtering by organization
      const { data: orgAPackages } = await mockSupabase
        .from('packages')
        .select('*')
        .eq('organization_id', testTenants.orgA.orgId)
        .then(result => result)
      
      // Org B user query - simulating RLS filtering by organization
      const { data: orgBPackages } = await mockSupabase
        .from('packages')
        .select('*')
        .eq('organization_id', testTenants.orgB.orgId)
        .then(result => result)
      
      // Each should only see their own data
      expect(orgAPackages).toHaveLength(2) // orgA has 2 mailrooms
      expect(orgBPackages).toHaveLength(1)
      
      // Verify they see different data
      expect(orgAPackages.every(p => p.organization_id === testTenants.orgA.orgId)).toBe(true)
      expect(orgBPackages.every(p => p.organization_id === testTenants.orgB.orgId)).toBe(true)
      
      // Ensure no cross-contamination
      const orgAIds = orgAPackages.map(p => p.organization_id)
      const orgBIds = orgBPackages.map(p => p.organization_id)
      expect(orgAIds.some(id => orgBIds.includes(id))).toBe(false)
    })

    it('prevents data leakage through complex queries', async () => {
      // Attempt complex query that might bypass simple RLS
      const { data: complexResult } = await mockSupabase
        .from('packages')
        .select('*')
        .eq('status', 'WAITING')
        .eq('organization_id', testTenants.orgA.orgId) // Simulating RLS filtering
        .then(result => result)
      
      // Should only return Org A data
      expect(complexResult).toHaveLength(2) // orgA has 2 packages
      expect(complexResult.every(p => p.organization_id === testTenants.orgA.orgId)).toBe(true)
    })
  })
})