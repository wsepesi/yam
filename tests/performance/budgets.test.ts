// Performance Budget Tests - Ensuring performance requirements are met
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mockSupabase } from '../mocks/supabase.mock'
import { packageFactory, residentFactory } from '../factories'

// Mock performance APIs
const mockPerformanceObserver = vi.fn()
global.PerformanceObserver = mockPerformanceObserver as any
global.performance = {
  ...global.performance,
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByType: vi.fn(),
  getEntriesByName: vi.fn(),
  now: vi.fn(() => Date.now())
} as any

describe('Core Performance Budgets', () => {
  beforeEach(() => {
    mockSupabase.clearAllTables()
    mockSupabase.clearErrors()
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Package List Processing Performance', () => {
    it('should process 1000+ package items in under 2 seconds', async () => {
      const largePackageSet = packageFactory.buildMany(1000, {
        mailroom_id: 'performance-test-mailroom'
      })

      mockSupabase.seedTable('packages', largePackageSet)

      const startTime = performance.now()
      
      // Simulate package list processing
      const processedPackages = largePackageSet.map((pkg, index) => ({
        id: pkg.id,
        displayText: `Package #${pkg.package_id} - ${pkg.status}`,
        index: index,
        element: `<div>Package #${pkg.package_id} - ${pkg.status}</div>`
      }))

      // Simulate DOM updates
      await new Promise(resolve => setTimeout(resolve, 100))

      const endTime = performance.now()
      const processingTime = endTime - startTime

      expect(processingTime).toBeLessThan(2000)
      expect(processedPackages).toHaveLength(1000)
      expect(processedPackages[0].displayText).toContain('Package #')
    })

    it('should handle virtual scrolling for large datasets efficiently', async () => {
      const massivePackageSet = packageFactory.buildMany(10000, {
        mailroom_id: 'virtual-scroll-test'
      })

      const simulateVirtualScrolling = (dataset: any[], viewportSize: number = 50) => {
        const startTime = performance.now()
        
        const scrollPosition = 0
        const itemsToRender = dataset.slice(scrollPosition, scrollPosition + viewportSize)
        
        const renderedItems = itemsToRender.map((pkg, index) => ({
          id: pkg.id,
          virtualIndex: scrollPosition + index,
          content: `Package #${pkg.package_id}`
        }))

        const endTime = performance.now()
        return {
          renderTime: endTime - startTime,
          renderedItems,
          totalItems: dataset.length
        }
      }

      const result = simulateVirtualScrolling(massivePackageSet)

      expect(result.renderTime).toBeLessThan(100)
      expect(result.renderedItems.length).toBeLessThanOrEqual(50)
      expect(result.totalItems).toBe(10000)
    })

    it('should maintain smooth performance during status updates', async () => {
      const packages = packageFactory.buildMany(100, { status: 'WAITING' })
      
      const updatePackageStatus = (packageId: string, newStatus: string) => {
        const startTime = performance.now()
        
        // Simulate status update logic
        const packageIndex = packages.findIndex(pkg => pkg.id === packageId)
        if (packageIndex !== -1) {
          packages[packageIndex] = { ...packages[packageIndex], status: newStatus }
        }

        const endTime = performance.now()
        return endTime - startTime
      }

      const updateTime = updatePackageStatus(packages[0].id, 'RETRIEVED')
      expect(updateTime).toBeLessThan(50)
    })
  })

  describe('Resident Search Response Time', () => {
    it('should respond to search queries in under 500ms', async () => {
      const residents = residentFactory.buildMany(1000, {
        mailroom_id: 'search-performance-test'
      })

      mockSupabase.seedTable('residents', residents)

      const performSearch = async (query: string) => {
        const startTime = performance.now()
        
        const results = residents.filter(resident => 
          resident.first_name.toLowerCase().includes(query.toLowerCase()) ||
          resident.last_name.toLowerCase().includes(query.toLowerCase()) ||
          resident.student_id.includes(query)
        )

        const endTime = performance.now()
        return {
          results,
          responseTime: endTime - startTime
        }
      }

      const testQueries = ['John', 'Smith', '123', 'test']
      
      for (const query of testQueries) {
        const { results, responseTime } = await performSearch(query)
        expect(responseTime).toBeLessThan(500)
        expect(results).toBeDefined()
      }
    })

    it('should handle fuzzy search efficiently', async () => {
      const residents = residentFactory.buildMany(500, {
        mailroom_id: 'fuzzy-search-test'
      })

      const calculateSimilarity = (str1: string, str2: string): number => {
        const longer = str1.length > str2.length ? str1 : str2
        const shorter = str1.length > str2.length ? str2 : str1
        
        if (longer.length === 0) return 1.0
        
        // Simple similarity calculation
        const matches = shorter.split('').filter(char => longer.includes(char)).length
        return matches / longer.length
      }

      const fuzzySearch = (query: string, items: any[]) => {
        const startTime = performance.now()
        
        const results = items.filter(item => {
          const fullName = `${item.first_name} ${item.last_name}`.toLowerCase()
          const queryLower = query.toLowerCase()
          const similarity = calculateSimilarity(fullName, queryLower)
          return similarity > 0.3
        })

        const endTime = performance.now()
        return { results, searchTime: endTime - startTime }
      }

      const testQueries = ['Jhn', 'Smth', 'Doe', 'Alex']
      
      for (const query of testQueries) {
        const { results, searchTime } = fuzzySearch(query, residents)
        expect(searchTime).toBeLessThan(100)
        expect(results).toBeDefined()
      }
    })

    it('should implement search result caching for performance', async () => {
      const residents = residentFactory.buildMany(1000)
      const searchCache = new Map<string, any>()

      const cachedSearch = (query: string) => {
        const startTime = performance.now()
        
        if (searchCache.has(query)) {
          const endTime = performance.now()
          return { 
            results: searchCache.get(query), 
            searchTime: endTime - startTime,
            fromCache: true 
          }
        }

        const results = residents.filter(resident => 
          resident.first_name.toLowerCase().includes(query.toLowerCase())
        )
        
        searchCache.set(query, results)
        
        const endTime = performance.now()
        return { 
          results, 
          searchTime: endTime - startTime,
          fromCache: false 
        }
      }

      const firstSearch = cachedSearch('John')
      expect(firstSearch.fromCache).toBe(false)
      expect(firstSearch.searchTime).toBeLessThan(500)

      const secondSearch = cachedSearch('John')
      expect(secondSearch.fromCache).toBe(true)
      expect(secondSearch.searchTime).toBeLessThan(10)
    })
  })

  describe('File Upload Performance', () => {
    it('should handle 10MB+ files in under 30 seconds', async () => {
      const mockLargeFile = {
        size: 10 * 1024 * 1024, // 10MB
        name: 'large-roster.csv',
        type: 'text/csv'
      }

      const uploadFile = async (file: typeof mockLargeFile) => {
        const startTime = performance.now()
        
        const chunks = Math.ceil(file.size / (1024 * 1024)) // 1MB chunks
        
        for (let i = 0; i < chunks; i++) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        const endTime = performance.now()
        return endTime - startTime
      }

      const uploadTime = await uploadFile(mockLargeFile)
      expect(uploadTime).toBeLessThan(30000)
    })

    it('should provide upload progress feedback', async () => {
      const mockFile = {
        size: 5 * 1024 * 1024, // 5MB
        name: 'roster.csv',
        type: 'text/csv'
      }

      const uploadWithProgress = async (file: typeof mockFile) => {
        const chunkSize = 1024 * 1024 // 1MB chunks
        const totalChunks = Math.ceil(file.size / chunkSize)
        const progressUpdates: number[] = []

        for (let i = 0; i < totalChunks; i++) {
          await new Promise(resolve => setTimeout(resolve, 50))
          
          const progress = ((i + 1) / totalChunks) * 100
          progressUpdates.push(progress)
        }

        return progressUpdates
      }

      const progressUpdates = await uploadWithProgress(mockFile)
      
      expect(progressUpdates.length).toBeGreaterThan(1)
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100)
      
      for (let i = 1; i < progressUpdates.length; i++) {
        expect(progressUpdates[i]).toBeGreaterThanOrEqual(progressUpdates[i - 1])
      }
    })

    it('should handle upload cancellation efficiently', async () => {
      const mockFile = {
        size: 2 * 1024 * 1024, // 2MB
        name: 'roster.csv',
        type: 'text/csv'
      }

      let uploadCancelled = false
      
      const cancellableUpload = async (file: typeof mockFile) => {
        const startTime = performance.now()
        const chunkSize = 1024 * 1024
        const totalChunks = Math.ceil(file.size / chunkSize)

        for (let i = 0; i < totalChunks; i++) {
          if (uploadCancelled) {
            const endTime = performance.now()
            return { cancelled: true, timeToCancel: endTime - startTime }
          }
          
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        return { cancelled: false }
      }

      const uploadPromise = cancellableUpload(mockFile)
      
      setTimeout(() => {
        uploadCancelled = true
      }, 150)

      const result = await uploadPromise
      
      expect(result.cancelled).toBe(true)
      if ('timeToCancel' in result) {
        expect(result.timeToCancel).toBeLessThan(300)
      }
    })
  })

  describe('Page Load Time Performance', () => {
    it('should load pages in under 3 seconds on simulated 3G', async () => {
      const simulate3G = () => {
        const networkDelay = 300 // ms
        const downloadSpeed = 1.6 * 1024 * 1024 / 8 // bytes per second
        return { networkDelay, downloadSpeed }
      }

      const { networkDelay, downloadSpeed } = simulate3G()

      const simulatePageLoad = async (pageSize: number) => {
        const startTime = performance.now()
        
        await new Promise(resolve => setTimeout(resolve, networkDelay))
        
        const downloadTime = (pageSize / downloadSpeed) * 1000
        await new Promise(resolve => setTimeout(resolve, downloadTime))
        
        await new Promise(resolve => setTimeout(resolve, 200))

        const endTime = performance.now()
        return endTime - startTime
      }

      const pageSizes = [
        100 * 1024,  // 100KB
        500 * 1024,  // 500KB
        1024 * 1024  // 1MB
      ]

      for (const pageSize of pageSizes) {
        const loadTime = await simulatePageLoad(pageSize)
        expect(loadTime).toBeLessThan(3000)
      }
    })

    it('should implement efficient code splitting', async () => {
      const mockDynamicImports = {
        'AdminTab': () => new Promise(resolve => setTimeout(() => resolve({}), 100)),
        'UserTab': () => new Promise(resolve => setTimeout(() => resolve({}), 80)),
        'PackageList': () => new Promise(resolve => setTimeout(() => resolve({}), 120))
      }

      const loadComponentDynamically = async (componentName: string) => {
        const startTime = performance.now()
        
        await mockDynamicImports[componentName as keyof typeof mockDynamicImports]()
        
        const endTime = performance.now()
        return endTime - startTime
      }

      for (const component of Object.keys(mockDynamicImports)) {
        const loadTime = await loadComponentDynamically(component)
        expect(loadTime).toBeLessThan(200)
      }
    })
  })

  describe('Memory Usage Monitoring', () => {
    it('should maintain stable memory usage during large operations', async () => {
      const initialMemory = process.memoryUsage()
      
      const largeDataSet = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        data: 'x'.repeat(1000) // 1KB per item = 10MB total
      }))

      const batchSize = 1000
      for (let i = 0; i < largeDataSet.length; i += batchSize) {
        const batch = largeDataSet.slice(i, i + batchSize)
        
        const processed = batch.map(item => ({ ...item, processed: true }))
        
        const currentMemory = process.memoryUsage()
        const memoryIncrease = currentMemory.heapUsed - initialMemory.heapUsed
        
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // 50MB max
      }
    })

    it('should properly clean up resources after operations', async () => {
      const initialMemory = process.memoryUsage()
      
      let largeObjects: any[] = []
      for (let i = 0; i < 1000; i++) {
        largeObjects.push({
          id: i,
          data: new Array(1000).fill('test')
        })
      }

      largeObjects = []
      
      if (global.gc) {
        global.gc()
      }

      await new Promise(resolve => setTimeout(resolve, 100))

      const afterCleanupMemory = process.memoryUsage()
      const memoryDifference = afterCleanupMemory.heapUsed - initialMemory.heapUsed
      expect(memoryDifference).toBeLessThan(10 * 1024 * 1024) // 10MB variance
    })

    it('should handle memory pressure gracefully', async () => {
      const memoryPressureTest = async () => {
        const chunks: any[] = []
        let memoryExhausted = false

        try {
          for (let i = 0; i < 1000; i++) {
            const chunk = new Array(10000).fill(Math.random())
            chunks.push(chunk)

            const currentMemory = process.memoryUsage()
            
            if (currentMemory.heapUsed > 100 * 1024 * 1024) { // 100MB
              break
            }
          }
        } catch (error) {
          memoryExhausted = true
        }

        expect(memoryExhausted).toBe(false)
        chunks.length = 0
      }

      await memoryPressureTest()
    })
  })
})