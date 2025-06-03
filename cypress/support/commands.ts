// cypress/support/commands.ts

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<Element>
      createTestUser(role?: string): Chainable<Element>
      cleanupTestData(): Chainable<Element>
      seedTestData(): Chainable<Element>
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

Cypress.Commands.add('login', (email: string, password: string) => {
  cy.session([email, password], () => {
    cy.visit('/login')
    cy.get('[name="email"]').type(email)
    cy.get('[name="password"]').type(password)
    cy.get('button[type="submit"]').click()
    cy.url().should('not.include', '/login')
  })
})

Cypress.Commands.add('createTestUser', (role = 'user') => {
  return cy.task('createUser', { role })
})

Cypress.Commands.add('seedTestData', () => {
  return cy.task('seedDatabase')
})

Cypress.Commands.add('cleanupTestData', () => {
  return cy.task('cleanupDatabase')
})

// Export to make this file a module
export {}