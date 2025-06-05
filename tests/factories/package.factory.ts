// Package factory for test data
import { BaseFactory, FactoryUtils } from './base.factory'

export interface TestPackage {
  id: string
  mailroom_id: string
  staff_id: string
  resident_id: string
  package_id: number
  status: 'WAITING' | 'RETRIEVED' | 'STAFF_RESOLVED' | 'STAFF_REMOVED'
  provider: string
  retrieved_timestamp?: string
  pickup_staff_id?: string
  created_at: string
  updated_at: string
}

export class PackageFactory extends BaseFactory<TestPackage> {
  private static providers = [
    'Amazon', 'UPS', 'FedEx', 'USPS', 'DHL', 'OnTrac', 'LaserShip',
    'Target', 'Walmart', 'Best Buy', 'Chewy', 'Other'
  ]

  build(overrides?: Partial<TestPackage>): TestPackage {
    const timestamp = FactoryUtils.timestamp()
    
    return {
      id: FactoryUtils.uuid(),
      mailroom_id: overrides?.mailroom_id || FactoryUtils.uuid(),
      staff_id: overrides?.staff_id || FactoryUtils.uuid(),
      resident_id: overrides?.resident_id || FactoryUtils.uuid(),
      package_id: overrides?.package_id || FactoryUtils.packageNumber(),
      status: 'WAITING',
      provider: FactoryUtils.randomChoice(PackageFactory.providers),
      created_at: timestamp,
      updated_at: timestamp,
      ...overrides
    }
  }

  buildRetrieved(overrides?: Partial<TestPackage>): TestPackage {
    const retrievedTime = FactoryUtils.timestamp(FactoryUtils.randomInt(0, 5))
    return this.build({
      status: 'RETRIEVED',
      retrieved_timestamp: retrievedTime,
      pickup_staff_id: FactoryUtils.uuid(),
      ...overrides
    })
  }

  buildResolved(overrides?: Partial<TestPackage>): TestPackage {
    return this.build({
      status: 'STAFF_RESOLVED',
      retrieved_timestamp: FactoryUtils.timestamp(FactoryUtils.randomInt(0, 10)),
      pickup_staff_id: FactoryUtils.uuid(),
      ...overrides
    })
  }

  buildRemoved(overrides?: Partial<TestPackage>): TestPackage {
    return this.build({
      status: 'STAFF_REMOVED',
      retrieved_timestamp: FactoryUtils.timestamp(FactoryUtils.randomInt(0, 7)),
      pickup_staff_id: FactoryUtils.uuid(),
      ...overrides
    })
  }

  buildBulk(count: number, mailroomId: string, overrides?: Partial<TestPackage>): TestPackage[] {
    return this.buildMany(count, { mailroom_id: mailroomId, ...overrides })
  }
}

export const packageFactory = new PackageFactory()