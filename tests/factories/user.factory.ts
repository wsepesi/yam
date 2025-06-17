// User/Profile factory for test data
import { BaseFactory, FactoryUtils } from './base.factory'

export interface TestUser {
  id: string
  role: 'user' | 'manager' | 'admin' | 'super-admin'
  organization_id?: string | null
  mailroom_id?: string | null
  email: string
  status: 'INVITED' | 'ACTIVE' | 'REMOVED'
  created_at: string
  updated_at: string
}

export class UserFactory extends BaseFactory<TestUser> {
  private static firstNames = [
    'John', 'Jane', 'Michael', 'Sarah', 'David', 'Lisa', 'Chris', 'Emily',
    'Robert', 'Ashley', 'James', 'Jessica', 'Daniel', 'Amanda', 'Mark'
  ]

  private static lastNames = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
    'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez'
  ]

  build(overrides?: Partial<TestUser>): TestUser {
    const firstName = FactoryUtils.randomChoice(UserFactory.firstNames)
    const lastName = FactoryUtils.randomChoice(UserFactory.lastNames)
    const email = FactoryUtils.email(firstName, lastName)
    const timestamp = FactoryUtils.timestamp()
    
    return {
      id: FactoryUtils.uuid(),
      role: 'user',
      organization_id: overrides?.organization_id || FactoryUtils.uuid(),
      mailroom_id: overrides?.mailroom_id || FactoryUtils.uuid(),
      email,
      status: 'ACTIVE',
      created_at: timestamp,
      updated_at: timestamp,
      ...overrides
    }
  }

  buildManager(overrides?: Partial<TestUser>): TestUser {
    return this.build({ role: 'manager', ...overrides })
  }

  buildAdmin(overrides?: Partial<TestUser>): TestUser {
    return this.build({ role: 'admin', ...overrides })
  }

  buildSuperAdmin(overrides?: Partial<TestUser>): TestUser {
    return this.build({ role: 'super-admin', organization_id: null, mailroom_id: null, ...overrides })
  }
}

export const userFactory = new UserFactory()