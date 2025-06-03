// tests/setup.ts
import '@testing-library/jest-dom'

import { afterAll, afterEach, beforeAll, vi } from 'vitest'

import dotenv from 'dotenv'
import path from 'path'
import { server } from './mocks/server.ts'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

// MSW setup
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Mock Next.js router
vi.mock('next/router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    query: {},
    pathname: '/',
    asPath: '/',
    isReady: true
  })
}))

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ 
        data: { session: null }, 
        error: null 
      })),
      onAuthStateChange: vi.fn(() => ({ 
        data: { subscription: { unsubscribe: vi.fn() } } 
      })),
      signInWithPassword: vi.fn(() => Promise.resolve({ 
        data: { user: null, session: null }, 
        error: null 
      })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      updateUser: vi.fn(() => Promise.resolve({ 
        data: { user: null }, 
        error: null 
      })),
      signUp: vi.fn(() => Promise.resolve({ 
        data: { user: null, session: null }, 
        error: null 
      })),
      resetPasswordForEmail: vi.fn(() => Promise.resolve({ error: null }))
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      order: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      returns: vi.fn().mockReturnThis()
    })),
    rpc: vi.fn(() => Promise.resolve({ 
      data: null, 
      error: null,
      count: null,
      status: 200,
      statusText: 'OK'
    }))
  },
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      order: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      returns: vi.fn().mockReturnThis()
    })),
    rpc: vi.fn(() => Promise.resolve({ 
      data: null, 
      error: null,
      count: null,
      status: 200,
      statusText: 'OK'
    }))
  }))
}))