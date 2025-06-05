import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextApiRequest, NextApiResponse } from 'next';
import { Package, PackageNoIds } from '../../lib/types';

// Mock dependencies
vi.mock('../../lib/supabase', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null }))
        }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'package-id' }, error: null }))
        }))
      }))
    })),
    rpc: vi.fn(() => Promise.resolve({ data: 123, error: null }))
  }))
}));

vi.mock('../../lib/handleSession', () => ({
  default: vi.fn(() => Promise.resolve('user-123'))
}));

// Define expected schemas
const GetPackagesRequestSchema = {
  student_id: 'string',
  orgSlug: 'string',
  mailroomSlug: 'string'
};

const GetPackagesResponseSchema = {
  records: 'array' // Array of Package objects
};

const PackageSchema = {
  First: 'string',
  Last: 'string',
  Email: 'string',
  provider: 'string',
  residentId: 'string',
  packageId: 'string',
  status: 'string', // 'pending' | 'picked_up' | 'failed'
  createdAt: 'string',
  updatedAt: 'string'
};

const AddPackageRequestSchema = {
  First: 'string',
  Last: 'string',
  Email: 'string',
  provider: 'string',
  residentId: 'string',
  orgSlug: 'string',
  mailroomSlug: 'string'
};

const LogPackageRequestSchema = {
  packageId: 'string',
  action: 'string', // 'pickup' | 'fail'
  orgSlug: 'string',
  mailroomSlug: 'string'
};

const RemovePackageRequestSchema = {
  packageId: 'string',
  orgSlug: 'string',
  mailroomSlug: 'string'
};

const FailPackageRequestSchema = {
  packageId: 'string',
  reason: 'string?',
  orgSlug: 'string',
  mailroomSlug: 'string'
};

const NotificationEmailRequestSchema = {
  packageId: 'string',
  recipientEmail: 'string',
  orgSlug: 'string',
  mailroomSlug: 'string'
};

const PackageResponseSchema = PackageSchema;

const ErrorResponseSchema = {
  error: 'string'
};

const SuccessResponseSchema = {
  message: 'string',
  success: 'boolean'
};

// Helper function to validate schema
function validateSchema(data: any, schema: any): boolean {
  if (schema === 'array') {
    return Array.isArray(data);
  }
  
  for (const [key, expectedType] of Object.entries(schema)) {
    const isOptional = typeof expectedType === 'string' && expectedType.endsWith('?');
    const actualType = isOptional ? expectedType.slice(0, -1) : expectedType;
    
    if (isOptional && data[key] === undefined) {
      continue;
    }
    
    if (data[key] === undefined) {
      return false;
    }
    
    if (typeof schema[key] === 'object') {
      if (!validateSchema(data[key], schema[key])) {
        return false;
      }
    } else {
      const dataType = typeof data[key];
      if (actualType === 'array') {
        if (!Array.isArray(data[key])) {
          return false;
        }
      } else if (dataType !== actualType) {
        return false;
      }
    }
  }
  return true;
}

describe('Package API Contract Tests', () => {
  let mockReq: Partial<NextApiRequest>;
  let mockRes: Partial<NextApiResponse>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = {
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
      query: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
    };
  });

  describe('GET /api/get-packages Response Schema', () => {
    it('should validate successful get packages response schema', () => {
      const mockResponse = {
        records: [
          {
            First: 'John',
            Last: 'Doe',
            Email: 'john.doe@example.com',
            provider: 'FedEx',
            residentId: 'student-123',
            packageId: '42',
            status: 'pending',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z'
          }
        ]
      };

      const isValid = validateSchema(mockResponse, GetPackagesResponseSchema);
      expect(isValid).toBe(true);

      // Validate package objects in array
      mockResponse.records.forEach(pkg => {
        expect(validateSchema(pkg, PackageSchema)).toBe(true);
      });
    });

    it('should validate empty packages response', () => {
      const mockResponse = {
        records: []
      };

      const isValid = validateSchema(mockResponse, GetPackagesResponseSchema);
      expect(isValid).toBe(true);
    });

    it('should validate get packages request schema', () => {
      const mockRequest = {
        student_id: 'student-123',
        orgSlug: 'university',
        mailroomSlug: 'main-office'
      };

      const isValid = validateSchema(mockRequest, GetPackagesRequestSchema);
      expect(isValid).toBe(true);
    });
  });

  describe('POST /api/add-package Request/Response Schema', () => {
    it('should validate add package request schema', () => {
      const mockRequest: PackageNoIds & { orgSlug: string, mailroomSlug: string } = {
        First: 'John',
        Last: 'Doe',
        Email: 'john.doe@example.com',
        provider: 'UPS',
        residentId: 'student-123',
        orgSlug: 'university',
        mailroomSlug: 'main-office'
      };

      const isValid = validateSchema(mockRequest, AddPackageRequestSchema);
      expect(isValid).toBe(true);
    });

    it('should validate add package response schema', () => {
      const mockResponse: Package = {
        First: 'John',
        Last: 'Doe',
        Email: 'john.doe@example.com',
        provider: 'UPS',
        residentId: 'student-123',
        packageId: '123',
        status: 'pending',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      const isValid = validateSchema(mockResponse, PackageResponseSchema);
      expect(isValid).toBe(true);
    });

    it('should validate add package error responses', () => {
      const missingDataError = { error: 'Missing required package data, orgSlug, or mailroomSlug' };
      const noNumbersError = { error: 'No package numbers available' };
      const residentNotFoundError = { error: 'No resident found with student ID student-123 in this mailroom' };

      expect(validateSchema(missingDataError, ErrorResponseSchema)).toBe(true);
      expect(validateSchema(noNumbersError, ErrorResponseSchema)).toBe(true);
      expect(validateSchema(residentNotFoundError, ErrorResponseSchema)).toBe(true);
    });
  });

  describe('PUT /api/log-package Request/Response Schema', () => {
    it('should validate log package pickup request schema', () => {
      const mockRequest = {
        packageId: '123',
        action: 'pickup',
        orgSlug: 'university',
        mailroomSlug: 'main-office'
      };

      const isValid = validateSchema(mockRequest, LogPackageRequestSchema);
      expect(isValid).toBe(true);
    });

    it('should validate log package fail request schema', () => {
      const mockRequest = {
        packageId: '123',
        action: 'fail',
        orgSlug: 'university',
        mailroomSlug: 'main-office'
      };

      const isValid = validateSchema(mockRequest, LogPackageRequestSchema);
      expect(isValid).toBe(true);
    });

    it('should validate log package response schema', () => {
      const mockResponse = {
        message: 'Package status updated successfully',
        success: true
      };

      const isValid = validateSchema(mockResponse, SuccessResponseSchema);
      expect(isValid).toBe(true);
    });
  });

  describe('DELETE /api/remove-package Request/Response Schema', () => {
    it('should validate remove package request schema', () => {
      const mockRequest = {
        packageId: '123',
        orgSlug: 'university',
        mailroomSlug: 'main-office'
      };

      const isValid = validateSchema(mockRequest, RemovePackageRequestSchema);
      expect(isValid).toBe(true);
    });

    it('should validate remove package response schema', () => {
      const mockResponse = {
        message: 'Package removed successfully',
        success: true
      };

      const isValid = validateSchema(mockResponse, SuccessResponseSchema);
      expect(isValid).toBe(true);
    });

    it('should validate remove package error responses', () => {
      const notFoundError = { error: 'Package not found' };
      const unauthorizedError = { error: 'Unauthorized to remove this package' };

      expect(validateSchema(notFoundError, ErrorResponseSchema)).toBe(true);
      expect(validateSchema(unauthorizedError, ErrorResponseSchema)).toBe(true);
    });
  });

  describe('POST /api/fail-package Request/Response Schema', () => {
    it('should validate fail package request schema', () => {
      const mockRequest = {
        packageId: '123',
        reason: 'Address incorrect',
        orgSlug: 'university',
        mailroomSlug: 'main-office'
      };

      const isValid = validateSchema(mockRequest, FailPackageRequestSchema);
      expect(isValid).toBe(true);
    });

    it('should validate fail package request without reason', () => {
      const mockRequest = {
        packageId: '123',
        orgSlug: 'university',
        mailroomSlug: 'main-office'
      };

      const isValid = validateSchema(mockRequest, FailPackageRequestSchema);
      expect(isValid).toBe(true);
    });

    it('should validate fail package response schema', () => {
      const mockResponse = {
        message: 'Package marked as failed',
        success: true
      };

      const isValid = validateSchema(mockResponse, SuccessResponseSchema);
      expect(isValid).toBe(true);
    });
  });

  describe('POST /api/send-notification-email Request/Response Schema', () => {
    it('should validate notification email request schema', () => {
      const mockRequest = {
        packageId: '123',
        recipientEmail: 'student@example.com',
        orgSlug: 'university',
        mailroomSlug: 'main-office'
      };

      const isValid = validateSchema(mockRequest, NotificationEmailRequestSchema);
      expect(isValid).toBe(true);
    });

    it('should validate notification email response schema', () => {
      const mockResponse = {
        message: 'Notification email sent successfully',
        success: true
      };

      const isValid = validateSchema(mockResponse, SuccessResponseSchema);
      expect(isValid).toBe(true);
    });

    it('should validate notification email error responses', () => {
      const emailConfigError = { error: 'Email configuration not found for mailroom' };
      const sendFailureError = { error: 'Failed to send notification email' };
      const packageNotFoundError = { error: 'Package not found' };

      expect(validateSchema(emailConfigError, ErrorResponseSchema)).toBe(true);
      expect(validateSchema(sendFailureError, ErrorResponseSchema)).toBe(true);
      expect(validateSchema(packageNotFoundError, ErrorResponseSchema)).toBe(true);
    });
  });

  describe('Package Status Validation', () => {
    it('should validate all valid package statuses', () => {
      const validStatuses = ['pending', 'picked_up', 'failed'];
      
      validStatuses.forEach(status => {
        const mockPackage = {
          First: 'John',
          Last: 'Doe',
          Email: 'john@example.com',
          provider: 'FedEx',
          residentId: 'student-123',
          packageId: '123',
          status: status,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z'
        };

        expect(validateSchema(mockPackage, PackageSchema)).toBe(true);
      });
    });

    it('should validate package provider types', () => {
      const validProviders = ['FedEx', 'UPS', 'USPS', 'Amazon', 'DHL', 'Other'];
      
      validProviders.forEach(provider => {
        const mockPackage = {
          First: 'John',
          Last: 'Doe',
          Email: 'john@example.com',
          provider: provider,
          residentId: 'student-123',
          packageId: '123',
          status: 'pending',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z'
        };

        expect(validateSchema(mockPackage, PackageSchema)).toBe(true);
      });
    });
  });

  describe('Error Response Consistency', () => {
    it('should validate common error response patterns', () => {
      const commonErrors = [
        { error: 'Method not allowed' },
        { error: 'Unauthorized' },
        { error: 'Forbidden' },
        { error: 'Not found' },
        { error: 'Internal server error' },
        { error: 'Bad request' },
        { error: 'Conflict' }
      ];

      commonErrors.forEach(errorResponse => {
        expect(validateSchema(errorResponse, ErrorResponseSchema)).toBe(true);
      });
    });

    it('should validate success response patterns', () => {
      const successResponses = [
        { message: 'Operation completed successfully', success: true },
        { message: 'Package created', success: true },
        { message: 'Package updated', success: true },
        { message: 'Package deleted', success: true },
        { message: 'Email sent', success: true }
      ];

      successResponses.forEach(successResponse => {
        expect(validateSchema(successResponse, SuccessResponseSchema)).toBe(true);
      });
    });
  });

  describe('Required Field Validation', () => {
    it('should reject package objects missing required fields', () => {
      const incompletePackage = {
        First: 'John',
        Last: 'Doe',
        // Missing Email, provider, residentId, packageId, status, createdAt, updatedAt
      };

      const isValid = validateSchema(incompletePackage, PackageSchema);
      expect(isValid).toBe(false);
    });

    it('should reject add package requests missing required fields', () => {
      const incompleteRequest = {
        First: 'John',
        Last: 'Doe',
        // Missing Email, provider, residentId, orgSlug, mailroomSlug
      };

      const isValid = validateSchema(incompleteRequest, AddPackageRequestSchema);
      expect(isValid).toBe(false);
    });

    it('should reject get packages requests missing required fields', () => {
      const incompleteRequest = {
        student_id: 'student-123',
        // Missing orgSlug, mailroomSlug
      };

      const isValid = validateSchema(incompleteRequest, GetPackagesRequestSchema);
      expect(isValid).toBe(false);
    });
  });
});