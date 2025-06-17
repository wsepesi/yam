// tests/utils/test-utils.tsx
import { render, RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';
import React from 'react';
import { Session, User } from '@supabase/supabase-js';
import { AuthContext, UserProfile, UserRole } from '@/context/AuthContext';

// Mock Next.js router for tests
export const createMockRouter = (overrides = {}) => ({
  push: vi.fn(),
  replace: vi.fn(),
  query: { org: 'test-org', mailroom: 'test-mailroom' },
  asPath: '/test-org/test-mailroom/overview',
  pathname: '/[org]/[mailroom]/[[...tab]]',
  isReady: true,
  ...overrides
});

// Mock router for Next.js
vi.mock('next/router', () => ({
  useRouter: vi.fn()
}));

// Default mock user data
export const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-123',
  email: 'test@example.com',
  phone: null,
  email_confirmed_at: '2024-01-01T00:00:00.000Z',
  confirmed_at: '2024-01-01T00:00:00.000Z',
  last_sign_in_at: '2024-01-01T00:00:00.000Z',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  aud: 'authenticated',
  user_metadata: {},
  app_metadata: {},
  ...overrides
});

export const createMockSession = (user: User, overrides: Partial<Session> = {}): Session => ({
  user,
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  expires_at: Date.now() / 1000 + 3600,
  token_type: 'bearer',
  ...overrides
});

export const createMockUserProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: 'user-123',
  role: 'user' as UserRole,
  status: 'ACTIVE',
  organization_id: 'org-123',
  mailroom_id: 'mailroom-123',
  ...overrides
});

// Auth context configurations for different scenarios
export type AuthScenario = 
  | 'authenticated-user'
  | 'authenticated-manager' 
  | 'authenticated-admin'
  | 'unauthenticated'
  | 'loading'
  | 'error'
  | 'removed-user';

export const getAuthContextValue = (scenario: AuthScenario) => {
  const mockUser = createMockUser();
  const mockSession = createMockSession(mockUser);

  switch (scenario) {
    case 'authenticated-user':
      return {
        session: mockSession,
        user: mockUser,
        userProfile: createMockUserProfile({ role: 'user' }),
        isLoading: false,
        isAuthenticated: true,
        signIn: vi.fn().mockResolvedValue({ error: null, success: true }),
        signOut: vi.fn().mockResolvedValue(undefined),
        signUp: vi.fn().mockResolvedValue({ error: null, success: true }),
        resetPassword: vi.fn().mockResolvedValue({ error: null, success: true }),
        refreshUserProfile: vi.fn().mockResolvedValue(createMockUserProfile())
      };

    case 'authenticated-manager':
      return {
        session: mockSession,
        user: mockUser,
        userProfile: createMockUserProfile({ role: 'manager' }),
        isLoading: false,
        isAuthenticated: true,
        signIn: vi.fn().mockResolvedValue({ error: null, success: true }),
        signOut: vi.fn().mockResolvedValue(undefined),
        signUp: vi.fn().mockResolvedValue({ error: null, success: true }),
        resetPassword: vi.fn().mockResolvedValue({ error: null, success: true }),
        refreshUserProfile: vi.fn().mockResolvedValue(createMockUserProfile({ role: 'manager' }))
      };

    case 'authenticated-admin':
      return {
        session: mockSession,
        user: mockUser,
        userProfile: createMockUserProfile({ role: 'admin' }),
        isLoading: false,
        isAuthenticated: true,
        signIn: vi.fn().mockResolvedValue({ error: null, success: true }),
        signOut: vi.fn().mockResolvedValue(undefined),
        signUp: vi.fn().mockResolvedValue({ error: null, success: true }),
        resetPassword: vi.fn().mockResolvedValue({ error: null, success: true }),
        refreshUserProfile: vi.fn().mockResolvedValue(createMockUserProfile({ role: 'admin' }))
      };

    case 'unauthenticated':
      return {
        session: null,
        user: null,
        userProfile: null,
        isLoading: false,
        isAuthenticated: false,
        signIn: vi.fn().mockResolvedValue({ error: null, success: true }),
        signOut: vi.fn().mockResolvedValue(undefined),
        signUp: vi.fn().mockResolvedValue({ error: null, success: true }),
        resetPassword: vi.fn().mockResolvedValue({ error: null, success: true }),
        refreshUserProfile: vi.fn().mockResolvedValue(null)
      };

    case 'loading':
      return {
        session: null,
        user: null,
        userProfile: null,
        isLoading: true,
        isAuthenticated: false,
        signIn: vi.fn().mockResolvedValue({ error: null, success: true }),
        signOut: vi.fn().mockResolvedValue(undefined),
        signUp: vi.fn().mockResolvedValue({ error: null, success: true }),
        resetPassword: vi.fn().mockResolvedValue({ error: null, success: true }),
        refreshUserProfile: vi.fn().mockResolvedValue(null)
      };

    case 'removed-user':
      return {
        session: mockSession,
        user: mockUser,
        userProfile: createMockUserProfile({ status: 'REMOVED' }),
        isLoading: false,
        isAuthenticated: true,
        signIn: vi.fn().mockResolvedValue({ error: new Error('Your access has been revoked.'), success: false }),
        signOut: vi.fn().mockResolvedValue(undefined),
        signUp: vi.fn().mockResolvedValue({ error: null, success: true }),
        resetPassword: vi.fn().mockResolvedValue({ error: null, success: true }),
        refreshUserProfile: vi.fn().mockResolvedValue(createMockUserProfile({ status: 'REMOVED' }))
      };

    case 'error':
      return {
        session: null,
        user: null,
        userProfile: null,
        isLoading: false,
        isAuthenticated: false,
        signIn: vi.fn().mockResolvedValue({ error: new Error('Auth error'), success: false }),
        signOut: vi.fn().mockResolvedValue(undefined),
        signUp: vi.fn().mockResolvedValue({ error: new Error('Signup error'), success: false }),
        resetPassword: vi.fn().mockResolvedValue({ error: new Error('Reset error'), success: false }),
        refreshUserProfile: vi.fn().mockResolvedValue(null)
      };

    default:
      return getAuthContextValue('authenticated-user');
  }
};

// Wrapper component that provides auth context
interface AuthWrapperProps {
  children: React.ReactNode;
  authScenario?: AuthScenario;
  customAuthValue?: any;
}

const AuthWrapper: React.FC<AuthWrapperProps> = ({ 
  children, 
  authScenario = 'authenticated-user',
  customAuthValue 
}) => {
  const authValue = customAuthValue || getAuthContextValue(authScenario);
  
  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom render function that wraps components with auth context
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  authScenario?: AuthScenario;
  customAuthValue?: any;
  routerMock?: any;
}

export const renderWithAuth = (
  component: React.ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { 
    authScenario = 'authenticated-user', 
    customAuthValue,
    routerMock,
    ...renderOptions 
  } = options;

  // Setup router mock if provided
  if (routerMock) {
    try {
      const { useRouter } = require('next/router');
      if (useRouter && vi.mocked(useRouter).mockReturnValue) {
        vi.mocked(useRouter).mockReturnValue(routerMock);
      }
    } catch (error) {
      // Router already mocked by test, skip
    }
  }

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthWrapper 
      authScenario={authScenario} 
      customAuthValue={customAuthValue}
    >
      {children}
    </AuthWrapper>
  );

  return render(component, { wrapper: Wrapper, ...renderOptions });
};

// Helper to setup Supabase mocks for auth context testing
export const setupSupabaseMocks = async (scenario: AuthScenario = 'authenticated-user') => {
  const mockSupabase = await import('@/lib/supabase');
  
  const authValue = getAuthContextValue(scenario);
  
  // Mock auth methods
  vi.mocked(mockSupabase.supabase.auth.getSession).mockResolvedValue({
    data: { session: authValue.session },
    error: null
  } as any);

  vi.mocked(mockSupabase.supabase.auth.onAuthStateChange).mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } }
  } as any);

  if (authValue.userProfile) {
    // Mock profile fetch
    vi.mocked(mockSupabase.supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn()
        .mockResolvedValueOnce({ data: authValue.userProfile, error: null })
        .mockResolvedValueOnce({ data: { slug: 'test-org' }, error: null })
        .mockResolvedValueOnce({ data: { slug: 'test-mailroom' }, error: null })
    } as any);
  }

  return mockSupabase;
};

// Helper to setup localStorage/sessionStorage mocks
export const setupStorageMocks = () => {
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    },
    writable: true,
  });

  Object.defineProperty(window, 'sessionStorage', {
    value: {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    },
    writable: true,
  });
};

// Helper to wait for auth context to stabilize
export const waitForAuth = () => {
  return new Promise(resolve => setTimeout(resolve, 0));
};

// Export default render for convenience
export { render } from '@testing-library/react';
export * from '@testing-library/react';