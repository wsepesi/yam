// File upload mock for testing roster uploads and other file operations
import { vi } from 'vitest'

export interface MockFile {
  name: string
  size: number
  type: string
  content: string | ArrayBuffer
  lastModified: number
}

export interface MockFileUploadResult {
  success: boolean
  fileName: string
  fileSize: number
  processedRecords?: number
  errors?: string[]
}

class FileUploadMock {
  private uploadedFiles: MockFile[] = []
  private shouldFailUpload = false
  private processingResults: Map<string, MockFileUploadResult> = new Map()

  // Create mock files for testing
  createMockExcelFile(data: any[]): MockFile {
    return {
      name: 'test-roster.xlsx',
      size: 1024 * 50, // 50KB
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      content: this.createMockExcelContent(data),
      lastModified: Date.now()
    }
  }

  createMockCSVFile(data: any[]): MockFile {
    const csvContent = this.createMockCSVContent(data)
    return {
      name: 'test-roster.csv',
      size: csvContent.length,
      type: 'text/csv',
      content: csvContent,
      lastModified: Date.now()
    }
  }

  createMockInvalidFile(): MockFile {
    return {
      name: 'invalid-file.txt',
      size: 100,
      type: 'text/plain',
      content: 'This is not a valid roster file',
      lastModified: Date.now()
    }
  }

  createMockLargeFile(): MockFile {
    return {
      name: 'large-roster.xlsx',
      size: 1024 * 1024 * 15, // 15MB
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      content: 'mock-large-file-content',
      lastModified: Date.now()
    }
  }

  // File processing simulation
  async processFile(file: MockFile): Promise<MockFileUploadResult> {
    this.uploadedFiles.push(file)

    if (this.shouldFailUpload) {
      return {
        success: false,
        fileName: file.name,
        fileSize: file.size,
        errors: ['Upload failed: Network error']
      }
    }

    // Simulate file processing based on type
    if (file.type.includes('spreadsheet') || file.name.endsWith('.xlsx')) {
      return this.processExcelFile(file)
    } else if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
      return this.processCSVFile(file)
    } else {
      return {
        success: false,
        fileName: file.name,
        fileSize: file.size,
        errors: ['Unsupported file type. Please upload Excel (.xlsx) or CSV files.']
      }
    }
  }

  // Mock Excel file processing
  private processExcelFile(file: MockFile): MockFileUploadResult {
    try {
      const data = this.parseExcelContent(file.content as string)
      return {
        success: true,
        fileName: file.name,
        fileSize: file.size,
        processedRecords: data.length,
        errors: data.length === 0 ? ['No valid records found in file'] : undefined
      }
    } catch (error) {
      return {
        success: false,
        fileName: file.name,
        fileSize: file.size,
        errors: ['Failed to parse Excel file: Invalid format']
      }
    }
  }

  // Mock CSV file processing
  private processCSVFile(file: MockFile): MockFileUploadResult {
    try {
      const data = this.parseCSVContent(file.content as string)
      return {
        success: true,
        fileName: file.name,
        fileSize: file.size,
        processedRecords: data.length,
        errors: data.length === 0 ? ['No valid records found in file'] : undefined
      }
    } catch (error) {
      return {
        success: false,
        fileName: file.name,
        fileSize: file.size,
        errors: ['Failed to parse CSV file: Invalid format']
      }
    }
  }

  // Test data generators
  createValidRosterData(count: number = 10): any[] {
    const data = []
    for (let i = 1; i <= count; i++) {
      data.push({
        First_Name: `Student${i}`,
        Last_Name: `LastName${i}`,
        Default_Email: `student${i}@test.edu`,
        University_ID: String(100000 + i).padStart(6, '0')
      })
    }
    return data
  }

  createInvalidRosterData(): any[] {
    return [
      { First_Name: 'John', Last_Name: '', University_ID: '123456' }, // Missing last name
      { First_Name: '', Last_Name: 'Doe', University_ID: '123457' }, // Missing first name
      { First_Name: 'Jane', Last_Name: 'Smith', University_ID: '' }, // Missing ID
      { First_Name: 'Bob', Last_Name: 'Wilson', University_ID: 'abc123' }, // Invalid ID format
    ]
  }

  createDuplicateRosterData(): any[] {
    return [
      { First_Name: 'John', Last_Name: 'Doe', Default_Email: 'john@test.edu', University_ID: '123456' },
      { First_Name: 'John', Last_Name: 'Doe', Default_Email: 'john@test.edu', University_ID: '123456' }, // Duplicate
      { First_Name: 'Jane', Last_Name: 'Smith', Default_Email: 'jane@test.edu', University_ID: '123457' }
    ]
  }

  // Mock file content creation
  private createMockExcelContent(data: any[]): string {
    return `mock-excel-content-${JSON.stringify(data)}`
  }

  private createMockCSVContent(data: any[]): string {
    if (data.length === 0) return ''
    
    const headers = Object.keys(data[0])
    const csvLines = [
      headers.join(','),
      ...data.map(row => headers.map(h => row[h] || '').join(','))
    ]
    return csvLines.join('\n')
  }

  // Mock parsers
  private parseExcelContent(content: string): any[] {
    if (content.includes('mock-excel-content-')) {
      const jsonStr = content.replace('mock-excel-content-', '')
      return JSON.parse(jsonStr)
    }
    throw new Error('Invalid Excel content')
  }

  private parseCSVContent(content: string): any[] {
    const lines = content.trim().split('\n')
    if (lines.length < 2) return []
    
    const headers = lines[0].split(',')
    return lines.slice(1).map(line => {
      const values = line.split(',')
      const obj: any = {}
      headers.forEach((header, index) => {
        obj[header] = values[index] || ''
      })
      return obj
    })
  }

  // Test utilities
  getUploadedFiles(): MockFile[] {
    return [...this.uploadedFiles]
  }

  getLastUploadedFile(): MockFile | undefined {
    return this.uploadedFiles[this.uploadedFiles.length - 1]
  }

  getUploadCount(): number {
    return this.uploadedFiles.length
  }

  hasUploadedFile(fileName: string): boolean {
    return this.uploadedFiles.some(f => f.name === fileName)
  }

  simulateUploadFailure(): void {
    this.shouldFailUpload = true
  }

  stopUploadFailure(): void {
    this.shouldFailUpload = false
  }

  reset(): void {
    this.uploadedFiles = []
    this.shouldFailUpload = false
    this.processingResults.clear()
  }

  // Validation helpers
  validateFileSize(file: MockFile, maxSizeMB: number = 10): boolean {
    const maxSizeBytes = maxSizeMB * 1024 * 1024
    return file.size <= maxSizeBytes
  }

  validateFileType(file: MockFile, allowedTypes: string[]): boolean {
    return allowedTypes.some(type => 
      file.type === type || file.name.toLowerCase().endsWith(type.replace('application/', '.').replace('text/', '.'))
    )
  }
}

export const mockFileUpload = new FileUploadMock()

// Mock FormData for browser environment
export const createMockFormData = (file: MockFile): FormData => {
  const formData = new FormData()
  const blob = new Blob([file.content], { type: file.type })
  const mockFile = new File([blob], file.name, { type: file.type, lastModified: file.lastModified })
  formData.append('file', mockFile)
  return formData
}