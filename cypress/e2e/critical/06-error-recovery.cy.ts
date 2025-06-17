// cypress/e2e/critical/06-error-recovery.cy.ts
describe('Error Recovery E2E Critical Flow', () => {
  beforeEach(() => {
    // Clean up test data before each test
    cy.cleanupTestData()
    
    // Seed basic test data
    cy.seedTestData()
    
    // Create and login as manager for most tests
    cy.createTestUser('manager').then((user: any) => {
      cy.login(user.email, user.password)
      // Navigate to test mailroom
      cy.visit('/test-org/test-mailroom')
    })
  })

  afterEach(() => {
    // Clean up test data after each test
    cy.cleanupTestData()
  })

  describe('Network Timeout Recovery', () => {
    it('should handle package registration timeout gracefully', () => {
      cy.visit('/test-org/test-mailroom/register')
      
      // Intercept package registration API with timeout
      cy.intercept('POST', '/api/add-package', (req) => {
        req.reply((res) => {
          res.delay(30000) // 30 second delay to trigger timeout
          res.send({ statusCode: 200, body: { success: true, package: { id: 1 } } })
        })
      }).as('addPackageTimeout')
      
      // Fill out package registration form
      cy.get('[data-testid="resident-search"]').type('John Doe')
      cy.get('[data-testid="resident-option"]').first().click()
      cy.get('[data-testid="provider-select"]').select('UPS')
      cy.get('[data-testid="register-submit"]').click()
      
      // Should show loading state
      cy.get('[data-testid="loading-spinner"]').should('be.visible')
      
      // Should show timeout error after reasonable wait
      cy.get('[data-testid="error-message"]', { timeout: 20000 })
        .should('be.visible')
        .and('contain.text', 'timeout')
        .or('contain.text', 'took too long')
        .or('contain.text', 'network error')
      
      // Form should remain filled for retry
      cy.get('[data-testid="resident-search"]').should('contain.value', 'John Doe')
      cy.get('[data-testid="provider-select"]').should('have.value', 'UPS')
      
      // Retry button should be available
      cy.get('[data-testid="retry-button"]').should('be.visible').click()
      
      // Should attempt the request again
      cy.get('[data-testid="loading-spinner"]').should('be.visible')
    })

    it('should handle resident roster upload timeout', () => {
      cy.visit('/test-org/test-mailroom/manage-roster')
      
      // Intercept roster upload API with timeout
      cy.intercept('POST', '/api/upload-roster', (req) => {
        req.reply((res) => {
          res.delay(25000) // 25 second delay
          res.send({ statusCode: 200, body: { success: true, imported: 100 } })
        })
      }).as('uploadRosterTimeout')
      
      // Upload a test CSV file
      cy.get('[data-testid="file-input"]').selectFile('cypress/fixtures/test-roster.csv')
      cy.get('[data-testid="upload-submit"]').click()
      
      // Should show upload progress
      cy.get('[data-testid="upload-progress"]').should('be.visible')
      
      // Should show timeout error
      cy.get('[data-testid="error-message"]', { timeout: 20000 })
        .should('be.visible')
        .and('contain.text', 'timeout')
      
      // Should offer to retry upload
      cy.get('[data-testid="retry-upload"]').should('be.visible')
      
      // File should still be selected
      cy.get('[data-testid="file-input"]').should('contain.value', 'test-roster.csv')
    })

    it('should handle email notification service timeout', () => {
      cy.visit('/test-org/test-mailroom/register')
      
      // Intercept email notification API with timeout
      cy.intercept('POST', '/api/send-notification-email', (req) => {
        req.reply((res) => {
          res.delay(15000) // 15 second delay
          res.send({ statusCode: 200, body: { success: true } })
        })
      }).as('emailTimeout')
      
      // Register a package (which triggers email notification)
      cy.get('[data-testid="resident-search"]').type('Jane Smith')
      cy.get('[data-testid="resident-option"]').first().click()
      cy.get('[data-testid="provider-select"]').select('FedEx')
      cy.get('[data-testid="register-submit"]').click()
      
      // Package should be registered even if email fails
      cy.get('[data-testid="success-message"]')
        .should('contain', 'Package registered successfully')
      
      // Should show email notification warning
      cy.get('[data-testid="warning-message"]')
        .should('contain', 'email notification may be delayed')
        .or('contain', 'email service timeout')
    })

    it('should handle database connection timeout during data fetch', () => {
      // Intercept package list API with timeout
      cy.intercept('GET', '/api/get-packages*', (req) => {
        req.reply((res) => {
          res.delay(20000) // 20 second delay
          res.send({ statusCode: 200, body: [] })
        })
      }).as('getPackagesTimeout')
      
      cy.visit('/test-org/test-mailroom/manage-packages')
      
      // Should show loading state initially
      cy.get('[data-testid="packages-loading"]').should('be.visible')
      
      // Should show timeout error
      cy.get('[data-testid="error-message"]', { timeout: 15000 })
        .should('be.visible')
        .and('contain.text', 'failed to load')
        .or('contain.text', 'timeout')
      
      // Should offer refresh option
      cy.get('[data-testid="refresh-button"]').should('be.visible').click()
      
      // Should try to load again
      cy.get('[data-testid="packages-loading"]').should('be.visible')
    })
  })

  describe('Form Validation Error Recovery', () => {
    it('should handle invalid package registration and allow correction', () => {
      cy.visit('/test-org/test-mailroom/register')
      
      // Try to submit empty form
      cy.get('[data-testid="register-submit"]').click()
      
      // Should show validation errors
      cy.get('[data-testid="resident-error"]').should('contain', 'Resident is required')
      cy.get('[data-testid="provider-error"]').should('contain', 'Provider is required')
      
      // Form should remain in error state
      cy.get('[data-testid="resident-search"]').should('have.class', 'error')
      cy.get('[data-testid="provider-select"]').should('have.class', 'error')
      
      // Correct one field at a time
      cy.get('[data-testid="resident-search"]').type('John Doe')
      cy.get('[data-testid="resident-option"]').first().click()
      
      // Resident error should clear
      cy.get('[data-testid="resident-error"]').should('not.exist')
      cy.get('[data-testid="resident-search"]').should('not.have.class', 'error')
      
      // Provider error should still exist
      cy.get('[data-testid="provider-error"]').should('be.visible')
      
      // Complete the form
      cy.get('[data-testid="provider-select"]').select('UPS')
      
      // All errors should clear
      cy.get('[data-testid="provider-error"]').should('not.exist')
      cy.get('[data-testid="provider-select"]').should('not.have.class', 'error')
      
      // Should be able to submit successfully
      cy.get('[data-testid="register-submit"]').click()
      cy.get('[data-testid="success-message"]').should('be.visible')
    })

    it('should handle invalid resident creation and show specific errors', () => {
      cy.visit('/test-org/test-mailroom/manage-roster')
      
      // Click add resident manually
      cy.get('[data-testid="add-resident-button"]').click()
      
      // Try to submit with invalid data
      cy.get('[data-testid="resident-name"]').type('A') // Too short
      cy.get('[data-testid="resident-email"]').type('invalid-email') // Invalid format
      cy.get('[data-testid="student-id"]').type('') // Required field empty
      cy.get('[data-testid="submit-resident"]').click()
      
      // Should show specific validation errors
      cy.get('[data-testid="name-error"]').should('contain', 'Name must be at least 2 characters')
      cy.get('[data-testid="email-error"]').should('contain', 'Please enter a valid email address')
      cy.get('[data-testid="student-id-error"]').should('contain', 'Student ID is required')
      
      // Correct errors one by one
      cy.get('[data-testid="resident-name"]').clear().type('John Smith')
      cy.get('[data-testid="name-error"]').should('not.exist')
      
      cy.get('[data-testid="resident-email"]').clear().type('john.smith@university.edu')
      cy.get('[data-testid="email-error"]').should('not.exist')
      
      cy.get('[data-testid="student-id"]').type('12345678')
      cy.get('[data-testid="student-id-error"]').should('not.exist')
      
      // Should submit successfully
      cy.get('[data-testid="submit-resident"]').click()
      cy.get('[data-testid="success-message"]').should('be.visible')
    })

    it('should handle duplicate package registration gracefully', () => {
      cy.visit('/test-org/test-mailroom/register')
      
      // Register a package
      cy.get('[data-testid="resident-search"]').type('John Doe')
      cy.get('[data-testid="resident-option"]').first().click()
      cy.get('[data-testid="provider-select"]').select('UPS')
      cy.get('[data-testid="register-submit"]').click()
      cy.get('[data-testid="success-message"]').should('be.visible')
      
      // Try to register the same package again (if tracking number is used)
      cy.get('[data-testid="tracking-number"]').type('1Z999AA1234567890')
      cy.get('[data-testid="register-submit"]').click()
      
      // Should show duplicate error
      cy.get('[data-testid="error-message"]')
        .should('contain', 'already exists')
        .or('contain', 'duplicate')
      
      // Should offer options to resolve
      cy.get('[data-testid="view-existing"]').should('be.visible')
      cy.get('[data-testid="clear-form"]').should('be.visible')
      
      // Clear form should reset everything
      cy.get('[data-testid="clear-form"]').click()
      cy.get('[data-testid="resident-search"]').should('have.value', '')
      cy.get('[data-testid="tracking-number"]').should('have.value', '')
    })

    it('should handle invalid file upload and provide clear feedback', () => {
      cy.visit('/test-org/test-mailroom/manage-roster')
      
      // Try to upload an invalid file type
      cy.get('[data-testid="file-input"]').selectFile('cypress/fixtures/invalid-file.txt')
      
      // Should show file type error
      cy.get('[data-testid="file-error"]')
        .should('contain', 'Only CSV and Excel files are allowed')
      
      // Upload button should be disabled
      cy.get('[data-testid="upload-submit"]').should('be.disabled')
      
      // Try to upload a file that's too large
      cy.get('[data-testid="file-input"]').selectFile('cypress/fixtures/large-file.csv')
      
      // Should show size error
      cy.get('[data-testid="file-error"]')
        .should('contain', 'File size must be less than')
      
      // Try to upload a valid file with invalid content
      cy.get('[data-testid="file-input"]').selectFile('cypress/fixtures/invalid-roster.csv')
      cy.get('[data-testid="upload-submit"]').click()
      
      // Should show content validation errors
      cy.get('[data-testid="validation-results"]').should('be.visible')
      cy.get('[data-testid="invalid-rows"]').should('contain', 'rows with errors')
      
      // Should show specific row errors
      cy.get('[data-testid="row-error"]').should('have.length.at.least', 1)
      cy.get('[data-testid="row-error"]').first().should('contain', 'Missing required field')
      
      // Should offer to download error report
      cy.get('[data-testid="download-errors"]').should('be.visible')
      
      // Should offer to fix and retry
      cy.get('[data-testid="fix-and-retry"]').should('be.visible')
    })
  })

  describe('Session Expiry Recovery', () => {
    it('should handle session expiry during package registration', () => {
      cy.visit('/test-org/test-mailroom/register')
      
      // Intercept API calls to return 401 (unauthorized)
      cy.intercept('POST', '/api/add-package', {
        statusCode: 401,
        body: { error: 'Session expired' }
      }).as('sessionExpired')
      
      // Fill out and submit form
      cy.get('[data-testid="resident-search"]').type('John Doe')
      cy.get('[data-testid="resident-option"]').first().click()
      cy.get('[data-testid="provider-select"]').select('UPS')
      cy.get('[data-testid="register-submit"]').click()
      
      cy.wait('@sessionExpired')
      
      // Should show session expiry message
      cy.get('[data-testid="session-expired-modal"]').should('be.visible')
      cy.get('[data-testid="session-expired-message"]')
        .should('contain', 'Your session has expired')
      
      // Should offer to re-login
      cy.get('[data-testid="relogin-button"]').should('be.visible').click()
      
      // Should redirect to login with callback URL
      cy.url().should('include', '/login')
      cy.url().should('include', 'callbackUrl')
      cy.url().should('include', encodeURIComponent('/test-org/test-mailroom/register'))
    })

    it('should preserve form data during session expiry', () => {
      cy.visit('/test-org/test-mailroom/manage-roster')
      
      // Fill out add resident form
      cy.get('[data-testid="add-resident-button"]').click()
      cy.get('[data-testid="resident-name"]').type('Jane Smith')
      cy.get('[data-testid="resident-email"]').type('jane@university.edu')
      cy.get('[data-testid="student-id"]').type('87654321')
      
      // Intercept API to return session expired
      cy.intercept('POST', '/api/add-resident', {
        statusCode: 401,
        body: { error: 'Session expired' }
      }).as('sessionExpiredResident')
      
      cy.get('[data-testid="submit-resident"]').click()
      cy.wait('@sessionExpiredResident')
      
      // Should show session expiry with option to save data
      cy.get('[data-testid="session-expired-modal"]').should('be.visible')
      cy.get('[data-testid="save-form-data"]').should('be.visible').click()
      
      // Should save form data to localStorage
      cy.window().its('localStorage').invoke('getItem', 'unsaved-form-data')
        .should('contain', 'Jane Smith')
        .and('contain', 'jane@university.edu')
        .and('contain', '87654321')
      
      // After re-login, data should be restored
      cy.get('[data-testid="relogin-button"]').click()
      
      // Simulate successful re-login and return to form
      cy.login('manager@test.com', 'password123')
      cy.visit('/test-org/test-mailroom/manage-roster')
      
      // Should offer to restore saved data
      cy.get('[data-testid="restore-data-modal"]').should('be.visible')
      cy.get('[data-testid="restore-button"]').click()
      
      // Form should be populated with saved data
      cy.get('[data-testid="resident-name"]').should('have.value', 'Jane Smith')
      cy.get('[data-testid="resident-email"]').should('have.value', 'jane@university.edu')
      cy.get('[data-testid="student-id"]').should('have.value', '87654321')
    })

    it('should handle session expiry during file upload', () => {
      cy.visit('/test-org/test-mailroom/manage-roster')
      
      // Start file upload
      cy.get('[data-testid="file-input"]').selectFile('cypress/fixtures/test-roster.csv')
      
      // Intercept upload API to return session expired midway
      cy.intercept('POST', '/api/upload-roster', {
        statusCode: 401,
        body: { error: 'Session expired during upload' }
      }).as('uploadSessionExpired')
      
      cy.get('[data-testid="upload-submit"]').click()
      cy.wait('@uploadSessionExpired')
      
      // Should show session expired during upload message
      cy.get('[data-testid="upload-session-expired"]').should('be.visible')
      cy.get('[data-testid="upload-expired-message"]')
        .should('contain', 'session expired during upload')
      
      // Should offer to re-login and resume upload
      cy.get('[data-testid="resume-upload-button"]').should('be.visible')
      
      // File should still be selected
      cy.get('[data-testid="file-input"]').should('contain.value', 'test-roster.csv')
    })
  })

  describe('API Error Recovery', () => {
    it('should handle server errors gracefully', () => {
      cy.visit('/test-org/test-mailroom/manage-packages')
      
      // Intercept API to return 500 error
      cy.intercept('GET', '/api/get-packages*', {
        statusCode: 500,
        body: { error: 'Internal server error' }
      }).as('serverError')
      
      cy.visit('/test-org/test-mailroom/manage-packages')
      cy.wait('@serverError')
      
      // Should show user-friendly error message
      cy.get('[data-testid="error-message"]')
        .should('contain', 'Something went wrong')
        .and('not.contain', 'Internal server error') // Don't expose technical details
      
      // Should offer to try again
      cy.get('[data-testid="retry-button"]').should('be.visible')
      
      // Should offer to report the issue
      cy.get('[data-testid="report-issue"]').should('be.visible')
    })

    it('should handle partial failures during bulk operations', () => {
      cy.visit('/test-org/test-mailroom/manage-packages')
      
      // Select multiple packages for bulk operation
      cy.get('[data-testid="package-checkbox"]').first().check()
      cy.get('[data-testid="package-checkbox"]').eq(1).check()
      cy.get('[data-testid="package-checkbox"]').eq(2).check()
      
      // Intercept bulk operation to return partial success
      cy.intercept('POST', '/api/bulk-package-operation', {
        statusCode: 207, // Multi-status
        body: {
          success: 2,
          failed: 1,
          results: [
            { id: 1, status: 'success' },
            { id: 2, status: 'success' },
            { id: 3, status: 'failed', error: 'Package not found' }
          ]
        }
      }).as('partialSuccess')
      
      cy.get('[data-testid="bulk-action-select"]').select('Mark as Picked Up')
      cy.get('[data-testid="apply-bulk-action"]').click()
      
      cy.wait('@partialSuccess')
      
      // Should show partial success message
      cy.get('[data-testid="partial-success-message"]')
        .should('contain', '2 packages updated successfully')
        .and('contain', '1 package failed')
      
      // Should show details of failed operations
      cy.get('[data-testid="failed-operations"]').should('be.visible')
      cy.get('[data-testid="failed-item"]')
        .should('contain', 'Package not found')
      
      // Should offer to retry failed operations
      cy.get('[data-testid="retry-failed"]').should('be.visible')
    })

    it('should handle rate limiting gracefully', () => {
      cy.visit('/test-org/test-mailroom/register')
      
      // Intercept API to return rate limit error
      cy.intercept('POST', '/api/add-package', {
        statusCode: 429,
        body: { error: 'Rate limit exceeded', retryAfter: 60 }
      }).as('rateLimited')
      
      // Fill and submit form
      cy.get('[data-testid="resident-search"]').type('John Doe')
      cy.get('[data-testid="resident-option"]').first().click()
      cy.get('[data-testid="provider-select"]').select('UPS')
      cy.get('[data-testid="register-submit"]').click()
      
      cy.wait('@rateLimited')
      
      // Should show rate limit message
      cy.get('[data-testid="rate-limit-message"]')
        .should('contain', 'Too many requests')
        .and('contain', 'Please wait')
      
      // Submit button should be disabled temporarily
      cy.get('[data-testid="register-submit"]').should('be.disabled')
      
      // Should show countdown timer
      cy.get('[data-testid="retry-countdown"]').should('be.visible')
      
      // Form data should be preserved
      cy.get('[data-testid="resident-search"]').should('contain.value', 'John Doe')
      cy.get('[data-testid="provider-select"]').should('have.value', 'UPS')
    })
  })

  describe('Data Integrity Recovery', () => {
    it('should handle data conflicts during concurrent edits', () => {
      cy.visit('/test-org/test-mailroom/manage-roster')
      
      // Open edit dialog for a resident
      cy.get('[data-testid="resident-row"]').first().within(() => {
        cy.get('[data-testid="edit-resident"]').click()
      })
      
      // Make changes to resident data
      cy.get('[data-testid="resident-name"]').clear().type('Updated Name')
      cy.get('[data-testid="resident-email"]').clear().type('updated@email.com')
      
      // Intercept update API to return conflict error
      cy.intercept('PUT', '/api/residents/*', {
        statusCode: 409,
        body: { 
          error: 'Conflict: Data was modified by another user',
          currentData: {
            name: 'Different Name',
            email: 'different@email.com'
          }
        }
      }).as('dataConflict')
      
      cy.get('[data-testid="save-resident"]').click()
      cy.wait('@dataConflict')
      
      // Should show conflict resolution dialog
      cy.get('[data-testid="conflict-dialog"]').should('be.visible')
      cy.get('[data-testid="conflict-message"]')
        .should('contain', 'modified by another user')
      
      // Should show both versions of data
      cy.get('[data-testid="your-changes"]').should('contain', 'Updated Name')
      cy.get('[data-testid="current-data"]').should('contain', 'Different Name')
      
      // Should offer resolution options
      cy.get('[data-testid="keep-yours"]').should('be.visible')
      cy.get('[data-testid="keep-theirs"]').should('be.visible')
      cy.get('[data-testid="merge-changes"]').should('be.visible')
    })

    it('should handle orphaned data cleanup', () => {
      // This test simulates cleaning up packages without residents
      cy.visit('/test-org/test-mailroom/manage-packages')
      
      // Should detect orphaned packages
      cy.get('[data-testid="orphaned-packages-alert"]').should('be.visible')
      cy.get('[data-testid="orphaned-count"]').should('contain.text', /\d+/)
      
      // Should offer to clean up orphaned data
      cy.get('[data-testid="cleanup-orphaned"]').click()
      
      // Should show cleanup confirmation
      cy.get('[data-testid="cleanup-confirmation"]').should('be.visible')
      cy.get('[data-testid="cleanup-details"]')
        .should('contain', 'packages will be archived')
      
      cy.get('[data-testid="confirm-cleanup"]').click()
      
      // Should show cleanup progress
      cy.get('[data-testid="cleanup-progress"]').should('be.visible')
      
      // Should show cleanup results
      cy.get('[data-testid="cleanup-success"]', { timeout: 10000 })
        .should('contain', 'cleanup completed')
      
      // Alert should disappear
      cy.get('[data-testid="orphaned-packages-alert"]').should('not.exist')
    })
  })
})