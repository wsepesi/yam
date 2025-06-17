// cypress/e2e/critical/04-admin-operations.cy.ts
describe('Admin Operations E2E Critical Flow', () => {
  beforeEach(() => {
    // Clean up test data before each test
    cy.cleanupTestData()
    
    // Create and login as super-admin
    cy.createTestUser('super-admin').then((user: any) => {
      cy.login(user.email, user.password)
    })
  })

  afterEach(() => {
    // Clean up test data after each test
    cy.cleanupTestData()
  })

  describe('Organization Management', () => {
    it('should allow admin to create a new organization', () => {
      cy.visit('/admin')
      
      // Verify admin dashboard loads
      cy.get('[data-testid="layout"]').should('contain', 'YAM ADMIN')
      cy.get('h1').should('contain', 'YAM ADMIN')
      
      // Navigate to organizations tab
      cy.get('button').contains('organizations').click()
      cy.url().should('include', '/admin?tab=organizations')
      
      // Verify organizations tab loads
      cy.get('h2').should('contain', 'All Organizations')
      cy.get('table').should('be.visible')
      
      // Click create new organization button
      cy.get('button').contains('Create New Organization').click()
      
      // Fill out organization creation form
      cy.get('[data-testid="org-name-input"]').type('Test University E2E')
      cy.get('[data-testid="org-slug-input"]').should('have.value', 'test-university-e2e')
      
      // Submit organization creation
      cy.get('[data-testid="create-org-submit"]').click()
      
      // Verify success message
      cy.get('[data-testid="success-message"]').should('contain', 'Organization created successfully')
      
      // Verify organization appears in the list
      cy.get('table tbody').should('contain', 'Test University E2E')
      cy.get('table tbody').should('contain', 'test-university-e2e')
      
      // Verify organization status is ACTIVE
      cy.get('table tbody tr').contains('Test University E2E')
        .parent()
        .within(() => {
          cy.get('.bg-green-100').should('contain', 'ACTIVE')
        })
    })

    it('should validate organization name and slug requirements', () => {
      cy.visit('/admin?tab=organizations')
      
      // Click create new organization button
      cy.get('button').contains('Create New Organization').click()
      
      // Try to submit without name
      cy.get('[data-testid="create-org-submit"]').click()
      
      // Should show validation error
      cy.get('[data-testid="validation-error"]').should('contain', 'Organization name is required')
      
      // Enter name with special characters
      cy.get('[data-testid="org-name-input"]').type('Test Org! @#$%')
      
      // Verify slug is sanitized
      cy.get('[data-testid="org-slug-input"]').should('have.value', 'test-org')
      
      // Try duplicate slug
      cy.get('[data-testid="org-slug-input"]').clear().type('existing-org')
      cy.get('[data-testid="create-org-submit"]').click()
      
      // Should show duplicate error if organization already exists
      cy.get('[data-testid="error-message"]', { timeout: 5000 })
        .should('be.visible')
        .and('contain.text', 'already exists')
    })

    it('should allow admin to view organization details', () => {
      // Create organization first
      cy.visit('/admin?tab=organizations')
      cy.get('button').contains('Create New Organization').click()
      cy.get('[data-testid="org-name-input"]').type('Viewable University')
      cy.get('[data-testid="create-org-submit"]').click()
      cy.get('[data-testid="success-message"]').should('be.visible')
      
      // Click on organization name to view details
      cy.get('table tbody button').contains('Viewable University').click()
      
      // Should navigate to organization page
      cy.url().should('include', '/viewable-university')
      
      // Should show organization overview
      cy.get('h1').should('contain', 'Viewable University')
      cy.get('[data-testid="org-overview"]').should('be.visible')
    })
  })

  describe('Mailroom Management', () => {
    beforeEach(() => {
      // Create a test organization for mailroom tests
      cy.visit('/admin?tab=organizations')
      cy.get('button').contains('Create New Organization').click()
      cy.get('[data-testid="org-name-input"]').type('Mailroom Test University')
      cy.get('[data-testid="create-org-submit"]').click()
      cy.get('[data-testid="success-message"]').should('be.visible')
      
      // Navigate to the organization
      cy.get('table tbody button').contains('Mailroom Test University').click()
      cy.url().should('include', '/mailroom-test-university')
    })

    it('should allow admin to create a new mailroom', () => {
      // Should be on organization overview page
      cy.get('h1').should('contain', 'Mailroom Test University')
      
      // Navigate to mailrooms tab (if exists) or look for create mailroom button
      cy.get('button').contains(/create.*mailroom/i).click()
      
      // Fill out mailroom creation form
      cy.get('[data-testid="mailroom-name-input"]').type('Main Campus Mailroom')
      cy.get('[data-testid="mailroom-admin-email"]').type('admin@testuniversity.edu')
      cy.get('[data-testid="mailroom-location"]').type('Student Union Building')
      
      // Submit mailroom creation
      cy.get('[data-testid="create-mailroom-submit"]').click()
      
      // Wait for package queue initialization (this can take time)
      cy.get('[data-testid="progress-indicator"]', { timeout: 15000 }).should('not.exist')
      
      // Verify success message
      cy.get('[data-testid="success-message"]').should('contain', 'Mailroom created successfully')
      
      // Verify mailroom appears in organization
      cy.get('[data-testid="mailroom-list"]').should('contain', 'Main Campus Mailroom')
      cy.get('[data-testid="mailroom-list"]').should('contain', 'main-campus-mailroom')
    })

    it('should validate mailroom creation requirements', () => {
      // Click create mailroom
      cy.get('button').contains(/create.*mailroom/i).click()
      
      // Try to submit without required fields
      cy.get('[data-testid="create-mailroom-submit"]').click()
      
      // Should show validation errors
      cy.get('[data-testid="validation-error"]').should('contain', 'Mailroom name is required')
      cy.get('[data-testid="validation-error"]').should('contain', 'Admin email is required')
      
      // Enter invalid email
      cy.get('[data-testid="mailroom-name-input"]').type('Test Mailroom')
      cy.get('[data-testid="mailroom-admin-email"]').type('invalid-email')
      cy.get('[data-testid="create-mailroom-submit"]').click()
      
      // Should show email validation error
      cy.get('[data-testid="validation-error"]').should('contain', 'valid email address')
      
      // Enter valid data
      cy.get('[data-testid="mailroom-admin-email"]').clear().type('valid@email.com')
      cy.get('[data-testid="create-mailroom-submit"]').click()
      
      // Should proceed with creation
      cy.get('[data-testid="progress-indicator"]').should('be.visible')
    })

    it('should initialize package queue when creating mailroom', () => {
      // Create mailroom
      cy.get('button').contains(/create.*mailroom/i).click()
      cy.get('[data-testid="mailroom-name-input"]').type('Queue Test Mailroom')
      cy.get('[data-testid="mailroom-admin-email"]').type('queue@test.edu')
      cy.get('[data-testid="create-mailroom-submit"]').click()
      
      // Wait for package queue initialization
      cy.get('[data-testid="progress-indicator"]', { timeout: 15000 }).should('not.exist')
      cy.get('[data-testid="success-message"]').should('be.visible')
      
      // Navigate to the new mailroom
      cy.get('[data-testid="mailroom-link"]').contains('Queue Test Mailroom').click()
      
      // Should be able to register a package (indicates queue is working)
      cy.get('button').contains('register').click()
      cy.get('[data-testid="register-tab"]').should('be.visible')
      
      // Verify package number field shows next available number (1)
      cy.get('[data-testid="package-number"]').should('contain', '1')
    })
  })

  describe('System-Wide Statistics', () => {
    beforeEach(() => {
      // Seed some test data for statistics
      cy.seedTestData()
    })

    it('should display system overview statistics', () => {
      cy.visit('/admin')
      
      // Should be on overview tab by default
      cy.get('h2').should('contain', 'overview')
      
      // Verify statistics cards are displayed
      cy.get('[data-testid="stat-total-organizations"]').should('be.visible')
      cy.get('[data-testid="stat-total-mailrooms"]').should('be.visible')
      cy.get('[data-testid="stat-total-users"]').should('be.visible')
      cy.get('[data-testid="stat-total-packages"]').should('be.visible')
      
      // Verify statistics have numeric values
      cy.get('[data-testid="stat-total-organizations"]').should('contain.text', /\d+/)
      cy.get('[data-testid="stat-total-mailrooms"]').should('contain.text', /\d+/)
      cy.get('[data-testid="stat-total-users"]').should('contain.text', /\d+/)
      cy.get('[data-testid="stat-total-packages"]').should('contain.text', /\d+/)
    })

    it('should display recent activity feed', () => {
      cy.visit('/admin')
      
      // Verify activity feed section
      cy.get('[data-testid="recent-activity"]').should('be.visible')
      cy.get('h3').should('contain', 'Recent Activity')
      
      // Should show activity items
      cy.get('[data-testid="activity-item"]').should('have.length.at.least', 1)
      
      // Each activity item should have timestamp and description
      cy.get('[data-testid="activity-item"]').first().within(() => {
        cy.get('[data-testid="activity-timestamp"]').should('be.visible')
        cy.get('[data-testid="activity-description"]').should('be.visible')
      })
    })

    it('should display system health indicators', () => {
      cy.visit('/admin')
      
      // Verify system health section
      cy.get('[data-testid="system-health"]').should('be.visible')
      cy.get('h3').should('contain', 'System Health')
      
      // Should show health indicators
      cy.get('[data-testid="health-database"]').should('be.visible')
      cy.get('[data-testid="health-email-service"]').should('be.visible')
      cy.get('[data-testid="health-storage"]').should('be.visible')
      
      // Health indicators should show status
      cy.get('[data-testid="health-database"]').should('contain.text', /healthy|warning|error/i)
      cy.get('[data-testid="health-email-service"]').should('contain.text', /healthy|warning|error/i)
      cy.get('[data-testid="health-storage"]').should('contain.text', /healthy|warning|error/i)
    })
  })

  describe('Admin Navigation and Access Control', () => {
    it('should enforce super-admin access to admin dashboard', () => {
      // Login as regular admin (not super-admin)
      cy.cleanupTestData()
      cy.createTestUser('admin').then((user: any) => {
        cy.login(user.email, user.password)
      })
      
      // Try to access admin dashboard
      cy.visit('/admin')
      
      // Should show access denied
      cy.get('h1').should('contain', 'Access Denied')
      cy.get('p').should('contain', 'super-admins only')
    })

    it('should redirect non-authenticated users to login', () => {
      // Visit admin page without authentication
      cy.visit('/admin')
      
      // Should redirect to login
      cy.url().should('include', '/login')
      cy.get('h1').should('contain', 'Login')
    })

    it('should handle tab navigation correctly', () => {
      cy.visit('/admin')
      
      // Should default to overview tab
      cy.url().should('eq', Cypress.config().baseUrl + '/admin')
      cy.get('h2').should('contain', 'overview')
      
      // Navigate to organizations tab
      cy.get('button').contains('organizations').click()
      cy.url().should('include', '/admin?tab=organizations')
      cy.get('h2').should('contain', 'All Organizations')
      
      // Navigate back to overview
      cy.get('button').contains('overview').click()
      cy.url().should('eq', Cypress.config().baseUrl + '/admin')
      cy.get('h2').should('contain', 'overview')
    })

    it('should handle invalid tab gracefully', () => {
      // Visit admin with invalid tab
      cy.visit('/admin?tab=invalid-tab')
      
      // Should redirect to default tab (overview)
      cy.url().should('eq', Cypress.config().baseUrl + '/admin')
      cy.get('h2').should('contain', 'overview')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle API failures gracefully during organization creation', () => {
      // Intercept organization creation API and make it fail
      cy.intercept('POST', '/api/organizations/create', {
        statusCode: 500,
        body: { error: 'Internal server error' }
      }).as('createOrgFailure')
      
      cy.visit('/admin?tab=organizations')
      cy.get('button').contains('Create New Organization').click()
      cy.get('[data-testid="org-name-input"]').type('Failure Test Org')
      cy.get('[data-testid="create-org-submit"]').click()
      
      cy.wait('@createOrgFailure')
      
      // Should show error message
      cy.get('[data-testid="error-message"]').should('contain', 'Failed to create organization')
      
      // Form should remain open for retry
      cy.get('[data-testid="org-name-input"]').should('have.value', 'Failure Test Org')
    })

    it('should handle network timeouts during mailroom creation', () => {
      // First create an organization
      cy.visit('/admin?tab=organizations')
      cy.get('button').contains('Create New Organization').click()
      cy.get('[data-testid="org-name-input"]').type('Timeout Test University')
      cy.get('[data-testid="create-org-submit"]').click()
      cy.get('[data-testid="success-message"]').should('be.visible')
      
      // Navigate to organization
      cy.get('table tbody button').contains('Timeout Test University').click()
      
      // Intercept mailroom creation API with timeout
      cy.intercept('POST', '/api/mailrooms/create', (req) => {
        req.reply((res) => {
          res.delay(30000) // 30 second delay to trigger timeout
          res.send({ statusCode: 200, body: { success: true } })
        })
      }).as('createMailroomTimeout')
      
      // Try to create mailroom
      cy.get('button').contains(/create.*mailroom/i).click()
      cy.get('[data-testid="mailroom-name-input"]').type('Timeout Mailroom')
      cy.get('[data-testid="mailroom-admin-email"]').type('timeout@test.edu')
      cy.get('[data-testid="create-mailroom-submit"]').click()
      
      // Should show timeout error after reasonable wait
      cy.get('[data-testid="error-message"]', { timeout: 20000 })
        .should('contain', 'timeout')
        .or('contain', 'took too long')
        .or('contain', 'network error')
    })

    it('should handle large datasets in organization list', () => {
      // Create multiple organizations to test pagination/scrolling
      for (let i = 1; i <= 5; i++) {
        cy.visit('/admin?tab=organizations')
        cy.get('button').contains('Create New Organization').click()
        cy.get('[data-testid="org-name-input"]').type(`Test Organization ${i}`)
        cy.get('[data-testid="create-org-submit"]').click()
        cy.get('[data-testid="success-message"]').should('be.visible')
      }
      
      // Verify all organizations are displayed
      cy.visit('/admin?tab=organizations')
      cy.get('table tbody tr').should('have.length.at.least', 5)
      
      // Verify table is scrollable/paginated if needed
      cy.get('table').should('be.visible')
      cy.get('table tbody').within(() => {
        for (let i = 1; i <= 5; i++) {
          cy.should('contain', `Test Organization ${i}`)
        }
      })
    })
  })
})