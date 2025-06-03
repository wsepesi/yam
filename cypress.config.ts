// cypress.config.ts
import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    video: false,
    screenshotOnRunFailure: true,
    setupNodeEvents(on) {
      // Register tasks for database operations
      on('task', {
        seedDatabase() {
          // TODO: Implement database seeding logic for local Supabase
          // This should create test organizations, mailrooms, and users
          // Required for e2e tests to work properly
          console.log('Seeding database...')
          return null
        },
        cleanupDatabase() {
          // TODO: Implement database cleanup logic for local Supabase
          // This should reset test data between test runs
          console.log('Cleaning up database...')
          return null
        },
        createUser({ role = 'user' }) {
          // TODO: Implement user creation logic for local Supabase
          // This should create authenticated users with proper roles
          console.log(`Creating user with role: ${role}`)
          return { id: 'test-user-id', email: 'test@example.com' }
        },
        getInvitationToken(email) {
          // TODO: Implement invitation token retrieval logic
          // This should generate/retrieve valid invitation tokens
          console.log(`Getting invitation token for: ${email}`)
          return 'test-invitation-token'
        }
      })
    },
    env: {
      supabase_url: process.env.CYPRESS_SUPABASE_URL || 'http://localhost:54321',
      supabase_anon_key: process.env.CYPRESS_SUPABASE_ANON_KEY,
      supabase_service_role_key: process.env.CYPRESS_SUPABASE_SERVICE_ROLE_KEY
    }
  },
  component: {
    devServer: {
      framework: 'next',
      bundler: 'webpack'
    },
    supportFile: 'cypress/support/component.ts',
    specPattern: 'cypress/component/**/*.cy.{js,jsx,ts,tsx}'
  }
})