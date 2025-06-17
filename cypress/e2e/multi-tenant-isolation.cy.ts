// cypress/e2e/multi-tenant-isolation.cy.ts
/**
 * Multi-Tenant Security E2E Tests
 * 
 * Critical tests to ensure proper data isolation between organizations and mailrooms.
 * These tests validate that users cannot access data outside their assigned tenants.
 */

describe('Multi-Tenant Security E2E Tests', () => {
  beforeEach(() => {
    // Clear all sessions before each test
    cy.clearCookies()
    cy.clearLocalStorage()
    cy.window().then((win) => {
      win.sessionStorage.clear()
    })
  })

  describe('Cross-Organization Access Prevention', () => {
    it('should prevent users from accessing different organizations via URL manipulation', () => {
      // Login as user from org-a
      cy.login('user-org-a@test.com', 'password123')
      
      // Verify user can access their own organization
      cy.visit('/org-a/mailroom-a1')
      cy.url().should('include', '/org-a/mailroom-a1')
      cy.url().should('not.include', '/unauthorized')
      
      // Try to access different organization via URL manipulation
      cy.visit('/org-b/mailroom-b1')
      
      // Should be redirected to unauthorized or back to their org
      cy.url().should('match', /unauthorized|org-a/)
      
      // If redirected to unauthorized, should see error message
      cy.url().then((url) => {
        if (url.includes('/unauthorized')) {
          cy.get('body').should('contain.text', 'authorized' || 'access' || 'permission')
        }
      })
    })

    it('should prevent direct API access to other organization data', () => {
      // Login as user from org-a
      cy.login('user-org-a@test.com', 'password123')
      
      // Attempt to directly access API endpoint for different organization
      cy.request({
        url: '/api/get-packages',
        method: 'GET',
        qs: { organization: 'org-b' },
        failOnStatusCode: false,
        headers: {
          'Content-Type': 'application/json'
        }
      }).then((response) => {
        // Should either be unauthorized (401/403) or return empty data
        expect([401, 403, 200]).to.include(response.status)
        
        if (response.status === 200) {
          // If status 200, should return empty array (RLS filtering)
          expect(response.body.packages || response.body.data || response.body).to.be.empty
        }
      })
    })

    it('should isolate package data between organizations', () => {
      // Test with org-a user
      cy.login('user-org-a@test.com', 'password123')
      cy.visit('/org-a/mailroom-a1/packages')
      
      // Should see packages page
      cy.url().should('include', '/packages')
      
      // Check that only org-a packages are visible
      cy.get('[data-cy="package-list"]', { timeout: 10000 }).should('exist')
      
      // Check for organization identifier in package data
      cy.get('[data-cy="package-item"]').each(($el) => {
        // Package items should not contain references to other orgs
        cy.wrap($el).should('not.contain.text', 'org-b')
        cy.wrap($el).should('not.contain.text', 'mailroom-b')
      })
    })

    it('should isolate resident data between organizations', () => {
      // Test with org-a user
      cy.login('manager-org-a@test.com', 'password123')
      cy.visit('/org-a/mailroom-a1/residents')
      
      // Should access residents page
      cy.url().should('include', '/residents')
      
      // Check that resident data is isolated
      cy.get('[data-cy="resident-list"]', { timeout: 10000 }).should('exist')
      
      // Residents should only belong to current org
      cy.get('[data-cy="resident-item"]').each(($el) => {
        cy.wrap($el).should('not.contain.text', 'org-b')
      })
    })
  })

  describe('Cross-Mailroom Access Prevention', () => {
    it('should prevent users from accessing different mailrooms within same organization', () => {
      // Login as user assigned to mailroom-a1
      cy.login('user-mailroom-a1@test.com', 'password123')
      
      // Verify access to assigned mailroom
      cy.visit('/org-a/mailroom-a1')
      cy.url().should('include', '/org-a/mailroom-a1')
      
      // Try to access different mailroom in same organization
      cy.visit('/org-a/mailroom-a2')
      
      // Should be redirected to unauthorized or back to their mailroom
      cy.url().should('match', /unauthorized|mailroom-a1/)
    })

    it('should enforce mailroom boundaries for managers', () => {
      // Login as manager of specific mailroom
      cy.login('manager-mailroom-a1@test.com', 'password123')
      
      // Should access own mailroom management features
      cy.visit('/org-a/mailroom-a1/manage-users')
      cy.url().should('include', '/manage-users')
      
      // Try to access different mailroom management
      cy.visit('/org-a/mailroom-a2/manage-users')
      
      // Should be redirected or blocked
      cy.url().should('match', /unauthorized|mailroom-a1/)
    })

    it('should isolate package numbers between mailrooms', () => {
      // Login as manager
      cy.login('manager-mailroom-a1@test.com', 'password123')
      cy.visit('/org-a/mailroom-a1/register')
      
      // Check that package registration only shows current mailroom context
      cy.get('[data-cy="mailroom-info"]').should('contain.text', 'mailroom-a1')
      cy.get('[data-cy="mailroom-info"]').should('not.contain.text', 'mailroom-a2')
    })
  })

  describe('Role Boundary Enforcement', () => {
    it('should prevent role escalation via URL manipulation', () => {
      // Login as regular user
      cy.login('user@test.com', 'password123')
      
      // Try to access admin-only features
      cy.visit('/admin')
      cy.url().should('include', '/unauthorized')
      
      // Try to access organization management
      cy.visit('/org-a/settings')
      cy.url().should('match', /unauthorized|mailroom/)
      
      // Try to access manager-only features
      cy.visit('/org-a/mailroom-a1/manage-users')
      cy.url().should('match', /unauthorized|overview/)
    })

    it('should allow admins to access any organization but with proper context', () => {
      // Login as admin
      cy.login('admin@test.com', 'password123')
      
      // Should be able to access admin panel
      cy.visit('/admin')
      cy.url().should('include', '/admin')
      
      // Should be able to access different organizations
      cy.visit('/org-a/mailroom-a1')
      cy.url().should('include', '/org-a/mailroom-a1')
      
      cy.visit('/org-b/mailroom-b1')
      cy.url().should('include', '/org-b/mailroom-b1')
    })

    it('should enforce manager permissions within assigned organization only', () => {
      // Login as manager from org-a
      cy.login('manager-org-a@test.com', 'password123')
      
      // Should access management features in own org
      cy.visit('/org-a/mailroom-a1/manage-users')
      cy.url().should('include', '/manage-users')
      
      // Should not access admin features
      cy.visit('/admin')
      cy.url().should('include', '/unauthorized')
      
      // Should not access other organizations
      cy.visit('/org-b/mailroom-b1/manage-users')
      cy.url().should('match', /unauthorized|org-a/)
    })
  })

  describe('URL Manipulation Security', () => {
    it('should prevent bypassing security through query parameters', () => {
      // Login as regular user
      cy.login('user-org-a@test.com', 'password123')
      
      // Try various URL manipulation attempts
      const maliciousUrls = [
        '/org-a/mailroom-a1?admin=true',
        '/org-a/mailroom-a1?role=admin',
        '/org-a/mailroom-a1?organization=org-b',
        '/org-a/mailroom-a1?bypass=true',
        '/org-a/mailroom-a1/../../../admin',
        '/org-a/mailroom-a1/manage-users?override=true'
      ]
      
      maliciousUrls.forEach((url) => {
        cy.visit(url, { failOnStatusCode: false })
        
        // Should either stay in allowed area or redirect to unauthorized
        cy.url().should('match', /org-a\/mailroom-a1(?!.*manage-users)|unauthorized/)
      })
    })

    it('should sanitize and validate organization/mailroom slugs', () => {
      // Login as user
      cy.login('user-org-a@test.com', 'password123')
      
      // Try malicious slug inputs
      const maliciousSlugs = [
        'org-a/../admin',
        'org-a/../../admin',
        '../org-b',
        'org-a%2F..%2Fadmin',
        'org-a/mailroom-a1/../../org-b/mailroom-b1'
      ]
      
      maliciousSlugs.forEach((slug) => {
        cy.visit(`/${slug}`, { failOnStatusCode: false })
        
        // Should be handled safely - either 404, unauthorized, or redirected to safe area
        cy.url().should('match', /404|unauthorized|org-a\/mailroom-a1/)
      })
    })

    it('should prevent session hijacking through URL parameters', () => {
      // Login as one user
      cy.login('user-org-a@test.com', 'password123')
      
      // Try to hijack session with URL params
      cy.visit('/org-a/mailroom-a1?session=admin-session-token')
      
      // Should maintain original session context
      cy.url().should('include', '/org-a/mailroom-a1')
      
      // Should not have admin privileges
      cy.visit('/admin')
      cy.url().should('include', '/unauthorized')
    })
  })

  describe('Data Leakage Prevention', () => {
    it('should not expose sensitive data in client-side JavaScript', () => {
      // Login as user
      cy.login('user-org-a@test.com', 'password123')
      cy.visit('/org-a/mailroom-a1')
      
      // Check window object for data leakage
      cy.window().then((win) => {
        const windowStr = JSON.stringify(win)
        
        // Should not contain sensitive data from other organizations
        expect(windowStr).to.not.include('org-b')
        expect(windowStr).to.not.include('mailroom-b')
        expect(windowStr).to.not.include('admin-secret')
        expect(windowStr).to.not.include('service-role-key')
      })
    })

    it('should not leak data through error messages', () => {
      // Login as user
      cy.login('user-org-a@test.com', 'password123')
      
      // Try to access non-existent but valid-format URLs
      cy.visit('/org-b/mailroom-b1', { failOnStatusCode: false })
      
      // Error page should not reveal information about org-b existence
      cy.get('body').should('not.contain.text', 'org-b exists')
      cy.get('body').should('not.contain.text', 'mailroom-b1 found')
      
      // Should get generic unauthorized message
      cy.get('body').should('contain.text', 'authorized' || 'permission' || 'access')
    })

    it('should not expose user data through autocomplete or suggestions', () => {
      // Login as manager
      cy.login('manager-org-a@test.com', 'password123')
      cy.visit('/org-a/mailroom-a1/register')
      
      // Check resident autocomplete only shows current org residents
      cy.get('[data-cy="resident-autocomplete"]').click()
      cy.get('[data-cy="resident-autocomplete"]').type('test')
      
      // Wait for suggestions
      cy.get('[data-cy="autocomplete-options"]', { timeout: 5000 }).should('exist')
      
      // Suggestions should not contain residents from other orgs
      cy.get('[data-cy="autocomplete-option"]').each(($option) => {
        cy.wrap($option).should('not.contain.text', 'org-b')
      })
    })
  })

  describe('Concurrent Session Management', () => {
    it('should handle multiple sessions from same user properly', () => {
      // Login in first session
      cy.login('user-org-a@test.com', 'password123')
      cy.visit('/org-a/mailroom-a1')
      
      // Simulate second session (new window/tab)
      cy.window().then((win) => {
        // Open new session
        const newWindow = win.open('/login', '_blank')
        
        // Should maintain isolation between sessions
        cy.url().should('include', '/org-a/mailroom-a1')
      })
    })

    it('should invalidate session on role changes', () => {
      // Login as manager
      cy.login('manager@test.com', 'password123')
      cy.visit('/org-a/mailroom-a1/manage-users')
      cy.url().should('include', '/manage-users')
      
      // Simulate role change (this would be done by admin in another session)
      // For testing, we'll simulate by clearing and setting new auth state
      cy.window().then((win) => {
        // Clear current session
        win.localStorage.clear()
        win.sessionStorage.clear()
      })
      
      // Try to access manager features again
      cy.visit('/org-a/mailroom-a1/manage-users')
      
      // Should redirect to login
      cy.url().should('include', '/login')
    })
  })
})