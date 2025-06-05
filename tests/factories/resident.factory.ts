// Resident factory for test data
import { BaseFactory, FactoryUtils } from './base.factory'

export interface TestResident {
  id: string
  mailroom_id: string
  first_name: string
  last_name: string
  student_id: string
  email?: string
  status: 'ACTIVE' | 'REMOVED_BULK' | 'REMOVED_INDIVIDUAL' | 'ADMIN_ACTION'
  added_by: string
  created_at: string
  updated_at: string
}

export class ResidentFactory extends BaseFactory<TestResident> {
  private static firstNames = [
    'Alex', 'Taylor', 'Jordan', 'Casey', 'Morgan', 'Jamie', 'Riley', 'Avery',
    'Cameron', 'Quinn', 'Sage', 'Parker', 'Blake', 'Drew', 'Hayden', 'Logan',
    'Peyton', 'Reese', 'Skylar', 'Brooklyn', 'Emerson', 'Finley', 'Kendall'
  ]

  private static lastNames = [
    'Anderson', 'Thompson', 'White', 'Harris', 'Martin', 'Jackson', 'Clark',
    'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott',
    'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker'
  ]

  build(overrides?: Partial<TestResident>): TestResident {
    const firstName = FactoryUtils.randomChoice(ResidentFactory.firstNames)
    const lastName = FactoryUtils.randomChoice(ResidentFactory.lastNames)
    const studentId = FactoryUtils.studentId()
    const timestamp = FactoryUtils.timestamp()
    
    return {
      id: FactoryUtils.uuid(),
      mailroom_id: overrides?.mailroom_id || FactoryUtils.uuid(),
      first_name: firstName,
      last_name: lastName,
      student_id: studentId,
      email: FactoryUtils.email(firstName, lastName),
      status: 'ACTIVE',
      added_by: FactoryUtils.uuid(),
      created_at: timestamp,
      updated_at: timestamp,
      ...overrides
    }
  }

  buildWithoutEmail(overrides?: Partial<TestResident>): TestResident {
    return this.build({ email: undefined, ...overrides })
  }

  buildInactive(overrides?: Partial<TestResident>): TestResident {
    return this.build({ status: 'REMOVED_INDIVIDUAL', ...overrides })
  }
}

export const residentFactory = new ResidentFactory()