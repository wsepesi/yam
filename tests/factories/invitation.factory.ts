// Invitation factory for test data
import { BaseFactory, FactoryUtils } from './base.factory'

export interface TestInvitation {
  id: string
  email: string
  role: 'user' | 'manager' | 'admin' | 'super-admin'
  organization_id: string
  mailroom_id: string
  invited_by: string
  expires_at: string
  used: boolean
  status: 'PENDING' | 'RESOLVED' | 'FAILED'
  created_at: string
  updated_at: string
}

export class InvitationFactory extends BaseFactory<TestInvitation> {
  private static domains = ['gmail.com', 'yahoo.com', 'university.edu', 'college.edu', 'school.org']

  build(overrides?: Partial<TestInvitation>): TestInvitation {
    const timestamp = FactoryUtils.timestamp()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // Expires in 7 days
    
    const randomName = `user${FactoryUtils.randomInt(1000, 9999)}`
    const domain = FactoryUtils.randomChoice(InvitationFactory.domains)
    
    return {
      id: FactoryUtils.uuid(),
      email: `${randomName}@${domain}`,
      role: 'user',
      organization_id: overrides?.organization_id || FactoryUtils.uuid(),
      mailroom_id: overrides?.mailroom_id || FactoryUtils.uuid(),
      invited_by: overrides?.invited_by || FactoryUtils.uuid(),
      expires_at: expiresAt.toISOString(),
      used: false,
      status: 'PENDING',
      created_at: timestamp,
      updated_at: timestamp,
      ...overrides
    }
  }

  buildExpired(overrides?: Partial<TestInvitation>): TestInvitation {
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 1) // Expired yesterday
    
    return this.build({
      expires_at: pastDate.toISOString(),
      status: 'FAILED',
      ...overrides
    })
  }

  buildUsed(overrides?: Partial<TestInvitation>): TestInvitation {
    return this.build({
      used: true,
      status: 'RESOLVED',
      ...overrides
    })
  }

  buildForManager(overrides?: Partial<TestInvitation>): TestInvitation {
    return this.build({
      role: 'manager',
      ...overrides
    })
  }

  buildForAdmin(overrides?: Partial<TestInvitation>): TestInvitation {
    return this.build({
      role: 'admin',
      ...overrides
    })
  }
}

export const invitationFactory = new InvitationFactory()