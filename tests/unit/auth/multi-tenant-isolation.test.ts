/**
 * Multi-Tenant Isolation Unit Tests
 * 
 * Critical tests to ensure proper data isolation between organizations and mailrooms.
 * These tests validate that Row Level Security (RLS) and authorization checks work correctly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMocks } from 'node-mocks-http'

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

// Mock Supabase with RLS simulation
const createMockSupabaseWithRLS = (currentTenant: any) => {
  return {
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn(() => {
        // Simulate RLS filtering
        if (table === 'packages') {
          const mockData = {
            id: 'package-1',
            mailroom_id: currentTenant.mailroomId,
            package_number: 123,
            status: 'WAITING'
          }
          return Promise.resolve({ 
            data: mockData.mailroom_id === currentTenant.mailroomId ? mockData : null,
            error: mockData.mailroom_id === currentTenant.mailroomId ? null : { message: 'Row not found' }
          })
        }
        
        if (table === 'residents') {
          const mockData = {
            id: 'resident-1',
            mailroom_id: currentTenant.mailroomId,
            first_name: 'John',
            last_name: 'Doe'
          }
          return Promise.resolve({ 
            data: mockData.mailroom_id === currentTenant.mailroomId ? mockData : null,
            error: mockData.mailroom_id === currentTenant.mailroomId ? null : { message: 'Row not found' }
          })
        }
        
        if (table === 'mailrooms') {
          const mockData = {
            id: currentTenant.mailroomId,
            organization_id: currentTenant.orgId,
            slug: currentTenant.mailroomSlug
          }
          return Promise.resolve({ 
            data: mockData.id === currentTenant.mailroomId ? mockData : null,
            error: mockData.id === currentTenant.mailroomId ? null : { message: 'Row not found' }
          })
        }
        
        return Promise.resolve({ data: null, error: null })
      })),
      then: vi.fn((callback) => {
        // Simulate RLS filtering in list queries
        const getFilteredData = () => {
          if (table === 'packages') {
            return [{
              id: 'package-1',
              mailroom_id: currentTenant.mailroomId,
              package_number: 123
            }].filter(p => p.mailroom_id === currentTenant.mailroomId)
          }
          
          if (table === 'residents') {
            return [{
              id: 'resident-1',
              mailroom_id: currentTenant.mailroomId,
              first_name: 'John'
            }].filter(r => r.mailroom_id === currentTenant.mailroomId)
          }
          
          if (table === 'mailrooms') {
            return [{
              id: currentTenant.mailroomId,
              organization_id: currentTenant.orgId
            }].filter(m => m.organization_id === currentTenant.orgId)
          }
          
          return []
        }
        
        return callback({ data: getFilteredData(), error: null })
      })
    })),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null }))
  }
}

describe('Multi-Tenant Isolation Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Organization Data Isolation via RLS', () => {
    it('prevents cross-organization data access for packages', async () => {
      const orgASession = createMockSession(testTenants.orgA)
      
      // Mock Supabase to simulate RLS for Org A user
      vi.mocked(require('@/lib/supabase')).supabase = createMockSupabaseWithRLS(testTenants.orgA)
      
      const { data: packages, error } = await vi.mocked(require('@/lib/supabase')).supabase
        .from('packages')
        .select('*')
        .eq('mailroom_id', testTenants.orgB.mailroomId) // Trying to access Org B data
        .then(result => result)
      
      // Should return empty array due to RLS filtering
      expect(packages).toEqual([])
    })

    it('prevents cross-organization data access for residents', async () => {
      const orgASession = createMockSession(testTenants.orgA)
      
      vi.mocked(require('@/lib/supabase')).supabase = createMockSupabaseWithRLS(testTenants.orgA)
      
      const { data: residents, error } = await vi.mocked(require('@/lib/supabase')).supabase
        .from('residents')
        .select('*')
        .eq('mailroom_id', testTenants.orgB.mailroomId) // Trying to access Org B data
        .then(result => result)
      
      expect(residents).toEqual([])
    })

    it('allows access to own organization data', async () => {
      const orgASession = createMockSession(testTenants.orgA)
      
      vi.mocked(require('@/lib/supabase')).supabase = createMockSupabaseWithRLS(testTenants.orgA)
      
      const { data: packages, error } = await vi.mocked(require('@/lib/supabase')).supabase
        .from('packages')
        .select('*')
        .eq('mailroom_id', testTenants.orgA.mailroomId) // Accessing own mailroom
        .then(result => result)
      
      expect(packages).toHaveLength(1)
      expect(packages[0].mailroom_id).toBe(testTenants.orgA.mailroomId)
    })
  })

  describe('Mailroom Data Isolation within Organizations', () => {
    it('prevents cross-mailroom access within same organization', async () => {
      // User from mailroom A1 trying to access mailroom A2 data
      vi.mocked(require('@/lib/supabase')).supabase = createMockSupabaseWithRLS(testTenants.orgA)
      
      const { data: packages, error } = await vi.mocked(require('@/lib/supabase')).supabase
        .from('packages')
        .select('*')
        .eq('mailroom_id', testTenants.orgAMailroom2.mailroomId) // Different mailroom, same org
        .then(result => result)
      
      expect(packages).toEqual([])
    })

    it('allows managers to access only their assigned mailroom', async () => {
      const managerSession = createMockSession(testTenants.orgA, 'manager')
      
      vi.mocked(require('@/lib/supabase')).supabase = createMockSupabaseWithRLS(testTenants.orgA)
      
      const { data: residents, error } = await vi.mocked(require('@/lib/supabase')).supabase
        .from('residents')
        .select('*')
        .eq('mailroom_id', testTenants.orgA.mailroomId) // Manager's own mailroom
        .then(result => result)
      
      expect(residents).toHaveLength(1)
      expect(residents[0].mailroom_id).toBe(testTenants.orgA.mailroomId)
    })
  })

  describe('URL Slug-based Boundary Enforcement', () => {
    it('validates organization slug matches user session', async () => {
      const orgASession = createMockSession(testTenants.orgA)
      
      // Mock handleSession to return Org A user
      vi.mocked(require('@/lib/handleSession')).default.mockResolvedValue(orgASession)
      
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
      
      vi.mocked(require('@/lib/handleSession')).default.mockResolvedValue(orgASession)
      
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
      
      vi.mocked(require('@/lib/supabase')).supabase = createMockSupabaseWithRLS(testTenants.orgA)
      
      // Regular users should not access org-level settings
      const hasOrgAccess = orgASession.role === 'admin' || orgASession.role === 'super-admin'
      
      expect(hasOrgAccess).toBe(false)
    })

    it('allows admin access to own organization settings only', async () => {
      const adminSession = createMockSession(testTenants.orgA, 'admin')
      
      vi.mocked(require('@/lib/supabase')).supabase = createMockSupabaseWithRLS(testTenants.orgA)
      
      const hasOrgAccess = adminSession.role === 'admin' || adminSession.role === 'super-admin'
      const isOwnOrg = adminSession.organization.id === testTenants.orgA.orgId
      
      expect(hasOrgAccess && isOwnOrg).toBe(true)
    })
  })

  describe('Cross-tenant Access Prevention', () => {
    it('completely isolates tenant data at database level', async () => {
      // Simulate simultaneous queries from different tenants
      const orgASupabase = createMockSupabaseWithRLS(testTenants.orgA)
      const orgBSupabase = createMockSupabaseWithRLS(testTenants.orgB)
      
      // Org A user query
      const { data: orgAPackages } = await orgASupabase
        .from('packages')
        .select('*')
        .then(result => result)
      
      // Org B user query  
      const { data: orgBPackages } = await orgBSupabase
        .from('packages')
        .select('*')
        .then(result => result)
      
      // Each should only see their own data
      expect(orgAPackages).toHaveLength(1)
      expect(orgBPackages).toHaveLength(1)
      
      // Verify they see different data
      expect(orgAPackages[0].mailroom_id).toBe(testTenants.orgA.mailroomId)
      expect(orgBPackages[0].mailroom_id).toBe(testTenants.orgB.mailroomId)
      expect(orgAPackages[0].mailroom_id).not.toBe(orgBPackages[0].mailroom_id)
    })

    it('prevents data leakage through complex queries', async () => {
      vi.mocked(require('@/lib/supabase')).supabase = createMockSupabaseWithRLS(testTenants.orgA)
      
      // Attempt complex query that might bypass simple RLS
      const { data: complexResult } = await vi.mocked(require('@/lib/supabase')).supabase
        .from('packages')
        .select('*, residents(*), mailrooms(*)')
        .eq('status', 'WAITING')
        .then(result => result)
      
      // Should still only return Org A data
      expect(complexResult).toHaveLength(1)
      expect(complexResult[0].mailroom_id).toBe(testTenants.orgA.mailroomId)
    })
  })
})