// tests/mocks/handlers.ts - Comprehensive API mocking for all endpoints
import { HttpResponse, http } from 'msw'
import { packageFactory, residentFactory, userFactory, organizationFactory, mailroomFactory } from '../factories'

// Mock data stores
const mockData = {
  packages: packageFactory.buildMany(5),
  residents: residentFactory.buildMany(10),
  users: userFactory.buildMany(3),
  organizations: organizationFactory.buildMany(2),
  mailrooms: mailroomFactory.buildMany(3)
}

export const handlers = [
  // Package Management APIs
  http.get('/api/get-packages', ({ request }) => {
    const url = new URL(request.url)
    const mailroomId = url.searchParams.get('mailroom_id')
    const status = url.searchParams.get('status')
    
    let packages = mockData.packages
    if (mailroomId) {
      packages = packages.filter(p => p.mailroom_id === mailroomId)
    }
    if (status) {
      packages = packages.filter(p => p.status === status)
    }
    
    return HttpResponse.json({ packages })
  }),

  http.post('/api/add-package', async ({ request }) => {
    const body = await request.json() as any
    const newPackage = packageFactory.build({
      mailroom_id: body.mailroom_id,
      resident_id: body.resident_id,
      provider: body.provider,
      staff_id: body.staff_id
    })
    mockData.packages.push(newPackage)
    
    return HttpResponse.json({
      success: true,
      package: newPackage,
      packageId: newPackage.package_id.toString(),
      // Include the First and Last names from the request for the alert display
      First: body.First,
      Last: body.Last
    })
  }),

  http.put('/api/log-package', async ({ request }) => {
    const body = await request.json() as any
    const packageIndex = mockData.packages.findIndex(p => p.id === body.package_id)
    
    if (packageIndex === -1) {
      return HttpResponse.json(
        { error: 'Package not found' },
        { status: 404 }
      )
    }
    
    mockData.packages[packageIndex] = {
      ...mockData.packages[packageIndex],
      status: 'RETRIEVED',
      retrieved_timestamp: new Date().toISOString(),
      pickup_staff_id: body.staff_id
    }
    
    return HttpResponse.json({ success: true })
  }),

  http.delete('/api/remove-package', async ({ request }) => {
    const body = await request.json() as any
    const packageIndex = mockData.packages.findIndex(p => p.id === body.package_id)
    
    if (packageIndex === -1) {
      return HttpResponse.json(
        { error: 'Package not found' },
        { status: 404 }
      )
    }
    
    mockData.packages.splice(packageIndex, 1)
    return HttpResponse.json({ success: true })
  }),

  http.post('/api/fail-package', async ({ request }) => {
    const body = await request.json() as any
    const failedPackage = {
      id: 'failed-' + Date.now(),
      mailroom_id: body.mailroom_id,
      staff_id: body.staff_id,
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email,
      resident_id: body.resident_id,
      provider: body.provider,
      error_details: body.error_details,
      resolved: false,
      created_at: new Date().toISOString()
    }
    
    return HttpResponse.json({ success: true, failedPackage })
  }),

  // Resident Management APIs
  http.get('/api/get-residents', ({ request }) => {
    const url = new URL(request.url)
    const mailroomId = url.searchParams.get('mailroom_id')
    const search = url.searchParams.get('search')
    
    let residents = mockData.residents
    if (mailroomId) {
      residents = residents.filter(r => r.mailroom_id === mailroomId)
    }
    if (search) {
      residents = residents.filter(r => 
        r.first_name.toLowerCase().includes(search.toLowerCase()) ||
        r.last_name.toLowerCase().includes(search.toLowerCase()) ||
        r.student_id.includes(search)
      )
    }
    
    return HttpResponse.json({ records: residents })
  }),

  http.post('/api/add-resident', async ({ request }) => {
    const body = await request.json() as any
    const newResident = residentFactory.build({
      mailroom_id: body.mailroom_id,
      first_name: body.first_name,
      last_name: body.last_name,
      student_id: body.student_id,
      email: body.email,
      added_by: body.added_by
    })
    mockData.residents.push(newResident)
    
    return HttpResponse.json({ success: true, resident: newResident })
  }),

  http.delete('/api/remove-resident', async ({ request }) => {
    const body = await request.json() as any
    const residentIndex = mockData.residents.findIndex(r => r.id === body.resident_id)
    
    if (residentIndex === -1) {
      return HttpResponse.json(
        { error: 'Resident not found' },
        { status: 404 }
      )
    }
    
    mockData.residents[residentIndex].status = 'REMOVED_INDIVIDUAL'
    return HttpResponse.json({ success: true })
  }),

  http.post('/api/upload-roster', async ({ request }) => {
    // Mock file upload processing
    return HttpResponse.json({
      success: true,
      processed: 25,
      added: 23,
      updated: 2,
      errors: []
    })
  }),

  http.get('/api/get-students', ({ request }) => {
    const url = new URL(request.url)
    const search = url.searchParams.get('search')
    
    let students = mockData.residents.map(r => ({
      First_Name: r.first_name,
      Last_Name: r.last_name,
      Default_Email: r.email,
      University_ID: r.student_id
    }))
    
    if (search) {
      students = students.filter(s => 
        s.First_Name.toLowerCase().includes(search.toLowerCase()) ||
        s.Last_Name.toLowerCase().includes(search.toLowerCase())
      )
    }
    
    return HttpResponse.json(students)
  }),

  // User Management APIs
  http.get('/api/users/mailroom', ({ request }) => {
    const url = new URL(request.url)
    const mailroomId = url.searchParams.get('mailroom_id')
    
    let users = mockData.users
    if (mailroomId) {
      users = users.filter(u => u.mailroom_id === mailroomId)
    }
    
    return HttpResponse.json({ users })
  }),

  http.get('/api/managers', () => {
    const managers = mockData.users.filter(u => u.role === 'manager')
    return HttpResponse.json({ managers })
  }),

  http.put('/api/managers/:id', async ({ params, request }) => {
    const { id } = params
    const body = await request.json() as any
    const userIndex = mockData.users.findIndex(u => u.id === id)
    
    if (userIndex === -1) {
      return HttpResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    mockData.users[userIndex] = { ...mockData.users[userIndex], ...body }
    return HttpResponse.json({ success: true, user: mockData.users[userIndex] })
  }),

  // Organization & Mailroom APIs
  http.post('/api/organizations/create', async ({ request }) => {
    const body = await request.json() as any
    const newOrg = organizationFactory.build({
      name: body.name,
      slug: body.slug
    })
    mockData.organizations.push(newOrg)
    
    return HttpResponse.json({ success: true, organization: newOrg })
  }),

  http.get('/api/organizations/list-all', () => {
    return HttpResponse.json({ organizations: mockData.organizations })
  }),

  http.get('/api/organizations/details', ({ request }) => {
    const url = new URL(request.url)
    const orgSlug = url.searchParams.get('slug')
    const org = mockData.organizations.find(o => o.slug === orgSlug)
    
    if (!org) {
      return HttpResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }
    
    return HttpResponse.json({ organization: org })
  }),

  http.post('/api/mailrooms/create', async ({ request }) => {
    const body = await request.json() as any
    const newMailroom = mailroomFactory.build({
      name: body.name,
      slug: body.slug,
      organization_id: body.organization_id,
      created_by: body.created_by
    })
    mockData.mailrooms.push(newMailroom)
    
    return HttpResponse.json({ success: true, mailroom: newMailroom })
  }),

  http.get('/api/mailrooms/details', ({ request }) => {
    const url = new URL(request.url)
    const mailroomSlug = url.searchParams.get('slug')
    const mailroom = mockData.mailrooms.find(m => m.slug === mailroomSlug)
    
    if (!mailroom) {
      return HttpResponse.json(
        { error: 'Mailroom not found' },
        { status: 404 }
      )
    }
    
    return HttpResponse.json({ mailroom })
  }),

  // Statistics APIs
  http.get('/api/get-org-overview-stats', ({ request }) => {
    const url = new URL(request.url)
    const orgId = url.searchParams.get('organization_id')
    
    return HttpResponse.json({
      totalPackages: 156,
      activePackages: 23,
      totalResidents: 89,
      totalMailrooms: 3,
      monthlyStats: [
        { month: 'Jan', packages: 45 },
        { month: 'Feb', packages: 52 },
        { month: 'Mar', packages: 59 }
      ]
    })
  }),

  http.get('/api/get-system-overview-stats', () => {
    return HttpResponse.json({
      totalOrganizations: mockData.organizations.length,
      totalMailrooms: mockData.mailrooms.length,
      totalUsers: mockData.users.length,
      totalPackages: mockData.packages.length,
      systemHealth: 'good'
    })
  }),

  // Email notification API
  http.post('/api/send-notification-email', async ({ request }) => {
    const body = await request.json() as any
    return HttpResponse.json({
      success: true,
      messageId: `msg-${Date.now()}`,
      recipient: body.to
    })
  }),

  // Settings APIs
  http.get('/api/mailroom/get-settings', ({ request }) => {
    const url = new URL(request.url)
    const mailroomId = url.searchParams.get('mailroom_id')
    
    return HttpResponse.json({
      settings: {
        pickup_option: 'resident_id',
        mailroom_hours: {
          monday: { open: '09:00', close: '17:00' },
          tuesday: { open: '09:00', close: '17:00' },
          wednesday: { open: '09:00', close: '17:00' },
          thursday: { open: '09:00', close: '17:00' },
          friday: { open: '09:00', close: '17:00' }
        },
        email_additional_text: 'Please bring your student ID.'
      }
    })
  }),

  http.put('/api/mailroom/update-settings', async ({ request }) => {
    const body = await request.json() as any
    return HttpResponse.json({ success: true, settings: body })
  }),

  // Invitation APIs
  http.post('/api/invitations/create', async ({ request }) => {
    const body = await request.json() as any
    return HttpResponse.json({
      success: true,
      invitation: {
        id: `inv-${Date.now()}`,
        email: body.email,
        role: body.role,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }
    })
  }),

  http.get('/api/invitations', () => {
    return HttpResponse.json({
      invitations: [
        {
          id: 'inv-1',
          email: 'newuser@test.edu',
          role: 'user',
          status: 'PENDING',
          expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
        }
      ]
    })
  }),

  http.delete('/api/invitations/:id', ({ params }) => {
    return HttpResponse.json({ success: true })
  }),

  // Supabase REST API handlers to prevent warnings
  http.get('http://localhost:54321/rest/v1/organizations', ({ request }) => {
    const url = new URL(request.url)
    const select = url.searchParams.get('select')
    const limit = url.searchParams.get('limit')
    
    let orgs = mockData.organizations
    if (limit) {
      orgs = orgs.slice(0, parseInt(limit))
    }
    
    if (select === 'id') {
      orgs = orgs.map(org => ({ id: org.id }))
    }
    
    return HttpResponse.json(orgs)
  }),

  http.get('http://localhost:54321/rest/v1/*', () => {
    // Generic handler for other Supabase REST endpoints
    return HttpResponse.json([])
  })
]

// Utility for tests to reset mock data
export const resetMockData = () => {
  mockData.packages = packageFactory.buildMany(5)
  mockData.residents = residentFactory.buildMany(10)
  mockData.users = userFactory.buildMany(3)
  mockData.organizations = organizationFactory.buildMany(2)
  mockData.mailrooms = mailroomFactory.buildMany(3)
}

// Utility for tests to get mock data
export const getMockData = () => ({ ...mockData })

// Utility for tests to seed specific data
export const seedMockData = (data: Partial<typeof mockData>) => {
  Object.assign(mockData, data)
}