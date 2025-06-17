// cypress/e2e/performance/real-user-performance.cy.ts
describe('Real User Performance E2E Monitoring', () => {
  let performanceMetrics: any[] = []

  beforeEach(() => {
    // Clean up test data
    cy.cleanupTestData()
    
    // Seed test data for performance testing
    cy.seedTestData()
    
    // Create and login user
    cy.createTestUser('manager').then((user: any) => {
      cy.login(user.email, user.password)
    })

    // Clear performance metrics
    performanceMetrics = []

    // Start performance monitoring
    cy.window().then((win) => {
      // Override console.log to capture performance metrics
      const originalLog = win.console.log
      win.console.log = (...args: any[]) => {
        if (args[0] && typeof args[0] === 'string' && args[0].includes('PERF:')) {
          performanceMetrics.push({
            timestamp: Date.now(),
            metric: args[0],
            data: args[1]
          })
        }
        return originalLog.apply(win.console, args)
      }

      // Add performance observer
      if ('PerformanceObserver' in win) {
        const observer = new win.PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            performanceMetrics.push({
              timestamp: Date.now(),
              type: 'performance-entry',
              name: entry.name,
              duration: entry.duration,
              startTime: entry.startTime,
              entryType: entry.entryType
            })
          })
        })
        observer.observe({ entryTypes: ['navigation', 'resource', 'measure', 'paint'] })
      }
    })
  })

  afterEach(() => {
    // Analyze performance metrics
    cy.then(() => {
      if (performanceMetrics.length > 0) {
        console.log('Performance metrics collected:', performanceMetrics.length)
        
        // Check for performance violations
        const slowOperations = performanceMetrics.filter(metric => 
          metric.duration && metric.duration > 1000 // Operations > 1 second
        )
        
        if (slowOperations.length > 0) {
          console.warn('Slow operations detected:', slowOperations)
        }
      }
    })

    cy.cleanupTestData()
  })

  describe('Page Load Performance', () => {
    it('should load main dashboard within performance budget', () => {
      const startTime = Date.now()
      
      cy.visit('/test-org/test-mailroom')
      
      // Wait for main content to load
      cy.get('[data-testid="overview-tab"]').should('be.visible')
      
      cy.then(() => {
        const loadTime = Date.now() - startTime
        expect(loadTime).to.be.lessThan(3000) // 3 second budget
      })

      // Check Largest Contentful Paint (LCP)
      cy.window().its('performance').then((performance) => {
        const paintEntries = performance.getEntriesByType('paint')
        const lcpEntry = paintEntries.find((entry: any) => entry.name === 'largest-contentful-paint')
        
        if (lcpEntry) {
          expect(lcpEntry.startTime).to.be.lessThan(2500) // 2.5 second LCP budget
        }
      })

      // Check First Contentful Paint (FCP)
      cy.window().its('performance').then((performance) => {
        const paintEntries = performance.getEntriesByType('paint')
        const fcpEntry = paintEntries.find((entry: any) => entry.name === 'first-contentful-paint')
        
        if (fcpEntry) {
          expect(fcpEntry.startTime).to.be.lessThan(1500) // 1.5 second FCP budget
        }
      })
    })

    it('should handle heavy data pages within performance budget', () => {
      cy.visit('/test-org/test-mailroom/manage-packages')
      
      const startTime = Date.now()
      
      // Wait for package table to load with data
      cy.get('[data-testid="package-table"]', { timeout: 10000 }).should('be.visible')
      cy.get('[data-testid="package-row"]').should('have.length.at.least', 10)
      
      cy.then(() => {
        const loadTime = Date.now() - startTime
        expect(loadTime).to.be.lessThan(5000) // 5 second budget for heavy data
      })

      // Check that virtual scrolling is working (not rendering all items at once)
      cy.get('[data-testid="package-row"]').should('have.length.at.most', 100)
      
      // Test scrolling performance
      cy.get('[data-testid="package-table"]').scrollTo('bottom')
      cy.get('[data-testid="package-row"]').should('be.visible')
      
      // Memory should not spike during scrolling
      cy.window().then((win) => {
        if ((win.performance as any).memory) {
          const memory = (win.performance as any).memory
          expect(memory.usedJSHeapSize).to.be.lessThan(50 * 1024 * 1024) // 50MB budget
        }
      })
    })

    it('should maintain performance during tab navigation', () => {
      cy.visit('/test-org/test-mailroom')
      
      const tabs = ['overview', 'register', 'pickup', 'manage-users', 'manage-packages']
      let totalNavigationTime = 0
      
      tabs.forEach((tab, index) => {
        const navStart = Date.now()
        
        if (tab === 'overview') {
          cy.visit('/test-org/test-mailroom')
        } else {
          cy.get('button').contains(tab.replace('-', ' ')).click()
        }
        
        // Wait for tab content to load
        cy.get(`[data-testid="${tab}-tab"]`, { timeout: 5000 }).should('be.visible')
        
        cy.then(() => {
          const navTime = Date.now() - navStart
          totalNavigationTime += navTime
          
          // Individual tab navigation should be fast
          expect(navTime).to.be.lessThan(2000) // 2 second per tab
        })
        
        // Check for memory leaks during navigation
        if (index > 0) {
          cy.window().then((win) => {
            if ((win.performance as any).memory) {
              const memory = (win.performance as any).memory
              // Memory shouldn't grow significantly with each navigation
              expect(memory.usedJSHeapSize).to.be.lessThan((index + 1) * 20 * 1024 * 1024) // 20MB per tab max
            }
          })
        }
      })
      
      cy.then(() => {
        const averageNavTime = totalNavigationTime / tabs.length
        expect(averageNavTime).to.be.lessThan(1500) // 1.5 second average
      })
    })
  })

  describe('Form Performance & User Interaction', () => {
    it('should handle package registration form with responsive feedback', () => {
      cy.visit('/test-org/test-mailroom/register')
      
      // Test autocomplete performance
      const searchStart = Date.now()
      cy.get('[data-testid="resident-search"]').type('John')
      
      // Autocomplete results should appear quickly
      cy.get('[data-testid="resident-option"]', { timeout: 1000 }).should('be.visible')
      
      cy.then(() => {
        const searchTime = Date.now() - searchStart
        expect(searchTime).to.be.lessThan(800) // 800ms for search results
      })

      // Test form submission performance
      cy.get('[data-testid="resident-option"]').first().click()
      cy.get('[data-testid="provider-select"]').select('UPS')
      
      const submitStart = Date.now()
      cy.get('[data-testid="register-submit"]').click()
      
      // Success feedback should be immediate
      cy.get('[data-testid="success-message"]', { timeout: 3000 }).should('be.visible')
      
      cy.then(() => {
        const submitTime = Date.now() - submitStart
        expect(submitTime).to.be.lessThan(2000) // 2 second submit budget
      })
    })

    it('should handle file upload with progress feedback', () => {
      cy.visit('/test-org/test-mailroom/manage-roster')
      
      // Test file upload performance
      cy.get('[data-testid="file-input"]').selectFile('cypress/fixtures/test-roster.csv')
      
      const uploadStart = Date.now()
      cy.get('[data-testid="upload-submit"]').click()
      
      // Progress indicator should appear quickly
      cy.get('[data-testid="upload-progress"]', { timeout: 500 }).should('be.visible')
      
      // Upload should complete within reasonable time
      cy.get('[data-testid="upload-success"]', { timeout: 10000 }).should('be.visible')
      
      cy.then(() => {
        const uploadTime = Date.now() - uploadStart
        expect(uploadTime).to.be.lessThan(8000) // 8 second budget for file upload
      })
    })

    it('should maintain responsive UI during bulk operations', () => {
      cy.visit('/test-org/test-mailroom/manage-packages')
      
      // Select multiple packages
      cy.get('[data-testid="package-checkbox"]').then($checkboxes => {
        const selectCount = Math.min($checkboxes.length, 10)
        for (let i = 0; i < selectCount; i++) {
          cy.wrap($checkboxes[i]).check()
        }
      })
      
      // Test bulk operation performance
      const bulkStart = Date.now()
      cy.get('[data-testid="bulk-action-select"]').select('Mark as Picked Up')
      cy.get('[data-testid="apply-bulk-action"]').click()
      
      // Confirmation dialog should appear quickly
      cy.get('[data-testid="bulk-confirm-dialog"]', { timeout: 1000 }).should('be.visible')
      cy.get('[data-testid="confirm-bulk-action"]').click()
      
      // Progress indicator for bulk operation
      cy.get('[data-testid="bulk-progress"]', { timeout: 1000 }).should('be.visible')
      
      // Bulk operation should complete
      cy.get('[data-testid="bulk-success"]', { timeout: 5000 }).should('be.visible')
      
      cy.then(() => {
        const bulkTime = Date.now() - bulkStart
        expect(bulkTime).to.be.lessThan(4000) // 4 second budget for bulk operations
      })
    })
  })

  describe('Memory Management & Resource Efficiency', () => {
    it('should not leak memory during extended session', () => {
      cy.visit('/test-org/test-mailroom')
      
      // Record initial memory usage
      cy.window().then((win) => {
        if ((win.performance as any).memory) {
          const initialMemory = (win.performance as any).memory.usedJSHeapSize
          
          // Simulate extended user session
          const navigationSequence = [
            'overview', 'register', 'pickup', 'manage-users', 
            'manage-packages', 'manage-roster', 'manage-settings'
          ]
          
          navigationSequence.forEach((tab, index) => {
            if (tab === 'overview') {
              cy.visit('/test-org/test-mailroom')
            } else {
              cy.get('button').contains(tab.replace('-', ' ')).click()
            }
            
            cy.get(`[data-testid="${tab}-tab"]`).should('be.visible')
            
            // Interact with the tab content
            cy.wait(500) // Simulate user reading/thinking time
            
            // Check memory after several navigations
            if (index > 3) {
              cy.window().then((laterWin) => {
                if ((laterWin.performance as any).memory) {
                  const currentMemory = (laterWin.performance as any).memory.usedJSHeapSize
                  const memoryGrowth = currentMemory - initialMemory
                  
                  // Memory growth should be reasonable
                  expect(memoryGrowth).to.be.lessThan(30 * 1024 * 1024) // 30MB max growth
                }
              })
            }
          })
        }
      })
    })

    it('should efficiently handle large datasets without blocking UI', () => {
      cy.visit('/test-org/test-mailroom/manage-packages')
      
      // Test that UI remains responsive while loading large datasets
      cy.get('[data-testid="package-table"]').should('be.visible')
      
      // Try to interact with UI while data is loading
      cy.get('[data-testid="search-packages"]').type('test')
      cy.get('[data-testid="filter-select"]').select('WAITING')
      
      // UI should remain responsive
      cy.get('[data-testid="search-packages"]').should('have.value', 'test')
      cy.get('[data-testid="filter-select"]').should('have.value', 'WAITING')
      
      // Check that virtual scrolling is working
      cy.get('[data-testid="package-row"]').should('have.length.at.most', 100)
      
      // Scroll performance test
      const scrollStart = Date.now()
      cy.get('[data-testid="package-table"]').scrollTo('bottom')
      cy.get('[data-testid="package-row"]').should('be.visible')
      
      cy.then(() => {
        const scrollTime = Date.now() - scrollStart
        expect(scrollTime).to.be.lessThan(1000) // Smooth scrolling
      })
    })

    it('should clean up resources when navigating away', () => {
      // Test cleanup when leaving heavy pages
      cy.visit('/test-org/test-mailroom/manage-packages')
      cy.get('[data-testid="package-table"]').should('be.visible')
      
      cy.window().then((win) => {
        if ((win.performance as any).memory) {
          const heavyPageMemory = (win.performance as any).memory.usedJSHeapSize
          
          // Navigate to lighter page
          cy.get('button').contains('overview').click()
          cy.get('[data-testid="overview-tab"]').should('be.visible')
          
          // Wait for cleanup
          cy.wait(1000)
          
          cy.window().then((laterWin) => {
            if ((laterWin.performance as any).memory) {
              const lightPageMemory = (laterWin.performance as any).memory.usedJSHeapSize
              
              // Memory should not have grown significantly
              const memoryDiff = lightPageMemory - heavyPageMemory
              expect(memoryDiff).to.be.lessThan(10 * 1024 * 1024) // 10MB max growth
            }
          })
        }
      })
    })
  })

  describe('Network Performance & Caching', () => {
    it('should implement efficient caching strategies', () => {
      cy.visit('/test-org/test-mailroom')
      
      // Record initial network requests
      cy.intercept('GET', '/api/**').as('apiRequests')
      
      cy.wait('@apiRequests')
      
      // Navigate to another tab and back
      cy.get('button').contains('register').click()
      cy.get('[data-testid="register-tab"]').should('be.visible')
      
      cy.get('button').contains('overview').click()
      cy.get('[data-testid="overview-tab"]').should('be.visible')
      
      // Check that cached data is used (fewer network requests)
      cy.get('@apiRequests.all').then((requests) => {
        expect(requests.length).to.be.lessThan(10) // Reasonable number of requests
      })
    })

    it('should handle network timeouts gracefully', () => {
      // Simulate slow network
      cy.intercept('GET', '/api/get-packages*', (req) => {
        req.reply((res) => {
          res.delay(5000) // 5 second delay
          res.send({ statusCode: 200, body: [] })
        })
      }).as('slowPackages')
      
      cy.visit('/test-org/test-mailroom/manage-packages')
      
      // Should show loading state
      cy.get('[data-testid="packages-loading"]').should('be.visible')
      
      // Should not block other UI interactions
      cy.get('button').contains('overview').should('be.enabled')
      cy.get('[data-testid="search-packages"]').should('be.enabled')
      
      // Eventually should show timeout or data
      cy.get('[data-testid="packages-loading"]', { timeout: 10000 }).should('not.exist')
    })

    it('should optimize API calls and reduce redundant requests', () => {
      let requestCount = 0
      
      cy.intercept('GET', '/api/**', (req) => {
        requestCount++
        req.continue()
      })
      
      cy.visit('/test-org/test-mailroom')
      
      // Navigate through several tabs
      const tabs = ['register', 'pickup', 'overview', 'manage-users']
      
      tabs.forEach(tab => {
        if (tab === 'overview') {
          cy.get('button').contains('overview').click()
        } else {
          cy.get('button').contains(tab.replace('-', ' ')).click()
        }
        cy.get(`[data-testid="${tab}-tab"]`).should('be.visible')
        cy.wait(500)
      })
      
      cy.then(() => {
        // Should not make excessive API calls
        expect(requestCount).to.be.lessThan(15) // Reasonable API call limit
      })
    })
  })

  describe('Performance Regression Detection', () => {
    it('should detect performance regressions in critical user flows', () => {
      // Complete user flow performance test
      const flowStart = Date.now()
      
      cy.visit('/test-org/test-mailroom')
      cy.get('[data-testid="overview-tab"]').should('be.visible')
      
      // Navigate to register package
      cy.get('button').contains('register').click()
      cy.get('[data-testid="register-tab"]').should('be.visible')
      
      // Register a package
      cy.get('[data-testid="resident-search"]').type('John Doe')
      cy.get('[data-testid="resident-option"]').first().click()
      cy.get('[data-testid="provider-select"]').select('UPS')
      cy.get('[data-testid="register-submit"]').click()
      cy.get('[data-testid="success-message"]').should('be.visible')
      
      // Navigate to manage packages
      cy.get('button').contains('manage packages').click()
      cy.get('[data-testid="manage-packages-tab"]').should('be.visible')
      
      // View package list
      cy.get('[data-testid="package-table"]').should('be.visible')
      
      cy.then(() => {
        const totalFlowTime = Date.now() - flowStart
        
        // Complete user flow should be under 10 seconds
        expect(totalFlowTime).to.be.lessThan(10000)
        
        // Log performance for regression tracking
        console.log(`PERF: Complete user flow time: ${totalFlowTime}ms`)
      })
    })

    it('should maintain performance standards under load', () => {
      // Simulate concurrent operations
      cy.visit('/test-org/test-mailroom/manage-packages')
      
      const operationStart = Date.now()
      
      // Perform multiple operations concurrently
      cy.get('[data-testid="search-packages"]').type('test')
      cy.get('[data-testid="filter-select"]').select('WAITING')
      cy.get('[data-testid="refresh-packages"]').click()
      
      // All operations should complete quickly
      cy.get('[data-testid="package-row"]').should('be.visible')
      
      cy.then(() => {
        const operationTime = Date.now() - operationStart
        expect(operationTime).to.be.lessThan(3000) // 3 second budget for concurrent ops
      })
    })
  })
})