// Database Test Helper Utility for managing test data and isolation
import { SupabaseClient } from '@supabase/supabase-js'
import { getSharedAdminInstance, trackCreatedRecord } from '../setup'
import { randomUUID } from 'crypto'

export class DatabaseTestHelper {
  private static instance: DatabaseTestHelper
  private supabase: SupabaseClient
  private createdIds: {
    organizations: string[]
    mailrooms: string[]
    profiles: string[]
    authUsers: string[] // Track auth user IDs separately
    residents: string[]
    packages: string[]
    invitations: string[]
  }
  
  private constructor() {
    this.supabase = getSharedAdminInstance()
    this.createdIds = {
      organizations: [],
      mailrooms: [],
      profiles: [],
      authUsers: [],
      residents: [],
      packages: [],
      invitations: []
    }
  }
  
  static getInstance(): DatabaseTestHelper {
    if (!this.instance) {
      this.instance = new DatabaseTestHelper()
    }
    return this.instance
  }
  
  // Create a fresh instance for test isolation
  static createInstance(): DatabaseTestHelper {
    return new DatabaseTestHelper()
  }
  
  // Generate unique test identifiers to prevent conflicts
  private generateUniqueId(): string {
    // Use timestamp + random string + process ID for better uniqueness
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9)
    const processId = process.pid ? process.pid.toString() : '0'
    return `${timestamp}-${random}-${processId}`
  }
  
  // Create test organization
  async createTestOrg(name?: string, slug?: string) {
    const orgId = randomUUID()
    const uniqueId = this.generateUniqueId()
    const orgData = {
      id: orgId,
      name: name || `Test Org ${uniqueId}`,
      slug: slug || `test-org-${uniqueId}`,
      notification_email: `test-org-${uniqueId}@example.com`,
      notification_email_password: 'test-password',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    const { data, error } = await this.supabase
      .from('organizations')
      .insert(orgData)
      .select()
      .single()
    
    if (error) throw new Error(`Failed to create test org: ${error.message}`)
    
    this.createdIds.organizations.push(data.id)
    trackCreatedRecord('organizations', data.id)
    
    return data
  }
  
  // Create test mailroom - supports both object and positional parameters
  async createTestMailroom(organizationId: string, nameOrOptions?: string | any, slug?: string, createdBy?: string) {
    // Handle both object and positional parameter styles
    let name: string, actualSlug: string, actualCreatedBy: string
    const uniqueId = this.generateUniqueId()
    
    if (typeof nameOrOptions === 'object' && nameOrOptions !== null) {
      // Object style: createTestMailroom(orgId, { name: 'Test', slug: 'test' })
      name = nameOrOptions.name || `Test Mailroom ${uniqueId}`
      actualSlug = nameOrOptions.slug || `test-mailroom-${uniqueId}`
      actualCreatedBy = nameOrOptions.created_by || nameOrOptions.createdBy
    } else {
      // Positional style: createTestMailroom(orgId, 'Test Mailroom', 'test-mailroom')
      name = nameOrOptions || `Test Mailroom ${uniqueId}`
      actualSlug = slug || `test-mailroom-${uniqueId}`
      actualCreatedBy = createdBy
    }
    
    // If no creator specified, we need to create a minimal admin user first
    let finalCreatedBy = actualCreatedBy
    if (!finalCreatedBy) {
      // Create a minimal admin user just for the created_by constraint
      const tempAdminEmail = `temp-admin-${this.generateUniqueId()}@example.com`
      const { data: tempAuthUser, error: tempAuthError } = await this.supabase.auth.admin.createUser({
        email: tempAdminEmail,
        password: 'temp-password-123',
        email_confirm: true
      })
      
      if (tempAuthError) throw new Error(`Failed to create temp admin user: ${tempAuthError.message}`)
      if (!tempAuthUser?.user?.id) throw new Error('Auth user creation returned no user ID')
      
      // The auth user trigger automatically creates a basic profile, so we need to update it
      const tempProfileUpdate = {
        role: 'admin',
        organization_id: organizationId,
        mailroom_id: null,
        status: 'ACTIVE',
        updated_at: new Date().toISOString()
      }
      
      const { data: tempProfile, error: tempProfileError } = await this.supabase
        .from('profiles')
        .update(tempProfileUpdate)
        .eq('id', tempAuthUser.user.id)
        .select()
        .single()
      
      if (tempProfileError) {
        // Clean up auth user if profile update fails
        try {
          await this.supabase.auth.admin.deleteUser(tempAuthUser.user.id)
        } catch (cleanupError) {
          console.warn(`Failed to cleanup auth user ${tempAuthUser.user.id}:`, cleanupError)
        }
        throw new Error(`Failed to update temp admin profile: ${tempProfileError.message}`)
      }
      
      finalCreatedBy = tempProfile.id
      this.createdIds.profiles.push(tempProfile.id)
      this.createdIds.authUsers.push(tempAuthUser.user.id)
    }
    
    const mailroomId = randomUUID()
    const mailroomData = {
      id: mailroomId,
      name: name || `Test Mailroom ${uniqueId}`,
      slug: actualSlug || `test-mailroom-${uniqueId}`,
      organization_id: organizationId,
      admin_email: `admin-mailroom-${uniqueId}@example.com`,
      mailroom_hours: null,
      email_additional_text: 'Test additional text',
      created_by: finalCreatedBy,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    const { data, error } = await this.supabase
      .from('mailrooms')
      .insert(mailroomData)
      .select()
      .single()
    
    if (error) throw new Error(`Failed to create test mailroom: ${error.message}`)
    
    // Initialize package queue for the mailroom
    const { error: queueError } = await this.supabase.rpc('initialize_package_queue', {
      p_mailroom_id: data.id
    })
    
    if (queueError) {
      console.warn(`Warning: Failed to initialize package queue: ${queueError.message}`)
    }
    
    this.createdIds.mailrooms.push(data.id)
    trackCreatedRecord('mailrooms', data.id)
    
    return data
  }
  
  // Create test user/profile (with auth user) - supports both object and positional parameters
  async createTestUser(organizationIdOrOptions: string | any, mailroomId?: string, role: 'user' | 'manager' | 'admin' = 'user') {
    // Handle both object and positional parameter styles
    let organizationId: string, actualMailroomId: string | null, actualRole: string, email: string
    
    if (typeof organizationIdOrOptions === 'object' && organizationIdOrOptions !== null) {
      // Object style: createTestUser({ email: 'test@test.com', role: 'admin', organization_id: 'org1' })
      organizationId = organizationIdOrOptions.organization_id
      actualMailroomId = organizationIdOrOptions.assigned_mailroom_id || null
      actualRole = organizationIdOrOptions.role || 'user'
      email = organizationIdOrOptions.email || `${actualRole}-${this.generateUniqueId()}@example.com`
    } else {
      // Positional style: createTestUser(orgId, mailroomId, 'admin')
      organizationId = organizationIdOrOptions
      actualMailroomId = mailroomId || null
      actualRole = role
      email = `${actualRole}-${this.generateUniqueId()}@example.com`
    }
    
    // 1. Create auth user first using Supabase Admin API
    const { data: authUser, error: authError } = await this.supabase.auth.admin.createUser({
      email,
      password: 'test-password-123',
      email_confirm: true
    })
    
    if (authError) throw new Error(`Failed to create auth user: ${authError.message}`)
    if (!authUser?.user?.id) throw new Error('Auth user creation returned no user ID')
    
    // 2. Update the auto-created profile (created by auth trigger)
    const profileUpdate = {
      role: actualRole,
      organization_id: organizationId,
      mailroom_id: actualMailroomId,
      status: 'ACTIVE',
      updated_at: new Date().toISOString()
    }
    
    const { data, error } = await this.supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', authUser.user.id)
      .select()
      .single()
    
    if (error) {
      // Cleanup auth user if profile update fails
      try {
        await this.supabase.auth.admin.deleteUser(authUser.user.id)
      } catch (cleanupError) {
        console.warn(`Failed to cleanup auth user ${authUser.user.id}:`, cleanupError)
      }
      throw new Error(`Failed to update test user profile: ${error.message}`)
    }
    
    this.createdIds.profiles.push(data.id)
    this.createdIds.authUsers.push(authUser.user.id)
    trackCreatedRecord('profiles', data.id)
    
    return { authUser: authUser.user, profile: data }
  }
  
  // Create test resident
  async createTestResident(mailroomId: string, email?: string, addedBy?: string) {
    // If no addedBy provided, create a temporary admin user for this mailroom
    let finalAddedBy = addedBy
    if (!finalAddedBy) {
      // Get the organization ID from the mailroom
      const { data: mailroom } = await this.supabase
        .from('mailrooms')
        .select('organization_id')
        .eq('id', mailroomId)
        .single()
      
      if (!mailroom) throw new Error('Mailroom not found for resident creation')
      
      // Create a temporary admin user
      const tempAdmin = await this.createTestUser(mailroom.organization_id, mailroomId, 'admin')
      finalAddedBy = tempAdmin.profile.id
    }
    
    const residentId = randomUUID()
    const uniqueId = this.generateUniqueId()
    const residentData = {
      id: residentId,
      first_name: 'Test',
      last_name: `Resident${uniqueId}`,
      email: email || `test-resident-${uniqueId}@example.com`,
      student_id: `STU-${uniqueId}`,
      mailroom_id: mailroomId,
      added_by: finalAddedBy,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    const { data, error } = await this.supabase
      .from('residents')
      .insert(residentData)
      .select()
      .single()
    
    if (error) throw new Error(`Failed to create test resident: ${error.message}`)
    
    this.createdIds.residents.push(data.id)
    trackCreatedRecord('residents', data.id)
    
    return data
  }
  
  // Create test package
  async createTestPackage(mailroomId: string, residentId: string, staffId: string) {
    // Get next package number from queue
    const { data: packageNumber, error: numberError } = await this.supabase.rpc('get_next_package_number', {
      p_mailroom_id: mailroomId
    })
    
    if (numberError || !packageNumber) {
      throw new Error(`Failed to get package number: ${numberError?.message || 'No number available'}`)
    }
    
    const packageId = randomUUID()
    const packageData = {
      id: packageId,
      mailroom_id: mailroomId,
      staff_id: staffId,
      resident_id: residentId,
      package_id: packageNumber,
      provider: 'FedEx',
      status: 'WAITING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    const { data, error } = await this.supabase
      .from('packages')
      .insert(packageData)
      .select()
      .single()
    
    if (error) throw new Error(`Failed to create test package: ${error.message}`)
    
    this.createdIds.packages.push(data.id)
    trackCreatedRecord('packages', data.id)
    
    return data
  }
  
  // Create multiple test residents
  async createTestResidents(mailroomId: string, count: number) {
    const residents = []
    for (let i = 0; i < count; i++) {
      const resident = await this.createTestResident(mailroomId)
      residents.push(resident)
    }
    return residents
  }
  
  // Update package status
  async updatePackageStatus(packageId: string, status: 'WAITING' | 'RETRIEVED' | 'RESOLVED' | 'FAILED') {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    }
    
    if (status === 'RETRIEVED') {
      updateData.retrieved_timestamp = new Date().toISOString()
    } else if (status === 'RESOLVED') {
      updateData.resolved_timestamp = new Date().toISOString()
    }
    
    const { data, error } = await this.supabase
      .from('packages')
      .update(updateData)
      .eq('id', packageId)
      .select()
      .single()
    
    if (error) throw new Error(`Failed to update package status: ${error.message}`)
    
    return data
  }
  
  // Release package number back to queue
  async releasePackageNumber(mailroomId: string, packageNumber: number) {
    const { data, error } = await this.supabase.rpc('release_package_number', {
      p_mailroom_id: mailroomId,
      p_package_number: packageNumber
    })
    
    if (error) throw new Error(`Failed to release package number: ${error.message}`)
    
    return data
  }
  
  // Get package queue status
  async getPackageQueueStatus(mailroomId: string) {
    const { data, error } = await this.supabase
      .from('package_queue')
      .select('package_number, is_available')
      .eq('mailroom_id', mailroomId)
      .order('package_number')
    
    if (error) throw new Error(`Failed to get queue status: ${error.message}`)
    
    return {
      total: data.length,
      available: data.filter(p => p.is_available).length,
      inUse: data.filter(p => !p.is_available).length,
      numbers: data
    }
  }
  
  // Clean up all created test data with improved isolation
  async cleanup() {
    const errors: string[] = []
    const timestamp = Date.now()
    
    // Early return if nothing to clean up
    const hasData = Object.values(this.createdIds).some(arr => arr.length > 0)
    if (!hasData) {
      return
    }
    
    try {
      // More aggressive and comprehensive cleanup strategy
      
      // 1. Clean up packages first (no dependencies)
      if (this.createdIds.packages.length > 0) {
        const { error } = await this.supabase
          .from('packages')
          .delete()
          .in('id', this.createdIds.packages)
        if (error) errors.push(`Failed to delete packages: ${error.message}`)
      }
      
      // 2. Clean up residents (depends only on mailrooms which will be cleared later)
      if (this.createdIds.residents.length > 0) {
        const { error } = await this.supabase
          .from('residents')
          .delete()
          .in('id', this.createdIds.residents)
        if (error) errors.push(`Failed to delete residents: ${error.message}`)
      }
      
      // 3. Handle the circular dependency: profiles ↔ mailrooms
      // Break the circular dependency by clearing all references first
      if (this.createdIds.profiles.length > 0) {
        // Clear mailroom assignments from profiles
        const { error: clearMailroomError } = await this.supabase
          .from('profiles')
          .update({ mailroom_id: null })
          .in('id', this.createdIds.profiles)
        if (clearMailroomError && !clearMailroomError.message.includes('0 rows')) {
          errors.push(`Failed to clear mailroom references: ${clearMailroomError.message}`)
        }
      }
      
      if (this.createdIds.mailrooms.length > 0) {
        // Clear created_by references from mailrooms to break circular dependency
        const { error: clearCreatedByError } = await this.supabase
          .from('mailrooms')
          .update({ created_by: null })
          .in('id', this.createdIds.mailrooms)
        if (clearCreatedByError && !clearCreatedByError.message.includes('0 rows')) {
          errors.push(`Failed to clear created_by references: ${clearCreatedByError.message}`)
        }
        
        // Clean up package queues for each mailroom
        for (const mailroomId of this.createdIds.mailrooms) {
          try {
            const { error: queueError } = await this.supabase
              .from('package_queue')
              .delete()
              .eq('mailroom_id', mailroomId)
            // Only log if table exists and actual error occurred
            if (queueError && !queueError.message.includes('does not exist') && !queueError.message.includes('0 rows')) {
              errors.push(`Failed to delete package queue for mailroom ${mailroomId}: ${queueError.message}`)
            }
          } catch (error) {
            // Ignore table not found errors
            if (!String(error).includes('does not exist')) {
              errors.push(`Failed to delete package queue for mailroom ${mailroomId}: ${error}`)
            }
          }
        }
      }
      
      // 4. Delete auth users first (this should cascade to profiles via triggers)
      if (this.createdIds.authUsers.length > 0) {
        // Use parallel deletion with error handling
        const authDeletionPromises = this.createdIds.authUsers.map(async (authUserId) => {
          try {
            const { error: authError } = await this.supabase.auth.admin.deleteUser(authUserId)
            if (authError && !authError.message.includes('User not found') && !authError.message.includes('does not exist')) {
              return `Failed to delete auth user ${authUserId}: ${authError.message}`
            }
          } catch (error) {
            if (!String(error).includes('User not found') && !String(error).includes('does not exist')) {
              return `Failed to delete auth user ${authUserId}: ${error}`
            }
          }
          return null
        })
        
        const authErrors = (await Promise.all(authDeletionPromises)).filter(Boolean)
        errors.push(...authErrors)
      }
      
      // 5. Clean up any remaining profiles (should be auto-deleted by auth user deletion)
      if (this.createdIds.profiles.length > 0) {
        const { error: profileError } = await this.supabase
          .from('profiles')
          .delete()
          .in('id', this.createdIds.profiles)
        // Only log if profiles actually exist to delete and it's a real error
        if (profileError && !profileError.message.includes('0 rows') && !profileError.message.includes('does not exist')) {
          errors.push(`Failed to delete profiles: ${profileError.message}`)
        }
      }
      
      // 6. Clean up mailrooms (should be clean now with no FK references)
      if (this.createdIds.mailrooms.length > 0) {
        const { error: mailroomError } = await this.supabase
          .from('mailrooms')
          .delete()
          .in('id', this.createdIds.mailrooms)
        if (mailroomError && !mailroomError.message.includes('0 rows')) {
          errors.push(`Failed to delete mailrooms: ${mailroomError.message}`)
        }
      }
      
      // 7. Finally, clean up organizations
      if (this.createdIds.organizations.length > 0) {
        // Clear any remaining organization references
        const { error: clearOrgError } = await this.supabase
          .from('profiles')
          .update({ organization_id: null })
          .in('organization_id', this.createdIds.organizations)
        if (clearOrgError && !clearOrgError.message.includes('0 rows')) {
          errors.push(`Failed to clear organization references: ${clearOrgError.message}`)
        }
        
        const { error } = await this.supabase
          .from('organizations')
          .delete()
          .in('id', this.createdIds.organizations)
        if (error && !error.message.includes('0 rows')) {
          errors.push(`Failed to delete organizations: ${error.message}`)
        }
      }
      
      // Reset tracking
      this.createdIds = {
        organizations: [],
        mailrooms: [],
        profiles: [],
        authUsers: [],
        residents: [],
        packages: [],
        invitations: []
      }
      
      // If there were any errors, log them but don't throw to avoid masking test failures
      if (errors.length > 0) {
        console.warn(`Cleanup completed with ${errors.length} warnings (test ${timestamp}):`, errors.slice(0, 3).join('; '))
        if (errors.length > 3) {
          console.warn(`... and ${errors.length - 3} more warnings`)
        }
      }
    } catch (error) {
      console.error('Critical cleanup error:', error)
      // Still reset tracking to avoid cascading failures
      this.createdIds = {
        organizations: [],
        mailrooms: [],
        profiles: [],
        authUsers: [],
        residents: [],
        packages: [],
        invitations: []
      }
    }
  }
  
  // Reset package queues for specific mailrooms to ensure isolation
  async resetPackageQueues(mailroomIds: string[]) {
    for (const mailroomId of mailroomIds) {
      try {
        // First, clean up any existing queue entries
        await this.supabase
          .from('package_queue')
          .delete()
          .eq('mailroom_id', mailroomId)
        
        // Reinitialize the queue
        const { error } = await this.supabase.rpc('initialize_package_queue', {
          p_mailroom_id: mailroomId
        })
        
        if (error && !error.message.includes('does not exist')) {
          console.warn(`Failed to reset package queue for mailroom ${mailroomId}:`, error.message)
        }
      } catch (error) {
        console.warn(`Error resetting package queue for mailroom ${mailroomId}:`, error)
      }
    }
  }
  
  // Comprehensive test isolation reset - call this between tests that may interfere
  async resetTestEnvironment() {
    try {
      // Add a small delay to ensure database operations have settled
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // 1. Release all package numbers back to queues
      if (this.createdIds.packages.length > 0) {
        for (const packageId of this.createdIds.packages) {
          try {
            // Get package details to find mailroom and package number
            const { data: pkg } = await this.supabase
              .from('packages')
              .select('mailroom_id, package_id')
              .eq('id', packageId)
              .single()
            
            if (pkg) {
              await this.releasePackageNumber(pkg.mailroom_id, pkg.package_id)
            }
          } catch (error) {
            // Ignore individual package cleanup errors
          }
        }
      }
      
      // 2. Perform regular cleanup
      await this.cleanup()
      
      // 3. Reset any package queues for mailrooms we created
      if (this.createdIds.mailrooms.length > 0) {
        await this.resetPackageQueues(this.createdIds.mailrooms)
      }
    } catch (error) {
      console.warn('Test environment reset failed:', error)
      // Still perform regular cleanup
      await this.cleanup()
    }
  }
  
  // Get Supabase client for direct operations
  getClient() {
    return this.supabase
  }
}