// cypress/e2e/package-management.cy.ts
describe('Package Management Flow', () => {
    beforeEach(() => {
      cy.seedTestData()
      cy.login('manager@test.com', 'password123')
    })
  
    afterEach(() => {
      cy.cleanupTestData()
    })
  
    it('registers and picks up a package', () => {
      // Navigate to register tab
      cy.visit('/test-org/test-mailroom')
      cy.get('[data-cy="tab-register"]').click()
  
      // Register package
      cy.get('[data-cy="resident-search"]').type('John Doe')
      cy.get('[data-cy="resident-option"]').first().click()
      cy.get('[data-cy="carrier-ups"]').check()
      cy.get('[data-cy="register-submit"]').click()
  
      // Verify success
      cy.get('[data-cy="success-alert"]').should('contain', 'Package successfully registered')
      
      // Navigate to pickup tab
      cy.get('[data-cy="tab-pickup"]').click()
      
      // Search for resident
      cy.get('[data-cy="resident-search"]').type('John Doe')
      cy.get('[data-cy="resident-option"]').first().click()
      cy.get('[data-cy="search-packages"]').click()
      
      // Select package and pickup
      cy.get('[data-cy="package-checkbox"]').first().check()
      cy.get('[data-cy="pickup-submit"]').click()
      
      // Verify pickup success
      cy.get('[data-cy="pickup-alert"]').should('be.visible')
    })
  
    it('manages resident roster', () => {
      cy.visit('/test-org/test-mailroom/manage-roster')
      
      // Add new resident
      cy.get('[data-cy="add-resident"]').click()
      cy.get('[data-cy="first-name"]').type('Jane')
      cy.get('[data-cy="last-name"]').type('Smith')
      cy.get('[data-cy="resident-id"]').type('67890')
      cy.get('[data-cy="email"]').type('jane@example.com')
      cy.get('[data-cy="submit-resident"]').click()
      
      // Verify resident appears in table
      cy.get('[data-cy="residents-table"]').should('contain', 'Jane Smith')
      
      // Upload roster file
      cy.get('[data-cy="upload-roster"]').click()
      cy.get('input[type="file"]').selectFile('cypress/fixtures/test-roster.xlsx')
      cy.get('[data-cy="confirm-upload"]').click()
      
      // Verify upload success
      cy.get('[data-cy="success-toast"]').should('contain', 'Roster uploaded successfully')
    })
  })