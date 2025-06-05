// Enhanced Supabase client mock for comprehensive database testing
import { vi } from 'vitest'

export interface MockSupabaseResponse<T = any> {
  data: T | null
  error: any | null
  count?: number | null
  status: number
  statusText: string
}

export interface MockQueryBuilder {
  select: (columns?: string) => MockQueryBuilder
  insert: (values: any) => MockQueryBuilder
  update: (values: any) => MockQueryBuilder
  delete: () => MockQueryBuilder
  eq: (column: string, value: any) => MockQueryBuilder
  neq: (column: string, value: any) => MockQueryBuilder
  gt: (column: string, value: any) => MockQueryBuilder
  gte: (column: string, value: any) => MockQueryBuilder
  lt: (column: string, value: any) => MockQueryBuilder
  lte: (column: string, value: any) => MockQueryBuilder
  like: (column: string, pattern: string) => MockQueryBuilder
  ilike: (column: string, pattern: string) => MockQueryBuilder
  is: (column: string, value: any) => MockQueryBuilder
  in: (column: string, values: any[]) => MockQueryBuilder
  order: (column: string, options?: { ascending?: boolean }) => MockQueryBuilder
  limit: (count: number) => MockQueryBuilder
  single: () => Promise<MockSupabaseResponse>
  maybeSingle: () => Promise<MockSupabaseResponse>
  returns: () => MockQueryBuilder
}

class SupabaseMock {
  private mockData: Record<string, any[]> = {}
  private mockErrors: Record<string, any> = {}
  private currentTable = ''
  private currentFilters: Array<{ column: string; operator: string; value: any }> = []

  // Auth mock
  auth = {
    getSession: vi.fn(() => Promise.resolve({
      data: { session: this.createMockSession() },
      error: null
    })),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } }
    })),
    signInWithPassword: vi.fn(() => Promise.resolve({
      data: { user: this.createMockUser(), session: this.createMockSession() },
      error: null
    })),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
    signUp: vi.fn(() => Promise.resolve({
      data: { user: this.createMockUser(), session: null },
      error: null
    })),
    updateUser: vi.fn(() => Promise.resolve({
      data: { user: this.createMockUser() },
      error: null
    })),
    resetPasswordForEmail: vi.fn(() => Promise.resolve({ error: null }))
  }

  // Database query builder
  from(table: string): MockQueryBuilder {
    this.currentTable = table
    this.currentFilters = []
    
    const builder: MockQueryBuilder = {
      select: (columns?: string) => {
        return builder
      },
      insert: (values: any) => {
        const insertedData = Array.isArray(values) ? values : [values]
        if (!this.mockData[this.currentTable]) {
          this.mockData[this.currentTable] = []
        }
        this.mockData[this.currentTable].push(...insertedData)
        return builder
      },
      update: (values: any) => {
        if (this.mockData[this.currentTable]) {
          this.mockData[this.currentTable] = this.mockData[this.currentTable].map(item => {
            if (this.matchesFilters(item)) {
              return { ...item, ...values, updated_at: new Date().toISOString() }
            }
            return item
          })
        }
        return builder
      },
      delete: () => {
        if (this.mockData[this.currentTable]) {
          this.mockData[this.currentTable] = this.mockData[this.currentTable].filter(item => 
            !this.matchesFilters(item)
          )
        }
        return builder
      },
      eq: (column: string, value: any) => {
        this.currentFilters.push({ column, operator: 'eq', value })
        return builder
      },
      neq: (column: string, value: any) => {
        this.currentFilters.push({ column, operator: 'neq', value })
        return builder
      },
      gt: (column: string, value: any) => {
        this.currentFilters.push({ column, operator: 'gt', value })
        return builder
      },
      gte: (column: string, value: any) => {
        this.currentFilters.push({ column, operator: 'gte', value })
        return builder
      },
      lt: (column: string, value: any) => {
        this.currentFilters.push({ column, operator: 'lt', value })
        return builder
      },
      lte: (column: string, value: any) => {
        this.currentFilters.push({ column, operator: 'lte', value })
        return builder
      },
      like: (column: string, pattern: string) => {
        this.currentFilters.push({ column, operator: 'like', value: pattern })
        return builder
      },
      ilike: (column: string, pattern: string) => {
        this.currentFilters.push({ column, operator: 'ilike', value: pattern })
        return builder
      },
      is: (column: string, value: any) => {
        this.currentFilters.push({ column, operator: 'is', value })
        return builder
      },
      in: (column: string, values: any[]) => {
        this.currentFilters.push({ column, operator: 'in', value: values })
        return builder
      },
      order: (column: string, options?: { ascending?: boolean }) => {
        return builder
      },
      limit: (count: number) => {
        return builder
      },
      single: () => {
        const filteredData = this.getFilteredData()
        return Promise.resolve({
          data: filteredData.length > 0 ? filteredData[0] : null,
          error: filteredData.length > 1 ? { message: 'Multiple rows returned' } : null,
          status: 200,
          statusText: 'OK'
        })
      },
      maybeSingle: () => {
        const filteredData = this.getFilteredData()
        return Promise.resolve({
          data: filteredData.length > 0 ? filteredData[0] : null,
          error: null,
          status: 200,
          statusText: 'OK'
        })
      },
      returns: () => builder
    }

    // Override the Promise methods to return filtered data
    ;(builder as any).then = (onFulfilled: any) => {
      const result = {
        data: this.getFilteredData(),
        error: this.mockErrors[this.currentTable] || null,
        count: this.mockData[this.currentTable]?.length || 0,
        status: 200,
        statusText: 'OK'
      }
      return Promise.resolve(result).then(onFulfilled)
    }

    return builder
  }

  // RPC function mock
  rpc(functionName: string, params?: any): Promise<MockSupabaseResponse> {
    switch (functionName) {
      case 'get_next_package_number':
        return Promise.resolve({
          data: Math.floor(Math.random() * 999) + 1,
          error: null,
          status: 200,
          statusText: 'OK'
        })
      case 'release_package_number':
        return Promise.resolve({
          data: true,
          error: null,
          status: 200,
          statusText: 'OK'
        })
      case 'initialize_package_queue':
        return Promise.resolve({
          data: null,
          error: null,
          status: 200,
          statusText: 'OK'
        })
      case 'get_monthly_package_stats_for_mailroom':
        return Promise.resolve({
          data: [
            { month_name: 'Jan', package_count: 25 },
            { month_name: 'Feb', package_count: 30 },
            { month_name: 'Mar', package_count: 28 }
          ],
          error: null,
          status: 200,
          statusText: 'OK'
        })
      default:
        return Promise.resolve({
          data: null,
          error: { message: `RPC function '${functionName}' not mocked` },
          status: 404,
          statusText: 'Not Found'
        })
    }
  }

  // Test utilities
  seedTable(table: string, data: any[]): void {
    this.mockData[table] = [...data]
  }

  clearTable(table: string): void {
    this.mockData[table] = []
  }

  clearAllTables(): void {
    this.mockData = {}
  }

  setError(table: string, error: any): void {
    this.mockErrors[table] = error
  }

  clearErrors(): void {
    this.mockErrors = {}
  }

  getTableData(table: string): any[] {
    return this.mockData[table] || []
  }

  private createMockUser() {
    return {
      id: 'test-user-id',
      email: 'test@example.com',
      role: 'authenticated',
      aud: 'authenticated',
      created_at: new Date().toISOString()
    }
  }

  private createMockSession() {
    return {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
      token_type: 'bearer',
      user: this.createMockUser()
    }
  }

  private matchesFilters(item: any): boolean {
    return this.currentFilters.every(filter => {
      const itemValue = item[filter.column]
      switch (filter.operator) {
        case 'eq': return itemValue === filter.value
        case 'neq': return itemValue !== filter.value
        case 'gt': return itemValue > filter.value
        case 'gte': return itemValue >= filter.value
        case 'lt': return itemValue < filter.value
        case 'lte': return itemValue <= filter.value
        case 'like': 
        case 'ilike': 
          const pattern = filter.value.replace(/%/g, '.*')
          const regex = new RegExp(pattern, filter.operator === 'ilike' ? 'i' : '')
          return regex.test(itemValue)
        case 'is': return itemValue === filter.value
        case 'in': return filter.value.includes(itemValue)
        default: return true
      }
    })
  }

  private getFilteredData(): any[] {
    const tableData = this.mockData[this.currentTable] || []
    return tableData.filter(item => this.matchesFilters(item))
  }
}

export const mockSupabase = new SupabaseMock()

// Admin client mock
export const mockCreateAdminClient = vi.fn(() => mockSupabase)
export const createAdminClient = mockCreateAdminClient