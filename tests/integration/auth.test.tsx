import * as userPreferences from '@/lib/userPreferences'

// tests/integration/auth.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

import Login from '@/pages/login'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/router'
import userEvent from '@testing-library/user-event'

// Mock the useRouter hook
vi.mock('next/router', () => ({
  useRouter: vi.fn()
}))

// Mock the auth context
vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn()
}))

// Mock user preferences
vi.mock('@/lib/userPreferences', () => ({
  getUserRedirectPath: vi.fn()
}))

describe('Authentication Flow', () => {
  it('handles successful login', async () => {
    const user = userEvent.setup()
    const mockPush = vi.fn()
    const mockSignIn = vi.fn()
    
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      query: {},
      pathname: '/login',
      asPath: '/login',
      isReady: true
    } as unknown as ReturnType<typeof useRouter>)

    // Mock successful sign in
    mockSignIn.mockResolvedValue({
      error: null,
      success: true,
      userProfile: {
        id: 'user-123',
        role: 'user' as const,
        status: 'ACTIVE' as const,
        organization_id: 'org-123',
        mailroom_id: 'mailroom-123'
      }
    })

    vi.mocked(useAuth).mockReturnValue({
      signIn: mockSignIn,
      session: null,
      user: null,
      userProfile: null,
      isLoading: false,
      isAuthenticated: false,
      signOut: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      refreshUserProfile: vi.fn()
    })

    // Mock getUserRedirectPath to return the expected path
    vi.mocked(userPreferences.getUserRedirectPath).mockResolvedValue('/test-org/test-mailroom')

    render(<Login />)

    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/test-org/test-mailroom')
    })
  })
})