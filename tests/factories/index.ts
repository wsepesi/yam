// Factory exports for easy importing
export * from './base.factory'
export * from './organization.factory'
export * from './mailroom.factory'
export * from './user.factory'
export * from './resident.factory'
export * from './package.factory'
export * from './invitation.factory'

// Import factories for use in TestScenarioBuilder
import { organizationFactory } from './organization.factory'
import { mailroomFactory } from './mailroom.factory'
import { userFactory } from './user.factory'
import { residentFactory } from './resident.factory'
import { packageFactory } from './package.factory'

// Convenience exports
export { organizationFactory } from './organization.factory'
export { mailroomFactory } from './mailroom.factory'
export { userFactory } from './user.factory'
export { residentFactory } from './resident.factory'
export { packageFactory } from './package.factory'
export { invitationFactory } from './invitation.factory'

// Test scenario builders for common multi-entity setups
export class TestScenarioBuilder {
  static buildBasicMailroomSetup() {
    const org = organizationFactory.build()
    const mailroom = mailroomFactory.build({ organization_id: org.id })
    const manager = userFactory.buildManager({ 
      organization_id: org.id, 
      mailroom_id: mailroom.id 
    })
    const residents = residentFactory.buildMany(10, { mailroom_id: mailroom.id })
    
    return { org, mailroom, manager, residents }
  }

  static buildMultiTenantSetup() {
    // Org A
    const orgA = organizationFactory.build({ name: 'University A' })
    const mailroomA1 = mailroomFactory.build({ 
      organization_id: orgA.id, 
      name: 'Main Campus Mail A' 
    })
    const mailroomA2 = mailroomFactory.build({ 
      organization_id: orgA.id, 
      name: 'North Campus Mail A' 
    })
    
    // Org B
    const orgB = organizationFactory.build({ name: 'University B' })
    const mailroomB1 = mailroomFactory.build({ 
      organization_id: orgB.id, 
      name: 'Main Campus Mail B' 
    })
    
    // Users
    const managerA1 = userFactory.buildManager({ 
      organization_id: orgA.id, 
      mailroom_id: mailroomA1.id 
    })
    const managerA2 = userFactory.buildManager({ 
      organization_id: orgA.id, 
      mailroom_id: mailroomA2.id 
    })
    const managerB1 = userFactory.buildManager({ 
      organization_id: orgB.id, 
      mailroom_id: mailroomB1.id 
    })
    
    return {
      orgA, orgB,
      mailroomA1, mailroomA2, mailroomB1,
      managerA1, managerA2, managerB1
    }
  }

  static buildPackageWorkflow(mailroomId: string, residentId: string) {
    const staff = userFactory.build({ mailroom_id: mailroomId })
    const packageWaiting = packageFactory.build({ 
      mailroom_id: mailroomId, 
      resident_id: residentId,
      staff_id: staff.id 
    })
    const packageRetrieved = packageFactory.buildRetrieved({ 
      mailroom_id: mailroomId, 
      resident_id: residentId,
      staff_id: staff.id 
    })
    
    return { staff, packageWaiting, packageRetrieved }
  }
}