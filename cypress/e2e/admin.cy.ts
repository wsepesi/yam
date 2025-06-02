// cypress/e2e/admin.cy.ts
describe('Admin Functionality', () => {
    beforeEach(() => {
      cy.login('admin@test.com', 'password123')
    })
  
    it('creates new organization and mailroom', () => {
      cy.visit('/admin')
      
      // Create organization
      cy.get('[data-cy="create-organization"]').click()
      cy.get('[data-cy="org-name"]').type('Test University')
      cy.get('[data-cy="org-slug"]').should('have.value', 'test-university')
      cy.get('[data-cy="submit-org"]').click()
      
      cy.get('[data-cy="success-message"]').should('contain', 'Organization created')
      
      // Navigate to new org
      cy.get('[data-cy="org-link"]').contains('Test University').click()
      
      // Create mailroom
      cy.get('[data-cy="create-mailroom"]').click()
      cy.get('[data-cy="mailroom-name"]').type('Main Campus')
      cy.get('[data-cy="admin-email"]').type('campus@test.edu')
      cy.get('[data-cy="submit-mailroom"]').click()
      
      // Wait for all steps to complete
      cy.get('[data-cy="progress-bar"]', { timeout: 10000 }).should('not.exist')
      cy.get('[data-cy="success-message"]').should('contain', 'Mailroom created')
    })
  })