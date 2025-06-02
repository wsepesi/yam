// tests/mocks/handlers.ts
import { HttpResponse, http } from 'msw'

export const handlers = [
  // Handle get-residents with query parameters
  http.get('/api/get-residents', () => {
    // Return residents data for testing
    return HttpResponse.json({
      records: [
        {
          id: '1',
          first_name: 'John',
          last_name: 'Doe',
          student_id: '12345',
          email: 'john@example.com',
          mailroom_id: 'test-mailroom',
          status: 'ACTIVE'
        }
      ]
    })
  }),

  http.post('/api/add-package', () => {
    return HttpResponse.json({
      packageId: '001',
      First: 'John',
      Last: 'Doe',
      Email: 'john@example.com',
      provider: 'UPS',
      status: 'pending'
    })
  }),

  http.get('/api/packages/get-current', () => {
    return HttpResponse.json({
      packages: [
        {
          id: 'pkg-1',
          residentName: 'John Doe',
          residentEmail: 'john@example.com',
          residentStudentId: '12345',
          provider: 'UPS',
          createdAt: '2025-01-01',
          packageId: '001'
        }
      ]
    })
  })
]