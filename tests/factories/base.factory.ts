// Base factory utilities for test data generation
import { v4 as uuidv4 } from 'uuid'

export interface FactoryOptions<T> {
  overrides?: Partial<T>
  count?: number
}

export abstract class BaseFactory<T> {
  abstract build(overrides?: Partial<T>): T
  
  buildMany(count: number, overrides?: Partial<T>): T[] {
    return Array.from({ length: count }, () => this.build(overrides))
  }
  
  create(options?: FactoryOptions<T>): T | T[] {
    const { overrides, count } = options || {}
    
    if (count && count > 1) {
      return this.buildMany(count, overrides)
    }
    
    return this.build(overrides)
  }
}

// Utility functions for generating realistic test data
export const FactoryUtils = {
  uuid: () => uuidv4(),
  
  timestamp: (daysAgo = 0) => {
    const date = new Date()
    date.setDate(date.getDate() - daysAgo)
    return date.toISOString()
  },
  
  randomChoice: <T>(array: T[]): T => {
    return array[Math.floor(Math.random() * array.length)]
  },
  
  randomInt: (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min + 1)) + min
  },
  
  email: (firstName: string, lastName: string, domain = 'test.edu') => {
    return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`
  },
  
  slug: (name: string) => {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  },
  
  studentId: () => {
    return String(FactoryUtils.randomInt(100000, 999999))
  },
  
  packageNumber: () => {
    return FactoryUtils.randomInt(1, 999)
  }
}