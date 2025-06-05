// Organization factory for test data
import { BaseFactory, FactoryUtils } from './base.factory'

export interface TestOrganization {
  id: string
  name: string
  slug: string
  status: 'ACTIVE' | 'DEFUNCT' | 'DEMO'
  notification_email?: string
  notification_email_password?: string
  created_at: string
  updated_at: string
}

export class OrganizationFactory extends BaseFactory<TestOrganization> {
  private static names = [
    'University of California',
    'State University',
    'Tech Institute',
    'Community College',
    'Private University'
  ]

  build(overrides?: Partial<TestOrganization>): TestOrganization {
    const name = overrides?.name || FactoryUtils.randomChoice(OrganizationFactory.names)
    const timestamp = FactoryUtils.timestamp()
    
    return {
      id: FactoryUtils.uuid(),
      name,
      slug: FactoryUtils.slug(name),
      status: 'ACTIVE',
      notification_email: `admin@${FactoryUtils.slug(name)}.edu`,
      notification_email_password: 'test-password',
      created_at: timestamp,
      updated_at: timestamp,
      ...overrides
    }
  }
}

export const organizationFactory = new OrganizationFactory()