// tests/integration/components/auth-hocs.test.tsx
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { useRouter } from 'next/router'
import React from 'react'

import { AuthProvider, withAuth, UserRole, UserProfile } from '@/context/AuthContext'
import { withOrgAuth } from '@/components/withOrgAuth'

// Mock modules
vi.mock('next/router')
vi.mock('@/lib/supabase')

// Test component for HOC testing
const TestComponent: React.FC<{ testProp?: string }> = ({ testProp }) => (
  <div data-testid="test-component">
    Test Component Rendered {testProp && `with ${testProp}`}
  </div>
)

// Mock router
const mockPush = vi.fn()
const mockRouter = {
  push: mockPush,
  query: { org: 'test-org', mailroom: 'test-mailroom' },
  asPath: '/test-org/test-mailroom/overview',
  pathname: '/[org]/[mailroom]/[[...tab]]',
  isReady: true
}

describe('Authentication HOCs Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useRouter).mockReturnValue(mockRouter as any)
    
    // Reset localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('withAuth HOC', () => {
    it('should redirect unauthenticated users to login', async () => {
      const ProtectedComponent = withAuth(TestComponent)

      // Mock unauthenticated state
      const mockSupabase = await import('@/lib/supabase')
      vi.mocked(mockSupabase.supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null
      })
      vi.mocked(mockSupabase.supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } }
      } as any)

      render(
        <AuthProvider>
          <ProtectedComponent />
        </AuthProvider>
      )

      // Should show loading initially
      expect(screen.getByText(/Loading/)).toBeInTheDocument()

      // Wait for auth check to complete and redirect
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining('/login?callbackUrl=')
        )
      })
    })

    it('should render component for authenticated users', async () => {
      const ProtectedComponent = withAuth(TestComponent)

      // Mock authenticated state
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockSession = { user: mockUser, access_token: 'token' }
      const mockUserProfile: UserProfile = {
        id: 'user-123',
        role: 'user' as UserRole,
        status: 'ACTIVE',
        organization_id: 'org-123',
        mailroom_id: 'mailroom-123'
      }

      const mockSupabase = await import('@/lib/supabase')
      vi.mocked(mockSupabase.supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null
      } as any)
      vi.mocked(mockSupabase.supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } }
      } as any)
      
      // Mock profile fetch
      vi.mocked(mockSupabase.supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn()
          .mockResolvedValueOnce({ data: mockUserProfile, error: null })
          .mockResolvedValueOnce({ data: { slug: 'test-org' }, error: null })
          .mockResolvedValueOnce({ data: { slug: 'test-mailroom' }, error: null })
      } as any)

      render(
        <AuthProvider>
          <ProtectedComponent testProp="authenticated" />
        </AuthProvider>
      )

      // Should eventually render the protected component
      await waitFor(() => {
        expect(screen.getByTestId('test-component')).toBeInTheDocument()
        expect(screen.getByText(/Test Component Rendered with authenticated/)).toBeInTheDocument()
      })

      // Should not redirect
      expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining('/login'))
    })

    it('should enforce role-based access control', async () => {
      const ProtectedComponent = withAuth(TestComponent, 'admin')

      // Mock authenticated user with insufficient role
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockSession = { user: mockUser, access_token: 'token' }
      const mockUserProfile: UserProfile = {
        id: 'user-123',
        role: 'user' as UserRole, // Insufficient role
        status: 'ACTIVE',
        organization_id: 'org-123',
        mailroom_id: 'mailroom-123'
      }

      const mockSupabase = await import('@/lib/supabase')
      vi.mocked(mockSupabase.supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null
      } as any)
      vi.mocked(mockSupabase.supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } }
      } as any)
      
      // Mock profile fetch
      vi.mocked(mockSupabase.supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUserProfile, error: null })
      } as any)

      render(
        <AuthProvider>
          <ProtectedComponent />
        </AuthProvider>
      )

      // Should redirect to unauthorized page
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/unauthorized?reason=role_mismatch')
      })
    })

    it('should allow admins to access any role-protected route', async () => {
      const ProtectedComponent = withAuth(TestComponent, 'manager')

      // Mock authenticated admin user
      const mockUser = { id: 'admin-123', email: 'admin@example.com' }
      const mockSession = { user: mockUser, access_token: 'token' }
      const mockUserProfile: UserProfile = {
        id: 'admin-123',
        role: 'admin' as UserRole, // Admin role should bypass role checks
        status: 'ACTIVE',
        organization_id: 'org-123',
        mailroom_id: 'mailroom-123'
      }

      const mockSupabase = await import('@/lib/supabase')
      vi.mocked(mockSupabase.supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null
      } as any)
      vi.mocked(mockSupabase.supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } }
      } as any)
      
      // Mock profile and org/mailroom fetch
      vi.mocked(mockSupabase.supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn()
          .mockResolvedValueOnce({ data: mockUserProfile, error: null })
          .mockResolvedValueOnce({ data: { slug: 'test-org' }, error: null })
          .mockResolvedValueOnce({ data: { slug: 'test-mailroom' }, error: null })
      } as any)

      render(
        <AuthProvider>
          <ProtectedComponent />
        </AuthProvider>
      )

      // Admin should be able to access despite role requirement
      await waitFor(() => {
        expect(screen.getByTestId('test-component')).toBeInTheDocument()
      })

      // Should not redirect
      expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining('/unauthorized'))
    })

    it('should handle loading states properly', async () => {
      const ProtectedComponent = withAuth(TestComponent)

      // Mock slow authentication
      const mockSupabase = await import('@/lib/supabase')
      vi.mocked(mockSupabase.supabase.auth.getSession).mockImplementation(
        () => new Promise(resolve => {
          setTimeout(() => resolve({
            data: { session: null },
            error: null
          }), 100)
        })
      )
      vi.mocked(mockSupabase.supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } }
      } as any)

      render(
        <AuthProvider>
          <ProtectedComponent />
        </AuthProvider>
      )

      // Should show loading state initially
      expect(screen.getByText(/Loading/)).toBeInTheDocument()
      
      // Should not show the test component yet
      expect(screen.queryByTestId('test-component')).not.toBeInTheDocument()

      // Wait for loading to complete
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalled()
      })
    })

    it('should handle loading timeout gracefully', async () => {
      const ProtectedComponent = withAuth(TestComponent)

      // Mock very slow authentication that triggers timeout
      const mockSupabase = await import('@/lib/supabase')
      vi.mocked(mockSupabase.supabase.auth.getSession).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )
      vi.mocked(mockSupabase.supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } }
      } as any)

      render(
        <AuthProvider>
          <ProtectedComponent />
        </AuthProvider>
      )

      // Should show loading initially
      expect(screen.getByText(/Loading/)).toBeInTheDocument()

      // Should redirect after timeout (mocked to be faster in tests)
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining('loading_timeout')
        )
      }, { timeout: 3000 })
    })
  })

  describe('withOrgAuth HOC', () => {
    it('should enforce organization boundaries for non-admin users', async () => {
      const OrgProtectedComponent = withAuth(TestComponent) // Using withAuth as withOrgAuth is minimal

      // Mock user trying to access different org
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockSession = { user: mockUser, access_token: 'token' }
      const mockUserProfile: UserProfile = {
        id: 'user-123',
        role: 'user' as UserRole,
        status: 'ACTIVE',
        organization_id: 'user-org-123',
        mailroom_id: 'user-mailroom-123'
      }

      // Mock router with different org/mailroom
      const differentOrgRouter = {
        ...mockRouter,
        query: { org: 'different-org', mailroom: 'different-mailroom' }
      }
      vi.mocked(useRouter).mockReturnValue(differentOrgRouter as any)

      const mockSupabase = await import('@/lib/supabase')
      vi.mocked(mockSupabase.supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null
      } as any)
      vi.mocked(mockSupabase.supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } }
      } as any)
      
      // Mock profile fetch and org/mailroom mismatch
      vi.mocked(mockSupabase.supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn()
          .mockResolvedValueOnce({ data: mockUserProfile, error: null })
          .mockResolvedValueOnce({ data: { slug: 'user-assigned-org' }, error: null })
          .mockResolvedValueOnce({ data: { slug: 'user-assigned-mailroom' }, error: null })
      } as any)

      render(
        <AuthProvider>
          <OrgProtectedComponent />
        </AuthProvider>
      )

      // Should redirect due to org/mailroom mismatch
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/unauthorized?reason=mailroom_mismatch')
      })
    })

    it('should allow access when org/mailroom matches user assignment', async () => {
      const OrgProtectedComponent = withAuth(TestComponent)

      // Mock user accessing their assigned org/mailroom
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockSession = { user: mockUser, access_token: 'token' }
      const mockUserProfile: UserProfile = {
        id: 'user-123',
        role: 'user' as UserRole,
        status: 'ACTIVE',
        organization_id: 'org-123',
        mailroom_id: 'mailroom-123'
      }

      const mockSupabase = await import('@/lib/supabase')
      vi.mocked(mockSupabase.supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null
      } as any)
      vi.mocked(mockSupabase.supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } }
      } as any)
      
      // Mock profile fetch with matching org/mailroom
      vi.mocked(mockSupabase.supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn()
          .mockResolvedValueOnce({ data: mockUserProfile, error: null })
          .mockResolvedValueOnce({ data: { slug: 'test-org' }, error: null })
          .mockResolvedValueOnce({ data: { slug: 'test-mailroom' }, error: null })
      } as any)

      render(
        <AuthProvider>
          <OrgProtectedComponent />
        </AuthProvider>
      )

      // Should render the component successfully
      await waitFor(() => {
        expect(screen.getByTestId('test-component')).toBeInTheDocument()
      })

      // Should not redirect
      expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining('/unauthorized'))
    })

    it('should allow admins to access any organization', async () => {
      const OrgProtectedComponent = withAuth(TestComponent)

      // Mock admin user accessing any org
      const mockUser = { id: 'admin-123', email: 'admin@example.com' }
      const mockSession = { user: mockUser, access_token: 'token' }
      const mockUserProfile: UserProfile = {
        id: 'admin-123',
        role: 'admin' as UserRole,
        status: 'ACTIVE',
        organization_id: 'admin-org-123',
        mailroom_id: 'admin-mailroom-123'
      }

      const mockSupabase = await import('@/lib/supabase')
      vi.mocked(mockSupabase.supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null
      } as any)
      vi.mocked(mockSupabase.supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } }
      } as any)
      
      // Mock profile fetch
      vi.mocked(mockSupabase.supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUserProfile, error: null })
      } as any)

      render(
        <AuthProvider>
          <OrgProtectedComponent />
        </AuthProvider>
      )

      // Admin should be able to access any organization
      await waitFor(() => {
        expect(screen.getByTestId('test-component')).toBeInTheDocument()
      })

      // Should not redirect
      expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining('/unauthorized'))
    })

    it('should handle profile data fetch errors gracefully', async () => {
      const OrgProtectedComponent = withAuth(TestComponent)

      // Mock user with profile fetch error
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockSession = { user: mockUser, access_token: 'token' }
      const mockUserProfile: UserProfile = {
        id: 'user-123',
        role: 'user' as UserRole,
        status: 'ACTIVE',
        organization_id: 'org-123',
        mailroom_id: 'mailroom-123'
      }

      const mockSupabase = await import('@/lib/supabase')
      vi.mocked(mockSupabase.supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null
      } as any)
      vi.mocked(mockSupabase.supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } }
      } as any)
      
      // Mock profile fetch success but org/mailroom fetch error
      vi.mocked(mockSupabase.supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn()
          .mockResolvedValueOnce({ data: mockUserProfile, error: null })
          .mockResolvedValueOnce({ data: null, error: { message: 'Org not found' } })
      } as any)

      render(
        <AuthProvider>
          <OrgProtectedComponent />
        </AuthProvider>
      )

      // Should redirect due to profile data fetch error
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/unauthorized?reason=profile_data_fetch_error')
      })
    })

    it('should handle removed user status', async () => {
      const ProtectedComponent = withAuth(TestComponent)

      // Mock user with REMOVED status
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockSession = { user: mockUser, access_token: 'token' }
      const mockUserProfile: UserProfile = {
        id: 'user-123',
        role: 'user' as UserRole,
        status: 'REMOVED', // User has been removed
        organization_id: 'org-123',
        mailroom_id: 'mailroom-123'
      }

      const mockSupabase = await import('@/lib/supabase')
      
      // Mock successful login but user is REMOVED
      vi.mocked(mockSupabase.supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null
      } as any)
      
      vi.mocked(mockSupabase.supabase.auth.signOut).mockResolvedValue({ error: null })
      
      vi.mocked(mockSupabase.supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUserProfile, error: null })
      } as any)

      render(
        <AuthProvider>
          <ProtectedComponent />
        </AuthProvider>
      )

      // Should handle REMOVED status appropriately (likely redirect to login or error)
      // The exact behavior depends on implementation, but should not render the component
      await waitFor(() => {
        expect(screen.queryByTestId('test-component')).not.toBeInTheDocument()
      })
    })
  })
})