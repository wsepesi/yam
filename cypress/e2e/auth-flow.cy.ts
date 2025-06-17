// cypress/e2e/auth-flow.cy.ts
/**
 * Authentication Flow E2E Tests
 * 
 * Tests core authentication flows: login, logout, session persistence, 
 * and role-based navigation that are critical for user security.
 */

describe('Authentication Flow E2E Tests', () => {
  beforeEach(() => {
    // Clear all sessions and cookies before each test
    cy.clearCookies()
    cy.clearLocalStorage()
    cy.window().then((win) => {
      win.sessionStorage.clear()
    })
  })

  describe('Login Flow', () => {
    it('should successfully login with valid credentials', () => {
      cy.visit('/login')
      
      // Check that login form is visible
      cy.get('[name="email"]').should('be.visible')
      cy.get('[name="password"]').should('be.visible')
      cy.get('button[type="submit"]').should('be.visible')
      
      // Login with valid credentials (assuming test data exists)
      cy.get('[name="email"]').type('user@test.com')
      cy.get('[name="password"]').type('password123')
      cy.get('button[type="submit"]').click()
      
      // Should redirect away from login page
      cy.url().should('not.include', '/login')
      
      // Should be redirected to a valid mailroom page or dashboard
      cy.url().should('match', /\/[\w-]+\/[\w-]+/ || '/admin')
    })

    it('should reject invalid credentials', () => {
      cy.visit('/login')
      
      // Try login with invalid credentials
      cy.get('[name="email"]').type('invalid@test.com')
      cy.get('[name="password"]').type('wrongpassword')
      cy.get('button[type="submit"]').click()
      
      // Should remain on login page
      cy.url().should('include', '/login')
      
      // Should show error message
      cy.get('body').should('contain.text', 'Invalid' || 'Error' || 'incorrect')
    })

    it('should redirect to callback URL after login', () => {
      const callbackUrl = encodeURIComponent('/test-org/test-mailroom/overview')
      
      // Visit login page with callback URL
      cy.visit(`/login?callbackUrl=${callbackUrl}`)
      
      // Login successfully
      cy.get('[name="email"]').type('user@test.com')
      cy.get('[name="password"]').type('password123')
      cy.get('button[type="submit"]').click()
      
      // Should redirect to the callback URL
      cy.url().should('include', '/test-org/test-mailroom/overview')
    })

    it('should handle empty form submission', () => {
      cy.visit('/login')
      
      // Try to submit empty form
      cy.get('button[type="submit"]').click()
      
      // Should show validation errors or remain on page
      cy.url().should('include', '/login')
      
      // Check for validation messages
      cy.get('body').should('contain.text', 'required' || 'invalid' || 'enter')
    })
  })

  describe('Logout Flow', () => {
    it('should successfully logout and clear session', () => {
      // Login first
      cy.login('user@test.com', 'password123')
      cy.visit('/test-org/test-mailroom')
      
      // Verify user is logged in
      cy.url().should('not.include', '/login')
      
      // Look for logout button/link and click it
      cy.get('a[href="/signout"]', { timeout: 10000 }).should('be.visible').click()
      
      // Should redirect to login page
      cy.url().should('include', '/login')
      
      // Try to access protected page - should redirect to login
      cy.visit('/test-org/test-mailroom')
      cy.url().should('include', '/login')
    })

    it('should clear all authentication data on logout', () => {
      // Login and store session data
      cy.login('user@test.com', 'password123')
      cy.visit('/test-org/test-mailroom')
      
      // Logout
      cy.get('a[href="/signout"]').click()
      
      // Check that authentication data is cleared
      cy.window().then((window) => {
        // Check localStorage is cleared of auth data
        const authItems = ['supabase.auth.token', 'sb-auth-token', 'user-profile']
        authItems.forEach(item => {
          expect(window.localStorage.getItem(item)).to.be.null
        })
      })
      
      // Check that cookies are cleared
      cy.getCookies().should('not.exist' || 'have.length', 0)
    })
  })

  describe('Session Persistence', () => {
    it('should persist session across page refreshes', () => {
      // Login
      cy.login('user@test.com', 'password123')
      cy.visit('/test-org/test-mailroom')
      
      // Verify logged in
      cy.url().should('not.include', '/login')
      
      // Refresh the page
      cy.reload()
      
      // Should still be logged in
      cy.url().should('not.include', '/login')
      cy.url().should('include', '/test-org/test-mailroom')
    })

    it('should persist session across tab navigation', () => {
      // Login
      cy.login('user@test.com', 'password123')
      cy.visit('/test-org/test-mailroom')
      
      // Navigate to different tab/page
      cy.visit('/test-org/test-mailroom/packages')
      cy.url().should('include', '/packages')
      cy.url().should('not.include', '/login')
      
      // Navigate to another protected page
      cy.visit('/test-org/test-mailroom/residents')
      cy.url().should('include', '/residents')
      cy.url().should('not.include', '/login')
    })

    it('should handle session expiry gracefully', () => {
      // Login
      cy.login('user@test.com', 'password123')
      cy.visit('/test-org/test-mailroom')
      
      // Simulate session expiry by clearing auth tokens
      cy.window().then((window) => {
        // Clear session storage and local storage auth data
        window.sessionStorage.clear()
        window.localStorage.removeItem('supabase.auth.token')
        window.localStorage.removeItem('sb-auth-token')
      })
      
      // Clear cookies that might contain auth data
      cy.clearCookies()
      
      // Try to navigate to protected page
      cy.visit('/test-org/test-mailroom')
      
      // Should redirect to login
      cy.url().should('include', '/login')
    })
  })

  describe('Role-based Navigation', () => {
    it('should redirect users to their appropriate dashboard', () => {
      // Test with regular user
      cy.login('user@test.com', 'password123')
      cy.visit('/')
      
      // Regular users should be redirected to their mailroom
      cy.url().should('match', /\/[\w-]+\/[\w-]+/)
      cy.url().should('not.include', '/admin')
    })

    it('should allow admins to access admin features', () => {
      // Test with admin user
      cy.login('admin@test.com', 'password123')
      cy.visit('/admin')
      
      // Admins should be able to access admin page
      cy.url().should('include', '/admin')
      cy.url().should('not.include', '/unauthorized')
      
      // Should see admin-specific content
      cy.get('body').should('contain.text', 'Admin' || 'Organizations' || 'System')
    })

    it('should prevent regular users from accessing admin features', () => {
      // Test with regular user
      cy.login('user@test.com', 'password123')
      cy.visit('/admin')
      
      // Should be redirected to unauthorized page
      cy.url().should('include', '/unauthorized')
    })

    it('should enforce organization boundaries', () => {
      // Login as user from specific org
      cy.login('user@test.com', 'password123')
      
      // Try to access different organization
      cy.visit('/different-org/different-mailroom')
      
      // Should be redirected to unauthorized or their own org
      cy.url().should('match', /unauthorized|login|test-org/)
    })
  })

  describe('Authentication Error Handling', () => {
    it('should handle network errors gracefully', () => {
      // Intercept auth requests and make them fail
      cy.intercept('POST', '**/auth/v1/**', { forceNetworkError: true })
      
      cy.visit('/login')
      cy.get('[name="email"]').type('user@test.com')
      cy.get('[name="password"]').type('password123')
      cy.get('button[type="submit"]').click()
      
      // Should show error message and remain on login
      cy.url().should('include', '/login')
      cy.get('body').should('contain.text', 'error' || 'failed' || 'try again')
    })

    it('should handle concurrent login attempts', () => {
      cy.visit('/login')
      
      // Fill form
      cy.get('[name="email"]').type('user@test.com')
      cy.get('[name="password"]').type('password123')
      
      // Click submit multiple times rapidly
      cy.get('button[type="submit"]').click()
      cy.get('button[type="submit"]').click()
      cy.get('button[type="submit"]').click()
      
      // Should handle gracefully - either succeed or show appropriate error
      cy.url({ timeout: 10000 }).should('not.include', '/login')
    })

    it('should handle malformed tokens gracefully', () => {
      // Set malformed token in localStorage
      cy.window().then((window) => {
        window.localStorage.setItem('supabase.auth.token', 'malformed-token')
      })
      
      // Try to access protected page
      cy.visit('/test-org/test-mailroom')
      
      // Should redirect to login due to invalid token
      cy.url().should('include', '/login')
    })
  })
})