// tests/integration/components/dynamic-routing.test.tsx
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { screen, waitFor, fireEvent, act } from '@testing-library/react'
import React from 'react'
import { UserTabPage } from '@/pages/[org]/[mailroom]/[[...tab]]'
import { UserRole } from '@/context/AuthContext'
import { 
  renderWithAuth, 
  createMockRouter, 
  setupSupabaseMocks, 
  setupStorageMocks 
} from '../../utils/test-utils'

vi.mock('@/lib/supabase')
vi.mock('@/lib/userPreferences', () => ({
  getOrgDisplayName: vi.fn(),
  getMailroomDisplayName: vi.fn()
}))

// Mock individual tab components to avoid complex dependencies
vi.mock('@/components/mailroomTabs/Overview', () => ({
  default: ({ orgSlug, mailroomSlug }: { orgSlug: string, mailroomSlug: string }) => (
    <div data-testid="overview-tab">Overview Tab - {orgSlug}/{mailroomSlug}</div>
  )
}))

vi.mock('@/components/mailroomTabs/RegisterPackage', () => ({
  default: ({ orgSlug, mailroomSlug }: { orgSlug: string, mailroomSlug: string }) => (
    <div data-testid="register-tab">Register Tab - {orgSlug}/{mailroomSlug}</div>
  )
}))

vi.mock('@/components/mailroomTabs/Pickup', () => ({
  default: ({ orgSlug, mailroomSlug }: { orgSlug: string, mailroomSlug: string }) => (
    <div data-testid="pickup-tab">Pickup Tab - {orgSlug}/{mailroomSlug}</div>
  )
}))

vi.mock('@/components/mailroomTabs/ManageUsers', () => ({
  default: ({ orgSlug, mailroomSlug }: { orgSlug: string, mailroomSlug: string }) => (
    <div data-testid="manage-users-tab">Manage Users Tab - {orgSlug}/{mailroomSlug}</div>
  )
}))

vi.mock('@/components/mailroomTabs/ManageRoster', () => ({
  default: ({ orgSlug, mailroomSlug }: { orgSlug: string, mailroomSlug: string }) => (
    <div data-testid="manage-roster-tab">Manage Roster Tab - {orgSlug}/{mailroomSlug}</div>
  )
}))

vi.mock('@/components/mailroomTabs/ManagePackages', () => ({
  default: ({ orgSlug, mailroomSlug }: { orgSlug: string, mailroomSlug: string }) => (
    <div data-testid="manage-packages-tab">Manage Packages Tab - {orgSlug}/{mailroomSlug}</div>
  )
}))

vi.mock('@/components/mailroomTabs/ManageManagers', () => ({
  default: ({ orgSlug, mailroomSlug }: { orgSlug: string, mailroomSlug: string }) => (
    <div data-testid="manage-managers-tab">Manage Managers Tab - {orgSlug}/{mailroomSlug}</div>
  )
}))

vi.mock('@/components/mailroomTabs/ManageEmailContent', () => ({
  default: ({ orgSlug, mailroomSlug }: { orgSlug: string, mailroomSlug: string }) => (
    <div data-testid="manage-email-content-tab">Manage Email Content Tab - {orgSlug}/{mailroomSlug}</div>
  )
}))

vi.mock('@/components/mailroomTabs/ManageSettings', () => ({
  default: ({ orgSlug, mailroomSlug }: { orgSlug: string, mailroomSlug: string }) => (
    <div data-testid="manage-settings-tab">Manage Settings Tab - {orgSlug}/{mailroomSlug}</div>
  )
}))

vi.mock('@/components/Layout', () => ({
  default: ({ children, title }: { children: React.ReactNode, title: string }) => (
    <div data-testid="layout" data-title={title}>
      {children}
    </div>
  )
}))

vi.mock('@/components/UserTabPageSkeleton', () => ({
  default: () => <div data-testid="tab-skeleton">Loading...</div>
}))

// Get mock functions from the test utils
let mockPush: any
let mockReplace: any

describe('Dynamic Routing Component Tests', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Setup storage mocks
    setupStorageMocks()

    // Mock user preferences - ensure these resolve quickly
    const userPrefs = await import('@/lib/userPreferences')
    vi.mocked(userPrefs.getOrgDisplayName).mockImplementation(async (slug: string) => {
      if (slug === 'test-org') return 'Test Organization'
      if (slug === 'nonexistent-org') return null
      return 'Test Organization'
    })
    vi.mocked(userPrefs.getMailroomDisplayName).mockImplementation(async (slug: string) => {
      if (slug === 'test-mailroom') return 'Test Mailroom'
      if (slug === 'nonexistent-mailroom') return null
      return 'Test Mailroom'
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const setupAuthenticatedUser = async (role: UserRole = 'user') => {
    const scenario = role === 'user' ? 'authenticated-user' : 
                    role === 'manager' ? 'authenticated-manager' : 
                    'authenticated-admin'
    await setupSupabaseMocks(scenario)
  }

  describe('Tab Navigation Based on URL Parameters', () => {
    it('should render overview tab by default when no tab parameter is provided', async () => {
      await setupAuthenticatedUser()
      
      const routerMock = createMockRouter({
        query: { org: 'test-org', mailroom: 'test-mailroom' },
        asPath: '/test-org/test-mailroom'
      })
      mockPush = routerMock.push
      mockReplace = routerMock.replace

      // Check that our mocks are working
      const userPrefs = await import('@/lib/userPreferences')
      expect(vi.mocked(userPrefs.getOrgDisplayName)).toBeDefined()
      expect(vi.mocked(userPrefs.getMailroomDisplayName)).toBeDefined()

      renderWithAuth(
        <UserTabPage />,
        { authScenario: 'authenticated-user', routerMock }
      )

      // Check basic rendering first
      await waitFor(() => {
        expect(screen.getByText('General')).toBeInTheDocument()
        expect(screen.getAllByText('overview')).toHaveLength(2) // One in button, one in h2
      })

      // Get the overview button specifically (should be inside nav)
      const navElement = screen.getByRole('navigation')
      const overviewButton = screen.getByRole('button', { name: 'overview' })
      expect(overviewButton).toBeInTheDocument()
      
      // Check that overview is marked as active
      expect(overviewButton).toHaveClass('text-[#471803]', 'font-bold')
    })

    it('should render the correct tab based on URL parameter', async () => {
      await setupAuthenticatedUser()
      
      const routerMock = createMockRouter({
        query: { org: 'test-org', mailroom: 'test-mailroom', tab: ['register'] },
        asPath: '/test-org/test-mailroom/register'
      })
      mockPush = routerMock.push
      mockReplace = routerMock.replace

      renderWithAuth(
        <UserTabPage />,
        { authScenario: 'authenticated-user', routerMock }
      )

      // Check that the register tab is active
      await waitFor(() => {
        const registerButton = screen.getByRole('button', { name: 'register' })
        expect(registerButton).toBeInTheDocument()
        expect(registerButton).toHaveClass('text-[#471803]', 'font-bold')
        
        // Check that the title shows "register"
        expect(screen.getByText('register')).toBeInTheDocument()
      })
    })

    it('should handle hyphenated tab names correctly (e.g., manage-users)', async () => {
      await setupAuthenticatedUser('manager')
      
      const routerMock = createMockRouter({
        query: { org: 'test-org', mailroom: 'test-mailroom', tab: ['manage-users'] },
        asPath: '/test-org/test-mailroom/manage-users'
      })
      mockPush = routerMock.push
      mockReplace = routerMock.replace

      renderWithAuth(
        <UserTabPage />,
        { authScenario: 'authenticated-manager', routerMock }
      )

      // Check that the manage users tab is active
      await waitFor(() => {
        const manageUsersButton = screen.getByRole('button', { name: 'manage users' })
        expect(manageUsersButton).toBeInTheDocument()
        expect(manageUsersButton).toHaveClass('text-[#471803]', 'font-bold')
        
        // Check that management section is visible
        expect(screen.getByText('Management')).toBeInTheDocument()
      })
    })

    it('should handle nested tab arrays correctly', async () => {
      await setupAuthenticatedUser('manager')
      
      const routerMock = createMockRouter({
        query: { org: 'test-org', mailroom: 'test-mailroom', tab: ['manage-email-content', 'extra'] },
        asPath: '/test-org/test-mailroom/manage-email-content/extra'
      })
      mockPush = routerMock.push
      mockReplace = routerMock.replace

      renderWithAuth(
        <UserTabPage />,
        { authScenario: 'authenticated-manager', routerMock }
      )

      // Should use the first element of the tab array
      await waitFor(() => {
        const manageEmailButton = screen.getByRole('button', { name: 'manage email content' })
        expect(manageEmailButton).toBeInTheDocument()
        expect(manageEmailButton).toHaveClass('text-[#471803]', 'font-bold')
      })
    })
  })

  describe('Organization and Mailroom Slug Validation', () => {
    it('should redirect to 404 when organization slug is missing', async () => {
      await setupAuthenticatedUser()
      
      const routerMock = createMockRouter({
        query: { mailroom: 'test-mailroom' }, // Missing org
        asPath: '/test-mailroom'
      })
      mockPush = routerMock.push
      mockReplace = routerMock.replace

      await act(async () => {
        renderWithAuth(
          <UserTabPage />,
          { authScenario: 'authenticated-user', routerMock }
        )
      })

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/404')
      })
    })

    it('should redirect to 404 when mailroom slug is missing', async () => {
      await setupAuthenticatedUser()
      
      const routerMock = createMockRouter({
        query: { org: 'test-org' }, // Missing mailroom
        asPath: '/test-org'
      })
      mockPush = routerMock.push
      mockReplace = routerMock.replace

      await act(async () => {
        renderWithAuth(
          <UserTabPage />,
          { authScenario: 'authenticated-user', routerMock }
        )
      })

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/404')
      })
    })

    it('should redirect to 404 when organization does not exist', async () => {
      await setupAuthenticatedUser()
      
      const routerMock = createMockRouter({
        query: { org: 'nonexistent-org', mailroom: 'test-mailroom' }
      })
      mockPush = routerMock.push
      mockReplace = routerMock.replace

      // Mock userPreferences to return null for nonexistent org
      const userPrefs = await import('@/lib/userPreferences')
      vi.mocked(userPrefs.getOrgDisplayName).mockResolvedValue(null)

      await act(async () => {
        renderWithAuth(
          <UserTabPage />,
          { authScenario: 'authenticated-user', routerMock }
        )
      })

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/404')
      })
    })

    it('should redirect to 404 when mailroom does not exist', async () => {
      await setupAuthenticatedUser()
      
      const routerMock = createMockRouter({
        query: { org: 'test-org', mailroom: 'nonexistent-mailroom' }
      })
      mockPush = routerMock.push
      mockReplace = routerMock.replace

      // Mock userPreferences to return null for nonexistent mailroom
      const userPrefs = await import('@/lib/userPreferences')
      vi.mocked(userPrefs.getOrgDisplayName).mockResolvedValue('Test Organization')
      vi.mocked(userPrefs.getMailroomDisplayName).mockResolvedValue(null)

      await act(async () => {
        renderWithAuth(
          <UserTabPage />,
          { authScenario: 'authenticated-user', routerMock }
        )
      })

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/404')
      })
    })
  })

  describe('Invalid Tab Handling', () => {
    it('should redirect to overview when invalid tab is provided', async () => {
      await setupAuthenticatedUser()
      
      const routerMock = createMockRouter({
        query: { org: 'test-org', mailroom: 'test-mailroom', tab: ['invalid-tab'] },
        asPath: '/test-org/test-mailroom/invalid-tab'
      })
      mockPush = routerMock.push
      mockReplace = routerMock.replace

      await act(async () => {
        renderWithAuth(
          <UserTabPage />,
          { authScenario: 'authenticated-user', routerMock }
        )
      })

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/test-org/test-mailroom')
      })
    })

    it('should redirect when user tries to access manager tabs without permission', async () => {
      await setupAuthenticatedUser('user') // Regular user, not manager
      
      const routerMock = createMockRouter({
        query: { org: 'test-org', mailroom: 'test-mailroom', tab: ['manage-users'] },
        asPath: '/test-org/test-mailroom/manage-users'
      })
      mockPush = routerMock.push
      mockReplace = routerMock.replace

      await act(async () => {
        renderWithAuth(
          <UserTabPage />,
          { authScenario: 'authenticated-user', routerMock }
        )
      })

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/test-org/test-mailroom')
      })
    })

    it('should redirect when user tries to access admin tabs without permission', async () => {
      await setupAuthenticatedUser('manager') // Manager, not admin
      
      const routerMock = createMockRouter({
        query: { org: 'test-org', mailroom: 'test-mailroom', tab: ['admin-panel'] },
        asPath: '/test-org/test-mailroom/admin-panel'
      })
      mockPush = routerMock.push
      mockReplace = routerMock.replace

      await act(async () => {
        renderWithAuth(
          <UserTabPage />,
          { authScenario: 'authenticated-manager', routerMock }
        )
      })

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/test-org/test-mailroom')
      })
    })
  })

  describe('Tab Navigation Persistence', () => {
    it('should store current tab in sessionStorage when tab changes', async () => {
      await setupAuthenticatedUser()
      
      const mockSessionStorage = vi.mocked(window.sessionStorage)
      
      const routerMock = createMockRouter({
        query: { org: 'test-org', mailroom: 'test-mailroom', tab: ['pickup'] },
        asPath: '/test-org/test-mailroom/pickup'
      })
      mockPush = routerMock.push
      mockReplace = routerMock.replace

      await act(async () => {
        renderWithAuth(
          <UserTabPage />,
          { authScenario: 'authenticated-user', routerMock }
        )
      })

      await waitFor(() => {
        expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
          'test-org-test-mailroom-tab',
          'pickup'
        )
      })
    })

    it('should store overview tab in sessionStorage when no tab parameter', async () => {
      await setupAuthenticatedUser()
      
      const mockSessionStorage = vi.mocked(window.sessionStorage)
      
      const routerMock = createMockRouter({
        query: { org: 'test-org', mailroom: 'test-mailroom' },
        asPath: '/test-org/test-mailroom'
      })
      mockPush = routerMock.push
      mockReplace = routerMock.replace

      await act(async () => {
        renderWithAuth(
          <UserTabPage />,
          { authScenario: 'authenticated-user', routerMock }
        )
      })

      await waitFor(() => {
        expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
          'test-org-test-mailroom-tab',
          'overview'
        )
      })
    })

    it('should clean up sessionStorage on component unmount', async () => {
      await setupAuthenticatedUser()
      
      const mockSessionStorage = vi.mocked(window.sessionStorage)
      
      const routerMock = createMockRouter()
      mockPush = routerMock.push
      mockReplace = routerMock.replace

      const { unmount } = await act(async () => {
        return renderWithAuth(
          <UserTabPage />,
          { authScenario: 'authenticated-user', routerMock }
        )
      })

      await waitFor(() => {
        expect(screen.getByTestId('overview-tab')).toBeInTheDocument()
      })

      await act(async () => {
        unmount()
      })

      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
        'test-org-test-mailroom-tab'
      )
    })
  })

  describe('Tab Click Navigation', () => {
    it('should navigate to correct URL when tab is clicked', async () => {
      await setupAuthenticatedUser()
      
      const routerMock = createMockRouter()
      mockPush = routerMock.push
      mockReplace = routerMock.replace

      renderWithAuth(
        <UserTabPage />,
        { authScenario: 'authenticated-user', routerMock }
      )

      // Wait for component to load with navigation
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'overview' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'register' })).toBeInTheDocument()
      })

      // Find and click the register tab button
      const registerButton = screen.getByRole('button', { name: 'register' })
      await act(async () => {
        fireEvent.click(registerButton)
      })

      expect(mockPush).toHaveBeenCalledWith(
        '/test-org/test-mailroom/register',
        undefined,
        { shallow: true }
      )
    })

    it('should navigate to overview when overview tab is clicked', async () => {
      await setupAuthenticatedUser()
      
      const routerMock = createMockRouter({
        query: { org: 'test-org', mailroom: 'test-mailroom', tab: ['register'] },
        asPath: '/test-org/test-mailroom/register'
      })
      mockPush = routerMock.push
      mockReplace = routerMock.replace

      renderWithAuth(
        <UserTabPage />,
        { authScenario: 'authenticated-user', routerMock }
      )

      // Wait for component to load with navigation showing register as active
      await waitFor(() => {
        const registerButton = screen.getByRole('button', { name: 'register' })
        expect(registerButton).toHaveClass('text-[#471803]', 'font-bold')
      })

      // Find and click the overview tab button
      const overviewButton = screen.getByRole('button', { name: 'overview' })
      await act(async () => {
        fireEvent.click(overviewButton)
      })

      expect(mockPush).toHaveBeenCalledWith(
        '/test-org/test-mailroom',
        undefined,
        { shallow: true }
      )
    })

    it('should handle tab clicks for manager tabs when user has permission', async () => {
      await setupAuthenticatedUser('manager')
      
      const routerMock = createMockRouter()
      mockPush = routerMock.push
      mockReplace = routerMock.replace

      renderWithAuth(
        <UserTabPage />,
        { authScenario: 'authenticated-manager', routerMock }
      )

      // Wait for manager navigation to load
      await waitFor(() => {
        expect(screen.getByText('Management')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'manage users' })).toBeInTheDocument()
      })

      // Find and click a manager tab
      const manageUsersButton = screen.getByRole('button', { name: 'manage users' })
      await act(async () => {
        fireEvent.click(manageUsersButton)
      })

      expect(mockPush).toHaveBeenCalledWith(
        '/test-org/test-mailroom/manage-users',
        undefined,
        { shallow: true }
      )
    })
  })

  describe('Loading States', () => {
    it('should show loading skeleton when router is not ready', async () => {
      await setupAuthenticatedUser()
      
      const routerMock = createMockRouter({
        isReady: false
      })
      mockPush = routerMock.push
      mockReplace = routerMock.replace

      await act(async () => {
        renderWithAuth(
          <UserTabPage />,
          { authScenario: 'authenticated-user', routerMock }
        )
      })

      expect(screen.getByTestId('tab-skeleton')).toBeInTheDocument()
      expect(screen.queryByTestId('overview-tab')).not.toBeInTheDocument()
    })

    it('should show loading skeleton during org/mailroom validation', async () => {
      await setupAuthenticatedUser()
      
      // Make userPreferences slow to resolve
      const userPrefs = await import('@/lib/userPreferences')
      vi.mocked(userPrefs.getOrgDisplayName).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('Test Organization'), 100))
      )
      vi.mocked(userPrefs.getMailroomDisplayName).mockResolvedValue('Test Mailroom')
      
      const routerMock = createMockRouter()
      mockPush = routerMock.push
      mockReplace = routerMock.replace

      await act(async () => {
        renderWithAuth(
          <UserTabPage />,
          { authScenario: 'authenticated-user', routerMock }
        )
      })

      // Should show skeleton initially
      expect(screen.getByTestId('tab-skeleton')).toBeInTheDocument()

      // Wait for validation to complete
      await waitFor(() => {
        expect(screen.getByTestId('overview-tab')).toBeInTheDocument()
      }, { timeout: 500 })
    })
  })

  describe('Role-Based Tab Visibility', () => {
    it('should show only user tabs for regular users', async () => {
      await setupAuthenticatedUser('user')
      
      const routerMock = createMockRouter()
      mockPush = routerMock.push
      mockReplace = routerMock.replace

      renderWithAuth(
        <UserTabPage />,
        { authScenario: 'authenticated-user', routerMock }
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'overview' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'pickup' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'register' })).toBeInTheDocument()
      })

      // Should not show manager tabs
      expect(screen.queryByRole('button', { name: 'manage users' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'manage roster' })).not.toBeInTheDocument()
    })

    it('should show user and manager tabs for managers', async () => {
      await setupAuthenticatedUser('manager')
      
      const routerMock = createMockRouter()
      mockPush = routerMock.push
      mockReplace = routerMock.replace

      renderWithAuth(
        <UserTabPage />,
        { authScenario: 'authenticated-manager', routerMock }
      )

      await waitFor(() => {
        // User tabs
        expect(screen.getByRole('button', { name: 'overview' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'pickup' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'register' })).toBeInTheDocument()
        
        // Manager tabs
        expect(screen.getByRole('button', { name: 'manage users' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'manage roster' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'manage packages' })).toBeInTheDocument()
      })
    })

    it('should show all available tabs for admins', async () => {
      await setupAuthenticatedUser('admin')
      
      const routerMock = createMockRouter()
      mockPush = routerMock.push
      mockReplace = routerMock.replace

      renderWithAuth(
        <UserTabPage />,
        { authScenario: 'authenticated-admin', routerMock }
      )

      await waitFor(() => {
        // User tabs
        expect(screen.getByRole('button', { name: 'overview' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'pickup' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'register' })).toBeInTheDocument()
        
        // Manager tabs
        expect(screen.getByRole('button', { name: 'manage users' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'manage roster' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'manage packages' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'manage managers' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'manage email content' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'manage settings' })).toBeInTheDocument()
        
        // Note: Admin tabs are empty in the current implementation
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle errors during org/mailroom validation gracefully', async () => {
      await setupAuthenticatedUser()
      
      // Make userPreferences throw an error
      const userPrefs = await import('@/lib/userPreferences')
      vi.mocked(userPrefs.getOrgDisplayName).mockRejectedValue(new Error('API Error'))
      
      const routerMock = createMockRouter()
      mockPush = routerMock.push
      mockReplace = routerMock.replace

      await act(async () => {
        renderWithAuth(
          <UserTabPage />,
          { authScenario: 'authenticated-user', routerMock }
        )
      })

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/404')
      })
    })

    it('should handle sessionStorage errors gracefully', async () => {
      await setupAuthenticatedUser()
      
      // Mock sessionStorage to throw an error
      const mockSessionStorage = vi.mocked(window.sessionStorage)
      mockSessionStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded')
      })
      
      const routerMock = createMockRouter()
      mockPush = routerMock.push
      mockReplace = routerMock.replace

      // Should not crash, just log the error
      await act(async () => {
        renderWithAuth(
          <UserTabPage />,
          { authScenario: 'authenticated-user', routerMock }
        )
      })

      await waitFor(() => {
        expect(screen.getByTestId('overview-tab')).toBeInTheDocument()
      })
    })
  })
})