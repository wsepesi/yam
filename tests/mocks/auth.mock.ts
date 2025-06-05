// Authentication mock for NextAuth and session handling
import { vi } from 'vitest'

export interface MockSession {
  user: {
    id: string
    email: string
    name?: string
  }
  expires: string
}

export interface MockUser {
  id: string
  email: string
  name?: string
  role: 'user' | 'manager' | 'admin' | 'super-admin'
  organization_id?: string
  mailroom_id?: string
}

class AuthMock {
  private currentSession: MockSession | null = null
  private currentUser: MockUser | null = null
  private shouldFailAuth = false

  // Mock NextAuth functions
  getSession = vi.fn(async () => {
    if (this.shouldFailAuth) {
      return null
    }
    return this.currentSession
  })

  signIn = vi.fn(async (provider: string, options?: any) => {
    if (this.shouldFailAuth) {
      return { error: 'Authentication failed', url: null, ok: false, status: 401 }
    }
    
    if (options?.email) {
      this.setMockUser({
        id: 'test-user-id',
        email: options.email,
        role: 'user'
      })
    }
    
    return { error: null, url: null, ok: true, status: 200 }
  })

  signOut = vi.fn(async () => {
    this.currentSession = null
    this.currentUser = null
    return { url: '/login', ok: true, status: 200 }
  })

  // Session management utilities
  setMockSession(session: MockSession): void {
    this.currentSession = session
  }

  setMockUser(user: MockUser): void {
    this.currentUser = user
    this.currentSession = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
    }
  }

  clearSession(): void {
    this.currentSession = null
    this.currentUser = null
  }

  getMockUser(): MockUser | null {
    return this.currentUser
  }

  getMockSession(): MockSession | null {
    return this.currentSession
  }

  simulateAuthFailure(): void {
    this.shouldFailAuth = true
  }

  stopAuthFailure(): void {
    this.shouldFailAuth = false
  }

  // Role-based test utilities
  setUserRole(role: 'user' | 'manager' | 'admin' | 'super-admin'): void {
    if (this.currentUser) {
      this.currentUser.role = role
    }
  }

  setUserOrganization(orgId: string, mailroomId?: string): void {
    if (this.currentUser) {
      this.currentUser.organization_id = orgId
      this.currentUser.mailroom_id = mailroomId
    }
  }

  // Pre-built test scenarios
  createRegularUser(): MockUser {
    const user: MockUser = {
      id: 'user-123',
      email: 'user@test.edu',
      name: 'Test User',
      role: 'user',
      organization_id: 'org-123',
      mailroom_id: 'mailroom-123'
    }
    this.setMockUser(user)
    return user
  }

  createManager(): MockUser {
    const user: MockUser = {
      id: 'manager-123',
      email: 'manager@test.edu',
      name: 'Test Manager',
      role: 'manager',
      organization_id: 'org-123',
      mailroom_id: 'mailroom-123'
    }
    this.setMockUser(user)
    return user
  }

  createAdmin(): MockUser {
    const user: MockUser = {
      id: 'admin-123',
      email: 'admin@test.edu',
      name: 'Test Admin',
      role: 'admin',
      organization_id: 'org-123'
    }
    this.setMockUser(user)
    return user
  }

  createSuperAdmin(): MockUser {
    const user: MockUser = {
      id: 'super-admin-123',
      email: 'superadmin@test.edu',
      name: 'Super Admin',
      role: 'super-admin'
    }
    this.setMockUser(user)
    return user
  }

  // Permission testing utilities
  hasPermission(action: string, resource?: string): boolean {
    if (!this.currentUser) return false

    switch (this.currentUser.role) {
      case 'super-admin':
        return true
      case 'admin':
        return ['view_org', 'manage_org', 'create_mailroom', 'manage_users'].includes(action)
      case 'manager':
        return ['view_mailroom', 'manage_mailroom', 'manage_packages', 'manage_residents'].includes(action)
      case 'user':
        return ['view_packages'].includes(action)
      default:
        return false
    }
  }

  canAccessOrganization(orgId: string): boolean {
    if (!this.currentUser) return false
    if (this.currentUser.role === 'super-admin') return true
    return this.currentUser.organization_id === orgId
  }

  canAccessMailroom(mailroomId: string): boolean {
    if (!this.currentUser) return false
    if (this.currentUser.role === 'super-admin') return true
    if (this.currentUser.role === 'admin') return true // Admin can access all mailrooms in their org
    return this.currentUser.mailroom_id === mailroomId
  }
}

export const mockAuth = new AuthMock()

// Mock the handleSession function
export const mockHandleSession = vi.fn(async (req: any) => {
  const session = mockAuth.getMockSession()
  const user = mockAuth.getMockUser()
  
  if (!session || !user) {
    return { session: null, user: null, authorized: false }
  }

  return {
    session,
    user,
    authorized: true
  }
})

// Mock JWT utilities
export const mockJWT = {
  sign: vi.fn((payload: any) => `mock.jwt.token.${btoa(JSON.stringify(payload))}`),
  verify: vi.fn((token: string) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[3]))
      return payload
    } catch {
      throw new Error('Invalid token')
    }
  })
}