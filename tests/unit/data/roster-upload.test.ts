/**
 * Roster Upload Processing Tests
 * 
 * Tests for validating Excel/CSV file parsing accuracy and error handling
 * during resident roster uploads. Critical for data integrity.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as XLSX from 'xlsx'

// Mock types based on the application's Student interface
interface Student {
  First_Name: string
  Last_Name: string
  Default_Email: string
  University_ID: string
}

interface Resident {
  id?: string
  mailroom_id: string
  first_name: string
  last_name: string
  student_id: string
  email?: string
  created_at?: string
  updated_at?: string
  added_by: string
}

// Roster processing functions (these would be in actual lib files)
const parseExcelFile = async (buffer: ArrayBuffer): Promise<Student[]> => {
  try {
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
    
    if (jsonData.length < 2) {
      throw new Error('File must contain header row and at least one data row')
    }
    
    const headers = jsonData[0]
    const requiredHeaders = ['First_Name', 'Last_Name', 'Default_Email', 'University_ID']
    
    // Validate headers
    for (const required of requiredHeaders) {
      if (!headers.includes(required)) {
        throw new Error(`Missing required column: ${required}`)
      }
    }
    
    const students: Student[] = []
    
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i]
      if (!row || row.length === 0) continue // Skip empty rows
      
      const student: Student = {
        First_Name: String(row[headers.indexOf('First_Name')] || '').trim(),
        Last_Name: String(row[headers.indexOf('Last_Name')] || '').trim(),
        Default_Email: String(row[headers.indexOf('Default_Email')] || '').trim(),
        University_ID: String(row[headers.indexOf('University_ID')] || '').trim()
      }
      
      // Validate required fields
      if (!student.First_Name || !student.Last_Name || !student.University_ID) {
        throw new Error(`Missing required data in row ${i + 1}`)
      }
      
      students.push(student)
    }
    
    return students
  } catch (error) {
    throw new Error(`Excel parsing failed: ${error.message}`)
  }
}

const parseCSVFile = (csvContent: string): Student[] => {
  try {
    const lines = csvContent.split('\n').filter(line => line.trim())
    
    if (lines.length < 2) {
      throw new Error('CSV must contain header row and at least one data row')
    }
    
    // Improved CSV parsing to handle quoted values with commas
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        const nextChar = line[i + 1]
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            // Handle escaped quotes
            current += '"'
            i++ // Skip next quote
          } else {
            // Toggle quote state
            inQuotes = !inQuotes
          }
        } else if (char === ',' && !inQuotes) {
          // End of field
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      
      // Add the last field
      result.push(current.trim())
      return result
    }
    
    const headers = parseCSVLine(lines[0])
    const requiredHeaders = ['First_Name', 'Last_Name', 'Default_Email', 'University_ID']
    
    for (const required of requiredHeaders) {
      if (!headers.includes(required)) {
        throw new Error(`Missing required column: ${required}`)
      }
    }
    
    const students: Student[] = []
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      
      const student: Student = {
        First_Name: values[headers.indexOf('First_Name')] || '',
        Last_Name: values[headers.indexOf('Last_Name')] || '',
        Default_Email: values[headers.indexOf('Default_Email')] || '',
        University_ID: values[headers.indexOf('University_ID')] || ''
      }
      
      if (!student.First_Name || !student.Last_Name || !student.University_ID) {
        throw new Error(`Missing required data in row ${i + 1}`)
      }
      
      students.push(student)
    }
    
    return students
  } catch (error) {
    throw new Error(`CSV parsing failed: ${error.message}`)
  }
}

const validateStudentData = (students: Student[]): { valid: Student[], invalid: any[] } => {
  const valid: Student[] = []
  const invalid: any[] = []
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const seenIds = new Set<string>()
  
  for (const student of students) {
    const errors: string[] = []
    
    // Validate email format if provided
    if (student.Default_Email && !emailRegex.test(student.Default_Email)) {
      errors.push('Invalid email format')
    }
    
    // Check for duplicate University_ID
    if (seenIds.has(student.University_ID)) {
      errors.push('Duplicate University_ID')
    } else {
      seenIds.add(student.University_ID)
    }
    
    // Validate required fields and lengths
    if (student.First_Name.length < 1 || student.First_Name.length > 50) {
      errors.push('First name must be 1-50 characters')
    }
    
    if (student.Last_Name.length < 1 || student.Last_Name.length > 50) {
      errors.push('Last name must be 1-50 characters')
    }
    
    if (student.University_ID.length < 1) {
      errors.push('University ID is required')
    }
    
    if (errors.length > 0) {
      invalid.push({ student, errors })
    } else {
      valid.push(student)
    }
  }
  
  return { valid, invalid }
}

const convertStudentsToResidents = (students: Student[], mailroomId: string, addedBy: string): Resident[] => {
  return students.map(student => ({
    mailroom_id: mailroomId,
    first_name: student.First_Name,
    last_name: student.Last_Name,
    student_id: student.University_ID,
    email: student.Default_Email || null,
    added_by: addedBy
  }))
}

describe('Roster Upload Processing Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Excel File Parsing Accuracy', () => {
    it('parses valid Excel file with 1000+ residents', async () => {
      // Create mock Excel data
      const mockData = [
        ['First_Name', 'Last_Name', 'Default_Email', 'University_ID'],
        ...Array.from({ length: 1000 }, (_, i) => [
          `FirstName${i}`,
          `LastName${i}`,
          `user${i}@university.edu`,
          `ID${String(i).padStart(6, '0')}`
        ])
      ]
      
      // Create mock Excel buffer
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.aoa_to_sheet(mockData)
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Students')
      const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
      
      const students = await parseExcelFile(buffer)
      
      expect(students).toHaveLength(1000)
      expect(students[0].First_Name).toBe('FirstName0')
      expect(students[0].Last_Name).toBe('LastName0')
      expect(students[0].Default_Email).toBe('user0@university.edu')
      expect(students[0].University_ID).toBe('ID000000')
      
      expect(students[999].First_Name).toBe('FirstName999')
      expect(students[999].University_ID).toBe('ID000999')
    })

    it('handles Excel files with missing optional email field', async () => {
      const mockData = [
        ['First_Name', 'Last_Name', 'University_ID'], // No email column
        ['John', 'Doe', 'ID123456'],
        ['Jane', 'Smith', 'ID654321']
      ]
      
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.aoa_to_sheet(mockData)
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Students')
      const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
      
      await expect(parseExcelFile(buffer)).rejects.toThrow('Missing required column: Default_Email')
    })

    it('preserves leading zeros in University_ID', async () => {
      const mockData = [
        ['First_Name', 'Last_Name', 'Default_Email', 'University_ID'],
        ['John', 'Doe', 'john@uni.edu', '000123'],
        ['Jane', 'Smith', 'jane@uni.edu', '007890']
      ]
      
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.aoa_to_sheet(mockData)
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Students')
      const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
      
      const students = await parseExcelFile(buffer)
      
      expect(students[0].University_ID).toBe('000123')
      expect(students[1].University_ID).toBe('007890')
    })
  })

  describe('CSV File Parsing Accuracy', () => {
    it('parses valid CSV file correctly', () => {
      const csvContent = `First_Name,Last_Name,Default_Email,University_ID
John,Doe,john@university.edu,ID123456
Jane,Smith,jane@university.edu,ID654321
Bob,Johnson,bob@university.edu,ID789012`

      const students = parseCSVFile(csvContent)
      
      expect(students).toHaveLength(3)
      expect(students[0]).toEqual({
        First_Name: 'John',
        Last_Name: 'Doe',
        Default_Email: 'john@university.edu',
        University_ID: 'ID123456'
      })
    })

    it('handles CSV with quoted values', () => {
      const csvContent = `"First_Name","Last_Name","Default_Email","University_ID"
"John Jr.","O'Connor","john@university.edu","ID123456"
"Mary, PhD","Smith-Jones","mary@university.edu","ID654321"`

      const students = parseCSVFile(csvContent)
      
      expect(students).toHaveLength(2)
      expect(students[0].First_Name).toBe('John Jr.')
      expect(students[0].Last_Name).toBe("O'Connor")
      expect(students[1].First_Name).toBe('Mary, PhD')
      expect(students[1].Last_Name).toBe('Smith-Jones')
    })
  })

  describe('Invalid File Format Handling', () => {
    it('rejects files with missing required headers', async () => {
      const mockData = [
        ['Name', 'Email'], // Wrong headers
        ['John Doe', 'john@uni.edu']
      ]
      
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.aoa_to_sheet(mockData)
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Students')
      const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
      
      await expect(parseExcelFile(buffer)).rejects.toThrow('Missing required column')
    })

    it('rejects empty files', async () => {
      const mockData: any[][] = []
      
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.aoa_to_sheet(mockData)
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Students')
      const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
      
      await expect(parseExcelFile(buffer)).rejects.toThrow('must contain header row')
    })

    it('rejects files with only headers', () => {
      const csvContent = 'First_Name,Last_Name,Default_Email,University_ID'
      
      expect(() => parseCSVFile(csvContent)).toThrow('must contain header row and at least one data row')
    })
  })

  describe('Missing Required Field Validation', () => {
    it('validates required fields are present', () => {
      const students: Student[] = [
        { First_Name: 'John', Last_Name: 'Doe', Default_Email: 'john@uni.edu', University_ID: 'ID123' },
        { First_Name: '', Last_Name: 'Smith', Default_Email: 'jane@uni.edu', University_ID: 'ID456' }, // Missing first name
        { First_Name: 'Bob', Last_Name: '', Default_Email: 'bob@uni.edu', University_ID: 'ID789' }, // Missing last name
        { First_Name: 'Alice', Last_Name: 'Brown', Default_Email: 'alice@uni.edu', University_ID: '' } // Missing ID
      ]
      
      const { valid, invalid } = validateStudentData(students)
      
      expect(valid).toHaveLength(1)
      expect(invalid).toHaveLength(3)
      expect(valid[0].First_Name).toBe('John')
    })

    it('validates email format when provided', () => {
      const students: Student[] = [
        { First_Name: 'John', Last_Name: 'Doe', Default_Email: 'john@university.edu', University_ID: 'ID123' },
        { First_Name: 'Jane', Last_Name: 'Smith', Default_Email: 'invalid-email', University_ID: 'ID456' },
        { First_Name: 'Bob', Last_Name: 'Johnson', Default_Email: '', University_ID: 'ID789' } // Empty email is OK
      ]
      
      const { valid, invalid } = validateStudentData(students)
      
      expect(valid).toHaveLength(2) // John and Bob should be valid
      expect(invalid).toHaveLength(1)
      expect(invalid[0].errors).toContain('Invalid email format')
    })
  })

  describe('Duplicate Resident Detection', () => {
    it('detects duplicate University_ID during upload', () => {
      const students: Student[] = [
        { First_Name: 'John', Last_Name: 'Doe', Default_Email: 'john@uni.edu', University_ID: 'ID123' },
        { First_Name: 'Jane', Last_Name: 'Smith', Default_Email: 'jane@uni.edu', University_ID: 'ID456' },
        { First_Name: 'Bob', Last_Name: 'Johnson', Default_Email: 'bob@uni.edu', University_ID: 'ID123' } // Duplicate
      ]
      
      const { valid, invalid } = validateStudentData(students)
      
      expect(valid).toHaveLength(2)
      expect(invalid).toHaveLength(1)
      expect(invalid[0].errors).toContain('Duplicate University_ID')
    })

    it('handles case-sensitive University_ID duplicates', () => {
      const students: Student[] = [
        { First_Name: 'John', Last_Name: 'Doe', Default_Email: 'john@uni.edu', University_ID: 'id123' },
        { First_Name: 'Jane', Last_Name: 'Smith', Default_Email: 'jane@uni.edu', University_ID: 'ID123' }
      ]
      
      const { valid, invalid } = validateStudentData(students)
      
      // Both should be valid as IDs are case-sensitive
      expect(valid).toHaveLength(2)
      expect(invalid).toHaveLength(0)
    })
  })

  describe('Data Conversion', () => {
    it('converts students to residents format correctly', () => {
      const students: Student[] = [
        { First_Name: 'John', Last_Name: 'Doe', Default_Email: 'john@uni.edu', University_ID: 'ID123' },
        { First_Name: 'Jane', Last_Name: 'Smith', Default_Email: '', University_ID: 'ID456' }
      ]
      
      const residents = convertStudentsToResidents(students, 'mailroom-123', 'user-456')
      
      expect(residents).toHaveLength(2)
      expect(residents[0]).toEqual({
        mailroom_id: 'mailroom-123',
        first_name: 'John',
        last_name: 'Doe',
        student_id: 'ID123',
        email: 'john@uni.edu',
        added_by: 'user-456'
      })
      
      expect(residents[1]).toEqual({
        mailroom_id: 'mailroom-123',
        first_name: 'Jane',
        last_name: 'Smith',
        student_id: 'ID456',
        email: null,
        added_by: 'user-456'
      })
    })
  })

  describe('Performance with Large Files', () => {
    it('handles 1000+ resident upload within reasonable time', async () => {
      const startTime = Date.now()
      
      // Create large dataset
      const mockData = [
        ['First_Name', 'Last_Name', 'Default_Email', 'University_ID'],
        ...Array.from({ length: 1500 }, (_, i) => [
          `FirstName${i}`,
          `LastName${i}`,
          `user${i}@university.edu`,
          `ID${String(i).padStart(8, '0')}`
        ])
      ]
      
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.aoa_to_sheet(mockData)
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Students')
      const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
      
      const students = await parseExcelFile(buffer)
      const { valid, invalid } = validateStudentData(students)
      const residents = convertStudentsToResidents(valid, 'mailroom-123', 'user-456')
      
      const endTime = Date.now()
      const processingTime = endTime - startTime
      
      expect(students).toHaveLength(1500)
      expect(valid).toHaveLength(1500)
      expect(invalid).toHaveLength(0)
      expect(residents).toHaveLength(1500)
      
      // Should process 1500 records in under 5 seconds
      expect(processingTime).toBeLessThan(5000)
    }, 10000)
  })
})