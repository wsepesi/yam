import { createAdminClient } from '../../lib/supabase'
import { defineConfig } from 'cypress'

const supabaseAdmin = createAdminClient()

// cypress/plugins/index.ts
export default defineConfig({
    e2e: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      setupNodeEvents(on: Cypress.PluginEvents, _config: Cypress.PluginConfigOptions) {
        on('task', {
          async seedDatabase() {
            // Seed test data in Supabase
            const { error } = await supabaseAdmin
              .from('organizations')
              .upsert({ id: 'test-org', name: 'Test Org', slug: 'test-org' })
            
            if (error) throw error
            return null
          },
  
          async cleanupDatabase() {
            // Clean up test data
            const { error } = await supabaseAdmin
              .from('packages')
              .delete()
              .like('id', 'test-%')
            
            if (error) throw error
            return null
          },
  
          async createUser({ role = 'user' }) {
            // Create test user
            const { data, error } = await supabaseAdmin.auth.admin.createUser({
              email: `test-${Date.now()}@example.com`,
              password: 'password123',
              user_metadata: { role }
            })
            
            if (error) throw error
            return data.user
          },
  
          async getInvitationToken(email: string) {
            // Get invitation token for testing
            const { data, error } = await supabaseAdmin
              .from('invitations')
              .select('id')
              .eq('email', email)
              .single()
            
            if (error) throw error
            return data?.id
          }
        })
      }
    }
  })