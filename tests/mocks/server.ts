import { handlers } from './handlers'
// tests/mocks/server.ts
import { setupServer } from 'msw/node'

export const server = setupServer(...handlers) 