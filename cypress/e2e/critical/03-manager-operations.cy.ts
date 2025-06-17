/**
 * Manager Operations E2E Test
 * 
 * Critical user journey: Manager performs complete workflow including:
 * - Roster upload and validation
 * - User management and invitation
 * - Settings configuration and email templates
 * 
 * This test validates the complete manager workflow from login to settings management
 */

describe('Manager Operations E2E - Complete Workflow', () => {
  const orgSlug = 'test-university'
  const mailroomSlug = 'residence-hall-a'
  
  const managerUser = {
    email: 'manager@test.edu',
    password: 'TestPassword123!',
    name: 'Test Manager',
    role: 'manager'
  }

  beforeEach(() => {
    // Reset database state for test isolation
    cy.task('db:reset')
    
    // Seed test organization and mailroom
    cy.task('db:seed', {
      organization: {
        name: 'Test University',
        slug: orgSlug
      },
      mailroom: {
        name: 'Residence Hall A',
        slug: mailroomSlug,
        organization_slug: orgSlug
      },
      manager: managerUser
    })
  })

  it('should complete full manager workflow: roster → users → settings', () => {
    // Step 1: Manager Login
    cy.visit(`/${orgSlug}/${mailroomSlug}`)
    
    // Should redirect to login since not authenticated
    cy.url().should('include', '/login')
    
    // Login as manager
    cy.get('[data-cy="email-input"]').type(managerUser.email)
    cy.get('[data-cy="password-input"]').type(managerUser.password)
    cy.get('[data-cy="login-button"]').click()
    
    // Should redirect to mailroom dashboard
    cy.url().should('include', `/${orgSlug}/${mailroomSlug}`)
    cy.get('[data-cy="page-title"]').should('contain', 'Residence Hall A')
    
    // Step 2: Navigate to Roster Management
    cy.get('[data-cy="roster-tab"]').click()
    cy.url().should('include', '/roster')
    cy.get('[data-cy="roster-page-title"]').should('contain', 'Manage Roster')
    
    // Step 3: Upload Roster File
    // Create test CSV file data
    const csvContent = `first_name,last_name,resident_id,email
John,Doe,STU001,john.doe@test.edu
Jane,Smith,STU002,jane.smith@test.edu
Bob,Johnson,STU003,bob.johnson@test.edu
Alice,Brown,STU004,alice.brown@test.edu`
    
    // Upload roster file
    cy.get('[data-cy="upload-roster-button"]').click()
    
    // Handle upload warning modal
    cy.get('[data-cy="upload-warning-modal"]').should('be.visible')
    cy.get('[data-cy="upload-warning-modal"]').should('contain', 'Replace All Residents')
    cy.get('[data-cy="confirm-upload-button"]').click()
    
    // Select file for upload
    cy.fixture('test-roster.csv').then(() => {
      // Create the fixture file with our CSV content
      cy.writeFile('cypress/fixtures/test-roster.csv', csvContent)
      
      cy.get('[data-cy="file-input"]').selectFile('cypress/fixtures/test-roster.csv')
    })
    
    // Verify file processing
    cy.get('[data-cy="upload-progress"]').should('be.visible')
    cy.get('[data-cy="upload-progress"]').should('contain', 'Processing')
    
    // Confirm upload in final confirmation modal
    cy.get('[data-cy="upload-confirmation-modal"]').should('be.visible')
    cy.get('[data-cy="upload-confirmation-modal"]').should('contain', '4 residents')
    cy.get('[data-cy="confirm-final-upload"]').click()
    
    // Verify upload success
    cy.get('[data-cy="upload-success-message"]').should('be.visible')
    cy.get('[data-cy="upload-success-message"]').should('contain', 'Upload successful')
    
    // Verify residents appear in the table
    cy.get('[data-cy="residents-table"]').should('be.visible')
    cy.get('[data-cy="residents-table"] tbody tr').should('have.length', 4)
    cy.get('[data-cy="residents-table"]').should('contain', 'John Doe')
    cy.get('[data-cy="residents-table"]').should('contain', 'Jane Smith')
    cy.get('[data-cy="residents-table"]').should('contain', 'Bob Johnson')
    cy.get('[data-cy="residents-table"]').should('contain', 'Alice Brown')
    
    // Step 4: Add Individual Resident
    cy.get('[data-cy="add-resident-button"]').click()
    
    // Fill add resident form
    cy.get('[data-cy="add-resident-modal"]').should('be.visible')
    cy.get('[data-cy="first-name-input"]').type('Charlie')
    cy.get('[data-cy="last-name-input"]').type('Wilson')
    cy.get('[data-cy="resident-id-input"]').type('STU005')
    cy.get('[data-cy="email-input"]').type('charlie.wilson@test.edu')
    cy.get('[data-cy="submit-resident-button"]').click()
    
    // Verify new resident added
    cy.get('[data-cy="add-resident-success"]').should('be.visible')
    cy.get('[data-cy="residents-table"] tbody tr').should('have.length', 5)
    cy.get('[data-cy="residents-table"]').should('contain', 'Charlie Wilson')
    
    // Close add resident modal
    cy.get('[data-cy="close-add-resident-modal"]').click()
    
    // Step 5: Navigate to User Management
    cy.get('[data-cy="users-tab"]').click()
    cy.url().should('include', '/users')
    cy.get('[data-cy="users-page-title"]').should('contain', 'Manage Users')
    
    // Step 6: Invite New User
    cy.get('[data-cy="invite-user-button"]').click()
    
    // Fill invitation form
    cy.get('[data-cy="invite-modal"]').should('be.visible')
    cy.get('[data-cy="invite-email-input"]').type('newstaff@test.edu')
    cy.get('[data-cy="invite-role-select"]').select('user')
    cy.get('[data-cy="send-invitation-button"]').click()
    
    // Verify invitation sent
    cy.get('[data-cy="invitation-success"]').should('be.visible')
    cy.get('[data-cy="invitation-success"]').should('contain', 'Invitation sent')
    
    // Verify invitation appears in pending list
    cy.get('[data-cy="pending-invitations"]').should('contain', 'newstaff@test.edu')
    
    // Step 7: Navigate to Settings
    cy.get('[data-cy="settings-tab"]').click()
    cy.url().should('include', '/settings')
    cy.get('[data-cy="settings-page-title"]').should('contain', 'Mailroom Settings')
    
    // Step 8: Configure Email Settings
    cy.get('[data-cy="email-settings-section"]').should('be.visible')
    
    // Update email template
    cy.get('[data-cy="email-template-textarea"]').clear()
    cy.get('[data-cy="email-template-textarea"]').type(
      'Dear {first_name}, you have a package waiting for pickup. Please bring your student ID. Hours: Mon-Fri 9AM-5PM.'
    )
    
    // Save email settings
    cy.get('[data-cy="save-email-settings"]').click()
    cy.get('[data-cy="email-settings-success"]').should('be.visible')
    cy.get('[data-cy="email-settings-success"]').should('contain', 'Email settings updated')
    
    // Step 9: Configure Pickup Settings
    cy.get('[data-cy="pickup-settings-section"]').should('be.visible')
    
    // Change pickup option
    cy.get('[data-cy="pickup-option-select"]').select('resident_id')
    
    // Update mailroom hours
    cy.get('[data-cy="monday-open"]').clear().type('08:00')
    cy.get('[data-cy="monday-close"]').clear().type('18:00')
    cy.get('[data-cy="friday-open"]').clear().type('08:00')
    cy.get('[data-cy="friday-close"]').clear().type('16:00')
    
    // Save pickup settings
    cy.get('[data-cy="save-pickup-settings"]').click()
    cy.get('[data-cy="pickup-settings-success"]').should('be.visible')
    cy.get('[data-cy="pickup-settings-success"]').should('contain', 'Pickup settings updated')
    
    // Step 10: View Updated Settings
    // Verify all settings were saved correctly
    cy.reload()
    
    // Check email template persisted
    cy.get('[data-cy="email-template-textarea"]').should('contain', 'Dear {first_name}')
    cy.get('[data-cy="email-template-textarea"]').should('contain', 'Mon-Fri 9AM-5PM')
    
    // Check pickup settings persisted
    cy.get('[data-cy="pickup-option-select"]').should('have.value', 'resident_id')
    cy.get('[data-cy="monday-open"]').should('have.value', '08:00')
    cy.get('[data-cy="friday-close"]').should('have.value', '16:00')
    
    // Step 11: Navigate back to Overview to verify complete workflow
    cy.get('[data-cy="overview-tab"]').click()
    cy.url().should('include', `/${orgSlug}/${mailroomSlug}`)
    
    // Verify overview stats reflect our changes
    cy.get('[data-cy="total-residents-stat"]').should('contain', '5') // 4 uploaded + 1 added
    cy.get('[data-cy="pending-invitations-stat"]').should('contain', '1') // 1 invitation sent
    
    // Final verification: Logout works
    cy.get('[data-cy="user-menu"]').click()
    cy.get('[data-cy="logout-button"]').click()
    
    // Should redirect to login page
    cy.url().should('include', '/login')
    cy.get('[data-cy="login-form"]').should('be.visible')
  })

  it('should handle error scenarios gracefully', () => {
    // Login as manager
    cy.visit(`/${orgSlug}/${mailroomSlug}`)
    cy.url().should('include', '/login')
    
    cy.get('[data-cy="email-input"]').type(managerUser.email)
    cy.get('[data-cy="password-input"]').type(managerUser.password)
    cy.get('[data-cy="login-button"]').click()
    
    // Test roster upload with invalid file
    cy.get('[data-cy="roster-tab"]').click()
    cy.get('[data-cy="upload-roster-button"]').click()
    cy.get('[data-cy="confirm-upload-button"]').click()
    
    // Upload invalid file format
    cy.writeFile('cypress/fixtures/invalid-roster.txt', 'This is not a CSV file')
    cy.get('[data-cy="file-input"]').selectFile('cypress/fixtures/invalid-roster.txt')
    
    // Should show error for invalid file type
    cy.get('[data-cy="file-error"]').should('be.visible')
    cy.get('[data-cy="file-error"]').should('contain', 'Invalid file type')
    
    // Test user invitation with invalid email
    cy.get('[data-cy="users-tab"]').click()
    cy.get('[data-cy="invite-user-button"]').click()
    
    cy.get('[data-cy="invite-email-input"]').type('invalid-email')
    cy.get('[data-cy="send-invitation-button"]').click()
    
    // Should show validation error
    cy.get('[data-cy="email-validation-error"]').should('be.visible')
    cy.get('[data-cy="email-validation-error"]').should('contain', 'Valid email required')
    
    // Test settings with empty required fields
    cy.get('[data-cy="settings-tab"]').click()
    
    cy.get('[data-cy="email-template-textarea"]').clear()
    cy.get('[data-cy="save-email-settings"]').click()
    
    // Should show validation error
    cy.get('[data-cy="email-template-error"]').should('be.visible')
    cy.get('[data-cy="email-template-error"]').should('contain', 'Email template cannot be empty')
  })

  it('should maintain data consistency across tabs', () => {
    // Login as manager
    cy.visit(`/${orgSlug}/${mailroomSlug}`)
    cy.url().should('include', '/login')
    
    cy.get('[data-cy="email-input"]').type(managerUser.email)
    cy.get('[data-cy="password-input"]').type(managerUser.password)
    cy.get('[data-cy="login-button"]').click()
    
    // Add a resident in roster tab
    cy.get('[data-cy="roster-tab"]').click()
    cy.get('[data-cy="add-resident-button"]').click()
    
    cy.get('[data-cy="first-name-input"]').type('Test')
    cy.get('[data-cy="last-name-input"]').type('Resident')
    cy.get('[data-cy="resident-id-input"]').type('STU999')
    cy.get('[data-cy="email-input"]').type('test.resident@test.edu')
    cy.get('[data-cy="submit-resident-button"]').click()
    
    cy.get('[data-cy="add-resident-success"]').should('be.visible')
    
    // Navigate to overview and verify count updated
    cy.get('[data-cy="overview-tab"]').click()
    cy.get('[data-cy="total-residents-stat"]').should('contain', '1')
    
    // Navigate back to roster and verify resident is still there
    cy.get('[data-cy="roster-tab"]').click()
    cy.get('[data-cy="residents-table"]').should('contain', 'Test Resident')
    
    // Update settings
    cy.get('[data-cy="settings-tab"]').click()
    cy.get('[data-cy="email-template-textarea"]').clear().type('Custom template message')
    cy.get('[data-cy="save-email-settings"]').click()
    cy.get('[data-cy="email-settings-success"]').should('be.visible')
    
    // Navigate away and back to verify persistence
    cy.get('[data-cy="overview-tab"]').click()
    cy.get('[data-cy="settings-tab"]').click()
    cy.get('[data-cy="email-template-textarea"]').should('contain', 'Custom template message')
  })
})