// Mailroom factory for test data
import { BaseFactory, FactoryUtils } from './base.factory'

export interface TestMailroom {
  id: string
  name: string
  slug: string
  organization_id: string
  status: 'ACTIVE' | 'DEFUNCT' | 'DEMO'
  admin_email?: string
  mailroom_hours?: object
  email_additional_text?: string
  pickup_option: 'resident_id' | 'resident_name'
  created_by: string
  created_at: string
  updated_at: string
}

export class MailroomFactory extends BaseFactory<TestMailroom> {
  private static names = [
    'Main Mailroom',
    'North Campus Mail',
    'South Campus Mail',
    'Graduate Housing Mail',
    'Undergraduate Mail Center'
  ]

  private static defaultHours = {
    monday: { open: '09:00', close: '17:00' },
    tuesday: { open: '09:00', close: '17:00' },
    wednesday: { open: '09:00', close: '17:00' },
    thursday: { open: '09:00', close: '17:00' },
    friday: { open: '09:00', close: '17:00' },
    saturday: { open: '10:00', close: '14:00' },
    sunday: { closed: true }
  }

  build(overrides?: Partial<TestMailroom>): TestMailroom {
    const name = overrides?.name || FactoryUtils.randomChoice(MailroomFactory.names)
    const timestamp = FactoryUtils.timestamp()
    
    return {
      id: FactoryUtils.uuid(),
      name,
      slug: FactoryUtils.slug(name),
      organization_id: overrides?.organization_id || FactoryUtils.uuid(),
      status: 'ACTIVE',
      admin_email: `mailroom@test.edu`,
      mailroom_hours: MailroomFactory.defaultHours,
      email_additional_text: 'Please bring your student ID when picking up packages.',
      pickup_option: 'resident_id',
      created_by: FactoryUtils.uuid(),
      created_at: timestamp,
      updated_at: timestamp,
      ...overrides
    }
  }
}

export const mailroomFactory = new MailroomFactory()