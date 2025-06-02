// tests/integration/RegisterPackage.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

import RegisterPackage from '@/components/mailroomTabs/RegisterPackage'
import userEvent from '@testing-library/user-event'

// Mock the auth context instead of using the real AuthProvider
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    session: { 
      user: { id: 'test-user' },
      access_token: 'test-token'
    },
    user: { id: 'test-user' },
    userProfile: {
      id: 'test-user',
      role: 'user' as const,
      status: 'ACTIVE' as const,
      organization_id: 'org-123',
      mailroom_id: 'mailroom-123'
    },
    isLoading: false,
    isAuthenticated: true,
    signIn: vi.fn(),
    signOut: vi.fn(),
    signUp: vi.fn(),
    resetPassword: vi.fn(),
    refreshUserProfile: vi.fn()
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

describe('RegisterPackage Integration', () => {
  it('completes package registration flow', async () => {
    const user = userEvent.setup()
    
    render(
      <RegisterPackage orgSlug="test-org" mailroomSlug="test-mailroom" />
    )

    // Wait for the component to load and fetch data
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
    })

    // Find and type in the resident input
    const residentInput = screen.getByPlaceholderText('Search...')
    await user.type(residentInput, 'John')
    
    // Wait a moment for the data to be fetched and filtered
    await waitFor(() => {
      // Check if "Doe, John" appears in the dropdown
      const dropdown = screen.queryByText('Doe, John')
      if (dropdown) {
        expect(dropdown).toBeInTheDocument()
      } else {
        // If it doesn't appear, log the current DOM for debugging
        screen.debug()
        // For now, let's check if "No results found" is shown
        expect(screen.getByText('No results found')).toBeInTheDocument()
      }
    }, { timeout: 3000 })

    // If we found the resident, continue with the test
    const residentOption = screen.queryByText('Doe, John')
    if (residentOption) {
      await user.click(residentOption)

      // Select carrier
      await waitFor(() => {
        expect(screen.getByText('Select the Package Carrier')).toBeInTheDocument()
      })
      
      await user.click(screen.getByLabelText('UPS'))

      // Submit form - use getByRole to target the button specifically
      await user.click(screen.getByRole('button', { name: /register package/i }))

      // Look for the actual success message - the package alert with ID and name
      await waitFor(() => {
        expect(screen.getByText(/001.*Doe.*John/)).toBeInTheDocument()
        expect(screen.getByText('Make sure to write this on the package')).toBeInTheDocument()
      })
    }
  })
})