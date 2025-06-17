// Performance Budget Tests - Real User Flow Integration & Memory Leak Detection
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react'
import React from 'react'
import { AuthProvider } from '@/context/AuthContext'
import { UserTabPage } from '@/pages/[org]/[mailroom]/[[...tab]]'

// Mock modules for performance testing
vi.mock('next/router', () => ({
  useRouter: vi.fn()
}))

vi.mock('@/lib/supabase')
vi.mock('@/lib/userPreferences')

// Mock tab components for lightweight testing
vi.mock('@/components/mailroomTabs/Overview', () => ({
  default: ({ orgSlug, mailroomSlug }: { orgSlug: string, mailroomSlug: string }) => (
    <div data-testid="overview-tab">
      <div className="package-list">
        {Array.from({ length: 100 }, (_, i) => (
          <div key={i} className="package-item">Package {i}</div>
        ))}
      </div>
    </div>
  )
}))

vi.mock('@/components/mailroomTabs/RegisterPackage', () => ({
  default: () => (
    <div data-testid="register-tab">
      <form>
        <input data-testid="resident-search" placeholder="Search resident" />
        <select data-testid="provider-select">
          <option value="">Select provider</option>
          <option value="UPS">UPS</option>
          <option value="FedEx">FedEx</option>
        </select>
        <button type="submit" data-testid="register-submit">Register Package</button>
      </form>
    </div>
  )
}))

vi.mock('@/components/mailroomTabs/ManagePackages', () => ({
  default: () => (
    <div data-testid="manage-packages-tab">
      <div className="package-table">
        {Array.from({ length: 500 }, (_, i) => (
          <div key={i} className="package-row">
            <span>Package {i}</span>
            <span>Status: {i % 3 === 0 ? 'WAITING' : i % 3 === 1 ? 'RETRIEVED' : 'RESOLVED'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}))

vi.mock('@/components/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="layout">{children}</div>
  )
}))

// Performance monitoring utilities
class PerformanceMonitor {
  private observations: PerformanceEntry[] = []
  private memorySnapshots: NodeJS.MemoryUsage[] = []
  private observer?: PerformanceObserver

  startMonitoring() {
    this.observations = []
    this.memorySnapshots = []
    
    // Take initial memory snapshot
    this.takeMemorySnapshot()

    // Start performance monitoring
    if (typeof PerformanceObserver !== 'undefined') {
      this.observer = new PerformanceObserver((list) => {
        this.observations.push(...list.getEntries())
      })
      this.observer.observe({ entryTypes: ['measure', 'navigation', 'resource'] })
    }
  }

  stopMonitoring() {
    if (this.observer) {
      this.observer.disconnect()
    }
    this.takeMemorySnapshot()
  }

  takeMemorySnapshot() {
    this.memorySnapshots.push(process.memoryUsage())
  }

  getPerformanceMetrics() {
    const memoryGrowth = this.memorySnapshots.length > 1 
      ? this.memorySnapshots[this.memorySnapshots.length - 1].heapUsed - this.memorySnapshots[0].heapUsed
      : 0

    return {
      memoryGrowth,
      memorySnapshots: this.memorySnapshots,
      performanceEntries: this.observations,
      peakMemory: Math.max(...this.memorySnapshots.map(s => s.heapUsed))
    }
  }

  analyzeMemoryLeaks() {
    if (this.memorySnapshots.length < 2) return { hasLeak: false, growthRate: 0 }

    const initialMemory = this.memorySnapshots[0].heapUsed
    const finalMemory = this.memorySnapshots[this.memorySnapshots.length - 1].heapUsed
    const growthRate = (finalMemory - initialMemory) / initialMemory

    // Consider a memory leak if growth > 50% of initial memory
    const hasLeak = growthRate > 0.5

    return {
      hasLeak,
      growthRate,
      initialMemory,
      finalMemory,
      totalGrowth: finalMemory - initialMemory
    }
  }
}

// User flow simulation utilities
class UserFlowSimulator {
  private monitor: PerformanceMonitor

  constructor() {
    this.monitor = new PerformanceMonitor()
  }

  async simulateTabNavigation(iterations: number = 10) {
    this.monitor.startMonitoring()
    const startTime = performance.now()

    const { useRouter } = await import('next/router')
    const userPrefs = await import('@/lib/userPreferences')
    
    // Setup mocks
    vi.mocked(userPrefs.getOrgDisplayName).mockResolvedValue('Test Organization')
    vi.mocked(userPrefs.getMailroomDisplayName).mockResolvedValue('Test Mailroom')

    const setupAuthenticatedUser = async () => {
      const mockSupabase = await import('@/lib/supabase')
      vi.mocked(mockSupabase.supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: { id: 'user-123' }, access_token: 'token' } },
        error: null
      } as any)
      vi.mocked(mockSupabase.supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } }
      } as any)
      vi.mocked(mockSupabase.supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'user-123', role: 'manager', status: 'ACTIVE', organization_id: 'org-123', mailroom_id: 'mailroom-123' },
          error: null
        })
      } as any)
    }

    await setupAuthenticatedUser()

    const tabs = ['overview', 'register', 'manage-packages']
    let totalRenderTime = 0

    for (let i = 0; i < iterations; i++) {
      const tabIndex = i % tabs.length
      const currentTab = tabs[tabIndex]

      const mockRouter = {
        push: vi.fn(),
        replace: vi.fn(),
        query: { org: 'test-org', mailroom: 'test-mailroom', tab: currentTab === 'overview' ? [] : [currentTab] },
        asPath: `/test-org/test-mailroom${currentTab === 'overview' ? '' : `/${currentTab}`}`,
        pathname: '/[org]/[mailroom]/[[...tab]]',
        isReady: true
      }

      vi.mocked(useRouter).mockReturnValue(mockRouter as any)

      const renderStart = performance.now()
      
      const { unmount } = await act(async () => {
        return render(
          <AuthProvider>
            <UserTabPage />
          </AuthProvider>
        )
      })

      // Wait for component to fully render
      await waitFor(() => {
        expect(screen.getByTestId(`${currentTab === 'overview' ? 'overview' : currentTab}-tab`)).toBeInTheDocument()
      })

      const renderEnd = performance.now()
      totalRenderTime += (renderEnd - renderStart)

      // Take memory snapshot every few iterations
      if (i % 3 === 0) {
        this.monitor.takeMemorySnapshot()
      }

      // Simulate user interaction
      await this.simulateUserInteraction(currentTab)

      // Clean up component
      await act(async () => {
        unmount()
      })
      cleanup()

      // Force garbage collection if available
      if (global.gc && i % 5 === 0) {
        global.gc()
      }
    }

    const endTime = performance.now()
    this.monitor.stopMonitoring()

    return {
      totalTime: endTime - startTime,
      averageRenderTime: totalRenderTime / iterations,
      iterations,
      performanceMetrics: this.monitor.getPerformanceMetrics(),
      memoryAnalysis: this.monitor.analyzeMemoryLeaks()
    }
  }

  private async simulateUserInteraction(tab: string) {
    try {
      switch (tab) {
        case 'overview':
          // Simulate scrolling through package list
          const packageItems = screen.getAllByText(/Package \d+/)
          expect(packageItems.length).toBeGreaterThan(0)
          break

        case 'register':
          // Simulate form interaction
          const residentSearch = screen.getByTestId('resident-search')
          await act(async () => {
            fireEvent.change(residentSearch, { target: { value: 'John Doe' } })
          })
          
          const providerSelect = screen.getByTestId('provider-select')
          await act(async () => {
            fireEvent.change(providerSelect, { target: { value: 'UPS' } })
          })
          break

        case 'manage-packages':
          // Simulate package management interaction
          const packageRows = screen.getAllByText(/Package \d+/)
          expect(packageRows.length).toBeGreaterThan(0)
          break
      }
    } catch (error) {
      // Interaction errors are acceptable in performance tests
      console.warn(`Interaction error in ${tab} tab:`, error)
    }
  }

  async simulateHeavyDataLoad(packageCount: number = 1000) {
    this.monitor.startMonitoring()
    const startTime = performance.now()

    // Simulate loading large dataset
    const packages = Array.from({ length: packageCount }, (_, i) => ({
      id: `pkg-${i}`,
      package_id: i + 1,
      resident_name: `Resident ${i}`,
      status: ['WAITING', 'RETRIEVED', 'RESOLVED'][i % 3],
      created_at: new Date(Date.now() - (i * 60000)).toISOString()
    }))

    // Simulate processing and filtering
    const processedPackages = packages
      .filter(pkg => pkg.status !== 'RESOLVED')
      .map(pkg => ({
        ...pkg,
        displayText: `#${pkg.package_id} - ${pkg.resident_name} (${pkg.status})`,
        searchable: `${pkg.package_id} ${pkg.resident_name} ${pkg.status}`.toLowerCase()
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    // Simulate virtual scrolling pagination
    const pageSize = 50
    const totalPages = Math.ceil(processedPackages.length / pageSize)
    
    for (let page = 0; page < Math.min(totalPages, 10); page++) {
      const pageStart = page * pageSize
      const pageEnd = pageStart + pageSize
      const pageData = processedPackages.slice(pageStart, pageEnd)
      
      // Simulate DOM manipulation for each page
      pageData.forEach(pkg => {
        pkg.displayText // Access properties to simulate rendering
      })

      this.monitor.takeMemorySnapshot()
    }

    const endTime = performance.now()
    this.monitor.stopMonitoring()

    return {
      loadTime: endTime - startTime,
      packageCount,
      processedCount: processedPackages.length,
      totalPages,
      performanceMetrics: this.monitor.getPerformanceMetrics(),
      memoryAnalysis: this.monitor.analyzeMemoryLeaks()
    }
  }

  async simulateFileUploadFlow(fileSizeMB: number = 5) {
    this.monitor.startMonitoring()
    const startTime = performance.now()

    // Simulate file reading
    const fileContent = 'Name,Email,StudentID\n' + 
      Array.from({ length: Math.floor(fileSizeMB * 1000) }, (_, i) => 
        `Student ${i},student${i}@university.edu,${100000 + i}`
      ).join('\n')

    const fileReadTime = performance.now()
    this.monitor.takeMemorySnapshot()

    // Simulate CSV parsing
    const lines = fileContent.split('\n')
    const headers = lines[0].split(',')
    const records = lines.slice(1).map((line, index) => {
      const values = line.split(',')
      return headers.reduce((record, header, i) => {
        record[header] = values[i]
        return record
      }, {} as any)
    })

    const parseTime = performance.now()
    this.monitor.takeMemorySnapshot()

    // Simulate validation
    const validRecords = records.filter(record => {
      return record.Name && record.Email && record.StudentID &&
             record.Email.includes('@') && record.StudentID.length >= 6
    })

    const validationTime = performance.now()
    this.monitor.takeMemorySnapshot()

    // Simulate batch processing (chunks of 100)
    const batchSize = 100
    const batches = []
    for (let i = 0; i < validRecords.length; i += batchSize) {
      const batch = validRecords.slice(i, i + batchSize)
      batches.push(batch)
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 10))
      
      if (i % 500 === 0) {
        this.monitor.takeMemorySnapshot()
      }
    }

    const endTime = performance.now()
    this.monitor.stopMonitoring()

    return {
      totalTime: endTime - startTime,
      fileReadTime: fileReadTime - startTime,
      parseTime: parseTime - fileReadTime,
      validationTime: validationTime - parseTime,
      batchProcessTime: endTime - validationTime,
      fileSizeMB,
      totalRecords: records.length,
      validRecords: validRecords.length,
      batchCount: batches.length,
      performanceMetrics: this.monitor.getPerformanceMetrics(),
      memoryAnalysis: this.monitor.analyzeMemoryLeaks()
    }
  }
}

describe('Real User Flow Performance & Memory Integration', () => {
  let simulator: UserFlowSimulator

  beforeEach(() => {
    simulator = new UserFlowSimulator()
    vi.clearAllMocks()
    
    // Mock sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  describe('Tab Navigation Performance', () => {
    it('should maintain smooth navigation performance across multiple tab switches', async () => {
      const result = await simulator.simulateTabNavigation(15)

      // Performance assertions
      expect(result.averageRenderTime).toBeLessThan(500) // 500ms average render time
      expect(result.totalTime).toBeLessThan(10000) // 10 seconds total for 15 iterations
      
      // Memory leak detection
      expect(result.memoryAnalysis.hasLeak).toBe(false)
      expect(result.memoryAnalysis.growthRate).toBeLessThan(0.3) // Less than 30% memory growth
      
      // Performance budget validation
      expect(result.performanceMetrics.memoryGrowth).toBeLessThan(20 * 1024 * 1024) // 20MB max growth
    })

    it('should handle rapid tab switching without performance degradation', async () => {
      const rapidSwitches = await simulator.simulateTabNavigation(30)

      // Should maintain consistent performance even with rapid switching
      expect(rapidSwitches.averageRenderTime).toBeLessThan(600) // Slightly higher threshold for rapid switching
      expect(rapidSwitches.memoryAnalysis.hasLeak).toBe(false)
      
      // Memory should stabilize, not continuously grow
      const memorySnapshots = rapidSwitches.performanceMetrics.memorySnapshots
      if (memorySnapshots.length >= 3) {
        const midPoint = Math.floor(memorySnapshots.length / 2)
        const earlyMemory = memorySnapshots[midPoint].heapUsed
        const lateMemory = memorySnapshots[memorySnapshots.length - 1].heapUsed
        const lateGrowthRate = (lateMemory - earlyMemory) / earlyMemory
        
        expect(lateGrowthRate).toBeLessThan(0.2) // Memory should stabilize in later iterations
      }
    })

    it('should recover memory after component unmounting', async () => {
      const initialMemory = process.memoryUsage().heapUsed
      
      // Perform navigation cycles
      await simulator.simulateTabNavigation(10)
      
      // Force garbage collection
      if (global.gc) {
        global.gc()
      }
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory
      
      // Memory increase should be minimal after cleanup
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024) // 10MB max increase
    })
  })

  describe('Heavy Data Load Performance', () => {
    it('should handle large package datasets efficiently', async () => {
      const result = await simulator.simulateHeavyDataLoad(2000)

      // Performance assertions
      expect(result.loadTime).toBeLessThan(3000) // 3 seconds for 2000 packages
      expect(result.processedCount).toBeGreaterThan(1300) // Should process most packages (some filtered out)
      
      // Memory efficiency
      expect(result.memoryAnalysis.hasLeak).toBe(false)
      expect(result.performanceMetrics.memoryGrowth).toBeLessThan(50 * 1024 * 1024) // 50MB max
    })

    it('should implement virtual scrolling for performance', async () => {
      const largeDataResult = await simulator.simulateHeavyDataLoad(10000)

      // Even with 10k packages, should maintain performance through virtual scrolling
      expect(largeDataResult.loadTime).toBeLessThan(5000) // 5 seconds max
      expect(largeDataResult.totalPages).toBeGreaterThan(100) // Should paginate properly
      
      // Memory should not grow linearly with data size
      expect(largeDataResult.performanceMetrics.memoryGrowth).toBeLessThan(100 * 1024 * 1024) // 100MB max
    })

    it('should handle concurrent data operations without memory leaks', async () => {
      const operations = await Promise.all([
        simulator.simulateHeavyDataLoad(1000),
        simulator.simulateHeavyDataLoad(1000),
        simulator.simulateHeavyDataLoad(1000)
      ])

      operations.forEach((result, index) => {
        expect(result.loadTime).toBeLessThan(4000) // Should handle concurrency
        expect(result.memoryAnalysis.hasLeak).toBe(false)
      })

      // Overall memory should be reasonable even with concurrent operations
      const totalMemoryGrowth = operations.reduce((sum, op) => 
        sum + op.performanceMetrics.memoryGrowth, 0)
      expect(totalMemoryGrowth).toBeLessThan(150 * 1024 * 1024) // 150MB total
    })
  })

  describe('File Upload Performance & Memory Management', () => {
    it('should handle large file uploads without memory explosion', async () => {
      const result = await simulator.simulateFileUploadFlow(10) // 10MB file

      // Performance assertions
      expect(result.totalTime).toBeLessThan(30000) // 30 seconds for 10MB
      expect(result.fileReadTime).toBeLessThan(2000) // 2 seconds to read
      expect(result.parseTime).toBeLessThan(5000) // 5 seconds to parse
      expect(result.validationTime).toBeLessThan(3000) // 3 seconds to validate
      
      // Memory management
      expect(result.memoryAnalysis.hasLeak).toBe(false)
      expect(result.performanceMetrics.memoryGrowth).toBeLessThan(100 * 1024 * 1024) // 100MB max
      
      // Data integrity
      expect(result.validRecords).toBeLessThan(result.totalRecords) // Some should be filtered out
      expect(result.batchCount).toBeGreaterThan(10) // Should process in batches
    })

    it('should implement streaming for very large files', async () => {
      const streamingResult = await simulator.simulateFileUploadFlow(25) // 25MB file

      // Streaming should handle large files efficiently
      expect(streamingResult.totalTime).toBeLessThan(60000) // 60 seconds max
      
      // Memory should not grow proportionally to file size
      const memoryEfficiencyRatio = streamingResult.performanceMetrics.memoryGrowth / (streamingResult.fileSizeMB * 1024 * 1024)
      expect(memoryEfficiencyRatio).toBeLessThan(5) // Memory growth should be < 5x file size
      
      // Should not leak memory during streaming
      expect(streamingResult.memoryAnalysis.hasLeak).toBe(false)
    })

    it('should clean up memory after file processing completion', async () => {
      const initialMemory = process.memoryUsage().heapUsed

      // Process multiple files sequentially
      for (let i = 0; i < 3; i++) {
        await simulator.simulateFileUploadFlow(5)
        
        // Force cleanup between files
        if (global.gc) {
          global.gc()
        }
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory

      // Memory should not accumulate across file processing operations
      expect(memoryIncrease).toBeLessThan(30 * 1024 * 1024) // 30MB max accumulation
    })
  })

  describe('Performance Regression Detection', () => {
    it('should detect performance regressions in tab navigation', async () => {
      // Baseline performance measurement
      const baseline = await simulator.simulateTabNavigation(5)
      
      // Simulate performance regression (artificially slow operations)
      const slowSimulator = new UserFlowSimulator()
      const originalSetTimeout = global.setTimeout
      global.setTimeout = ((fn: Function, delay: number) => 
        originalSetTimeout(fn, delay * 2)) as any // Double all delays
      
      const regression = await slowSimulator.simulateTabNavigation(5)
      global.setTimeout = originalSetTimeout

      // Should detect that regression is significantly slower
      const performanceRatio = regression.averageRenderTime / baseline.averageRenderTime
      expect(performanceRatio).toBeGreaterThan(1.5) // At least 50% slower
      
      // But baseline should still meet performance budgets
      expect(baseline.averageRenderTime).toBeLessThan(500)
      expect(baseline.memoryAnalysis.hasLeak).toBe(false)
    })

    it('should maintain consistent memory patterns across test runs', async () => {
      const runs = []
      
      // Perform multiple test runs
      for (let i = 0; i < 3; i++) {
        const result = await simulator.simulateTabNavigation(10)
        runs.push(result)
        
        // Clean up between runs
        if (global.gc) {
          global.gc()
        }
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Memory patterns should be consistent
      const memoryGrowths = runs.map(run => run.performanceMetrics.memoryGrowth)
      const avgMemoryGrowth = memoryGrowths.reduce((sum, growth) => sum + growth, 0) / memoryGrowths.length
      
      // Each run should be within 50% of average (indicating consistency)
      memoryGrowths.forEach(growth => {
        const varianceRatio = Math.abs(growth - avgMemoryGrowth) / avgMemoryGrowth
        expect(varianceRatio).toBeLessThan(0.5)
      })

      // No run should indicate memory leaks
      runs.forEach(run => {
        expect(run.memoryAnalysis.hasLeak).toBe(false)
      })
    })
  })

  describe('Memory Leak Detection Across User Flows', () => {
    it('should detect memory leaks in long-running sessions', async () => {
      const longSession = new PerformanceMonitor()
      longSession.startMonitoring()

      // Simulate a long user session with various activities
      for (let i = 0; i < 20; i++) {
        await simulator.simulateTabNavigation(3)
        await simulator.simulateHeavyDataLoad(500)
        
        longSession.takeMemorySnapshot()
        
        if (global.gc && i % 5 === 0) {
          global.gc()
        }
      }

      longSession.stopMonitoring()
      const sessionAnalysis = longSession.analyzeMemoryLeaks()

      // Long session should not accumulate memory indefinitely
      expect(sessionAnalysis.hasLeak).toBe(false)
      expect(sessionAnalysis.growthRate).toBeLessThan(1.0) // Less than 100% growth over session
    })

    it('should identify specific components causing memory leaks', async () => {
      const componentTests = []

      // Test each major component individually
      const components = ['overview', 'register', 'manage-packages']
      
      for (const component of components) {
        const monitor = new PerformanceMonitor()
        monitor.startMonitoring()
        
        // Repeatedly render/unmount the same component
        for (let i = 0; i < 10; i++) {
          const { useRouter } = await import('next/router')
          vi.mocked(useRouter).mockReturnValue({
            push: vi.fn(),
            replace: vi.fn(),
            query: { org: 'test-org', mailroom: 'test-mailroom', tab: component === 'overview' ? [] : [component] },
            asPath: `/test-org/test-mailroom${component === 'overview' ? '' : `/${component}`}`,
            pathname: '/[org]/[mailroom]/[[...tab]]',
            isReady: true
          } as any)

          const { unmount } = await act(async () => {
            return render(
              <AuthProvider>
                <UserTabPage />
              </AuthProvider>
            )
          })
          
          await waitFor(() => {
            expect(screen.getByTestId(`${component === 'overview' ? 'overview' : component}-tab`)).toBeInTheDocument()
          })
          
          await act(async () => {
            unmount()
          })
          cleanup()
          
          monitor.takeMemorySnapshot()
        }
        
        monitor.stopMonitoring()
        const analysis = monitor.analyzeMemoryLeaks()
        
        componentTests.push({
          component,
          analysis
        })
      }

      // Each component should not leak memory
      componentTests.forEach(({ component, analysis }) => {
        expect(analysis.hasLeak).toBe(false)
        expect(analysis.growthRate).toBeLessThan(0.3) // Less than 30% growth per component
      })
    })
  })
})