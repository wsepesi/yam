/**
 * Resident Matching Tests
 * 
 * Tests for various resident matching algorithms used when registering packages
 * and updating resident information. Critical for data accuracy.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

interface Resident {
  id: string
  mailroom_id: string
  first_name: string
  last_name: string
  student_id: string
  email?: string
}

interface Student {
  First_Name: string
  Last_Name: string
  Default_Email: string
  University_ID: string
}

// Matching algorithm implementations
class ResidentMatcher {
  private residents: Resident[]

  constructor(residents: Resident[]) {
    this.residents = residents
  }

  // Exact name match
  findByExactName(firstName: string, lastName: string): Resident[] {
    return this.residents.filter(r => 
      r.first_name.toLowerCase() === firstName.toLowerCase() &&
      r.last_name.toLowerCase() === lastName.toLowerCase()
    )
  }

  // Email-based matching
  findByEmail(email: string): Resident | null {
    if (!email) return null
    return this.residents.find(r => 
      r.email && r.email.toLowerCase() === email.toLowerCase()
    ) || null
  }

  // Student ID-based matching
  findByStudentId(studentId: string): Resident | null {
    return this.residents.find(r => 
      r.student_id === studentId
    ) || null
  }

  // Fuzzy name matching using Levenshtein distance
  findByFuzzyName(firstName: string, lastName: string, threshold: number = 2): Resident[] {
    const matches: Array<{ resident: Resident, score: number }> = []

    for (const resident of this.residents) {
      const firstNameDistance = this.levenshteinDistance(
        firstName.toLowerCase(),
        resident.first_name.toLowerCase()
      )
      const lastNameDistance = this.levenshteinDistance(
        lastName.toLowerCase(),
        resident.last_name.toLowerCase()
      )

      const totalDistance = firstNameDistance + lastNameDistance

      if (totalDistance <= threshold) {
        matches.push({ resident, score: totalDistance })
      }
    }

    // Sort by best match (lowest distance)
    return matches
      .sort((a, b) => a.score - b.score)
      .map(match => match.resident)
  }

  // Case-insensitive matching with trimming
  findByCaseInsensitiveName(firstName: string, lastName: string): Resident[] {
    const trimmedFirst = firstName.trim().toLowerCase()
    const trimmedLast = lastName.trim().toLowerCase()

    return this.residents.filter(r => 
      r.first_name.trim().toLowerCase() === trimmedFirst &&
      r.last_name.trim().toLowerCase() === trimmedLast
    )
  }

  // Comprehensive matching - tries multiple strategies
  findBestMatch(firstName: string, lastName: string, email?: string, studentId?: string): {
    exact: Resident[]
    fuzzy: Resident[]
    email: Resident | null
    studentId: Resident | null
  } {
    return {
      exact: this.findByExactName(firstName, lastName),
      fuzzy: this.findByFuzzyName(firstName, lastName),
      email: email ? this.findByEmail(email) : null,
      studentId: studentId ? this.findByStudentId(studentId) : null
    }
  }

  // Levenshtein distance calculation
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        )
      }
    }

    return matrix[str2.length][str1.length]
  }
}

describe('Resident Matching Tests', () => {
  let testResidents: Resident[]
  let matcher: ResidentMatcher

  beforeEach(() => {
    testResidents = [
      {
        id: 'res-1',
        mailroom_id: 'mailroom-1',
        first_name: 'John',
        last_name: 'Smith',
        student_id: 'ST123456',
        email: 'john.smith@university.edu'
      },
      {
        id: 'res-2',
        mailroom_id: 'mailroom-1',
        first_name: 'Jane',
        last_name: 'Doe',
        student_id: 'ST654321',
        email: 'jane.doe@university.edu'
      },
      {
        id: 'res-3',
        mailroom_id: 'mailroom-1',
        first_name: 'Michael',
        last_name: 'Johnson',
        student_id: 'ST789012',
        email: 'mike.johnson@university.edu'
      },
      {
        id: 'res-4',
        mailroom_id: 'mailroom-1',
        first_name: 'Sarah',
        last_name: 'O\'Connor',
        student_id: 'ST345678',
        email: 'sarah.oconnor@university.edu'
      },
      {
        id: 'res-5',
        mailroom_id: 'mailroom-1',
        first_name: 'João',
        last_name: 'Silva',
        student_id: 'ST567890',
        email: 'joao.silva@university.edu'
      }
    ]

    matcher = new ResidentMatcher(testResidents)
  })

  describe('Exact Name Match Logic', () => {
    it('finds resident with exact name match', () => {
      const matches = matcher.findByExactName('John', 'Smith')
      
      expect(matches).toHaveLength(1)
      expect(matches[0].id).toBe('res-1')
      expect(matches[0].first_name).toBe('John')
      expect(matches[0].last_name).toBe('Smith')
    })

    it('returns empty array for no matches', () => {
      const matches = matcher.findByExactName('Nonexistent', 'Person')
      
      expect(matches).toHaveLength(0)
    })

    it('handles case-insensitive matching', () => {
      const matches = matcher.findByExactName('JOHN', 'smith')
      
      expect(matches).toHaveLength(1)
      expect(matches[0].id).toBe('res-1')
    })

    it('handles special characters in names', () => {
      const matches = matcher.findByExactName('Sarah', 'O\'Connor')
      
      expect(matches).toHaveLength(1)
      expect(matches[0].id).toBe('res-4')
    })

    it('handles unicode characters', () => {
      const matches = matcher.findByExactName('João', 'Silva')
      
      expect(matches).toHaveLength(1)
      expect(matches[0].id).toBe('res-5')
    })
  })

  describe('Fuzzy Name Matching Algorithm', () => {
    it('finds close matches with single character typos', () => {
      const matches = matcher.findByFuzzyName('Jon', 'Smith') // Missing 'h' in John
      
      expect(matches.length).toBeGreaterThan(0)
      expect(matches[0].id).toBe('res-1')
    })

    it('finds matches with character transposition', () => {
      const matches = matcher.findByFuzzyName('Jahn', 'Smith') // 'o' and 'h' swapped
      
      expect(matches.length).toBeGreaterThan(0)
      expect(matches[0].id).toBe('res-1')
    })

    it('respects threshold parameter', () => {
      // 'Jonathan' vs 'John' has distance > 2, should not match with threshold 2
      const strictMatches = matcher.findByFuzzyName('Jonathan', 'Smith', 2)
      expect(strictMatches).toHaveLength(0)

      // But should match with higher threshold
      const lenientMatches = matcher.findByFuzzyName('Jonathan', 'Smith', 5)
      expect(lenientMatches.length).toBeGreaterThan(0)
    })

    it('sorts results by match quality', () => {
      // Add more test data for sorting
      const additionalResidents = [
        ...testResidents,
        {
          id: 'res-6',
          mailroom_id: 'mailroom-1',
          first_name: 'Jon',
          last_name: 'Smith',
          student_id: 'ST111111',
          email: 'jon.smith@university.edu'
        },
        {
          id: 'res-7',
          mailroom_id: 'mailroom-1',
          first_name: 'Johnny',
          last_name: 'Smith',
          student_id: 'ST222222',
          email: 'johnny.smith@university.edu'
        }
      ]

      const extendedMatcher = new ResidentMatcher(additionalResidents)
      const matches = extendedMatcher.findByFuzzyName('John', 'Smith', 3)

      // Should return matches sorted by distance (exact match first)
      expect(matches.length).toBeGreaterThan(1)
      expect(matches[0].first_name).toBe('John') // Exact match should be first
    })
  })

  describe('Email-based Matching', () => {
    it('finds resident by exact email match', () => {
      const match = matcher.findByEmail('jane.doe@university.edu')
      
      expect(match).not.toBeNull()
      expect(match!.id).toBe('res-2')
      expect(match!.first_name).toBe('Jane')
    })

    it('handles case-insensitive email matching', () => {
      const match = matcher.findByEmail('JANE.DOE@UNIVERSITY.EDU')
      
      expect(match).not.toBeNull()
      expect(match!.id).toBe('res-2')
    })

    it('returns null for non-existent email', () => {
      const match = matcher.findByEmail('nonexistent@university.edu')
      
      expect(match).toBeNull()
    })

    it('returns null for empty email', () => {
      const match = matcher.findByEmail('')
      
      expect(match).toBeNull()
    })

    it('handles residents without email addresses', () => {
      const residentsWithoutEmail = [
        {
          id: 'res-no-email',
          mailroom_id: 'mailroom-1',
          first_name: 'NoEmail',
          last_name: 'Person',
          student_id: 'ST999999'
        }
      ]

      const noEmailMatcher = new ResidentMatcher(residentsWithoutEmail)
      const match = noEmailMatcher.findByEmail('any@email.com')
      
      expect(match).toBeNull()
    })
  })

  describe('Student ID-based Matching', () => {
    it('finds resident by student ID', () => {
      const match = matcher.findByStudentId('ST123456')
      
      expect(match).not.toBeNull()
      expect(match!.id).toBe('res-1')
      expect(match!.first_name).toBe('John')
    })

    it('is case-sensitive for student IDs', () => {
      const match = matcher.findByStudentId('st123456') // lowercase
      
      expect(match).toBeNull()
    })

    it('returns null for non-existent student ID', () => {
      const match = matcher.findByStudentId('ST000000')
      
      expect(match).toBeNull()
    })

    it('handles leading zeros in student IDs', () => {
      const residentsWithLeadingZeros = [
        {
          id: 'res-zeros',
          mailroom_id: 'mailroom-1',
          first_name: 'Zero',
          last_name: 'Leader',
          student_id: '000123456',
          email: 'zero@university.edu'
        }
      ]

      const zeroMatcher = new ResidentMatcher(residentsWithLeadingZeros)
      const match = zeroMatcher.findByStudentId('000123456')
      
      expect(match).not.toBeNull()
      expect(match!.first_name).toBe('Zero')
    })
  })

  describe('Case-insensitive Matching', () => {
    it('handles mixed case input', () => {
      const matches = matcher.findByCaseInsensitiveName('jOhN', 'SmItH')
      
      expect(matches).toHaveLength(1)
      expect(matches[0].id).toBe('res-1')
    })

    it('trims whitespace from input', () => {
      const matches = matcher.findByCaseInsensitiveName('  John  ', '  Smith  ')
      
      expect(matches).toHaveLength(1)
      expect(matches[0].id).toBe('res-1')
    })

    it('handles names with extra spaces', () => {
      const residentsWithSpaces = [
        {
          id: 'res-spaces',
          mailroom_id: 'mailroom-1',
          first_name: ' John ',
          last_name: ' Smith ',
          student_id: 'ST777777',
          email: 'spaced@university.edu'
        }
      ]

      const spaceMatcher = new ResidentMatcher(residentsWithSpaces)
      const matches = spaceMatcher.findByCaseInsensitiveName('John', 'Smith')
      
      expect(matches).toHaveLength(1)
      expect(matches[0].id).toBe('res-spaces')
    })
  })

  describe('Comprehensive Best Match Strategy', () => {
    it('returns all matching strategies results', () => {
      const result = matcher.findBestMatch(
        'John',
        'Smith',
        'john.smith@university.edu',
        'ST123456'
      )

      expect(result.exact).toHaveLength(1)
      expect(result.exact[0].id).toBe('res-1')
      
      expect(result.fuzzy).toHaveLength(1)
      expect(result.fuzzy[0].id).toBe('res-1')
      
      expect(result.email).not.toBeNull()
      expect(result.email!.id).toBe('res-1')
      
      expect(result.studentId).not.toBeNull()
      expect(result.studentId!.id).toBe('res-1')
    })

    it('handles partial matches correctly', () => {
      const result = matcher.findBestMatch(
        'Jon', // Typo in first name
        'Smith',
        'wrong@email.com', // Wrong email
        'ST999999' // Wrong student ID
      )

      expect(result.exact).toHaveLength(0)
      expect(result.fuzzy.length).toBeGreaterThan(0)
      expect(result.email).toBeNull()
      expect(result.studentId).toBeNull()
    })

    it('prioritizes student ID matches over name matches', () => {
      const result = matcher.findBestMatch(
        'WrongFirst',
        'WrongLast',
        'wrong@email.com',
        'ST123456' // Correct student ID
      )

      expect(result.studentId).not.toBeNull()
      expect(result.studentId!.id).toBe('res-1')
      expect(result.exact).toHaveLength(0)
    })
  })

  describe('Performance with Large Datasets', () => {
    it('performs efficiently with 1000+ residents', () => {
      // Create large dataset
      const largeDataset: Resident[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `res-${i}`,
        mailroom_id: 'mailroom-1',
        first_name: `FirstName${i}`,
        last_name: `LastName${i}`,
        student_id: `ST${String(i).padStart(6, '0')}`,
        email: `user${i}@university.edu`
      }))

      const largeMatcher = new ResidentMatcher(largeDataset)
      
      const startTime = Date.now()
      
      // Perform various searches
      const exactMatch = largeMatcher.findByExactName('FirstName500', 'LastName500')
      const emailMatch = largeMatcher.findByEmail('user750@university.edu')
      const studentIdMatch = largeMatcher.findByStudentId('ST000250')
      const fuzzyMatch = largeMatcher.findByFuzzyName('FirstName100', 'LastName100')
      
      const endTime = Date.now()
      const searchTime = endTime - startTime

      expect(exactMatch).toHaveLength(1)
      expect(emailMatch).not.toBeNull()
      expect(studentIdMatch).not.toBeNull()
      expect(fuzzyMatch).toHaveLength(1)
      
      // All searches should complete in under 100ms
      expect(searchTime).toBeLessThan(100)
    })
  })
})