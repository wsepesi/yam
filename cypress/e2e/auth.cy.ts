// cypress/e2e/auth.cy.ts
describe('Authentication & Authorization', () => {
    it('redirects unauthenticated users to login', () => {
      cy.visit('/test-org/test-mailroom')
      cy.url().should('include', '/login')
    })
  
    it('prevents unauthorized access to admin features', () => {
      cy.login('user@test.com', 'password123')
      cy.visit('/admin')
      cy.url().should('include', '/unauthorized')
    })
  
    it('completes invitation flow', () => {
      // Admin creates invitation
      cy.login('admin@test.com', 'password123')
      cy.visit('/test-org/test-mailroom/manage-users')
      
      cy.get('[data-cy="invite-email"]').type('newuser@test.com')
      cy.get('[data-cy="send-invitation"]').click()
      cy.get('[data-cy="success-message"]').should('contain', 'Invitation sent')
      
      // New user completes registration
      cy.task('getInvitationToken', 'newuser@test.com').then((token) => {
        cy.visit(`/confirm-signup?token=${token}`)
        cy.get('[data-cy="email-input"]').type('newuser@test.com')
        cy.get('[data-cy="submit-email"]').click()
        cy.get('[data-cy="proceed-confirmation"]').click()
        
        // Set password
        cy.get('[data-cy="password"]').type('newpassword123')
        cy.get('[data-cy="confirm-password"]').type('newpassword123')
        cy.get('[data-cy="complete-registration"]').click()
        
        // Should redirect to mailroom
        cy.url().should('include', '/test-org/test-mailroom')
      })
    })
  })