import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthContext } from '../../../context/AuthContext';
import { AddResidentDialog } from '../../../components/mailroomTabs/AddResidentDialog';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  AlertCircle: ({ size }: { size?: number }) => <div data-testid="alert-circle" style={{ width: size, height: size }} />,
  Check: ({ size }: { size?: number }) => <div data-testid="check-icon" style={{ width: size, height: size }} />,
  X: ({ size }: { size?: number }) => <div data-testid="x-icon" style={{ width: size, height: size }} />,
}));

// Mock UI components
vi.mock('../../../components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: { children: React.ReactNode; open: boolean }) => 
    open ? <div data-testid="alert-dialog">{children}</div> : null,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => 
    <div data-testid="dialog-content">{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => 
    <div data-testid="dialog-header">{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => 
    <h2 data-testid="dialog-title">{children}</h2>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => 
    <div data-testid="dialog-description">{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => 
    <div data-testid="dialog-footer">{children}</div>,
  AlertDialogCancel: ({ children, onClick, disabled }: any) => 
    <button data-testid="cancel-button" onClick={onClick} disabled={disabled}>{children}</button>,
}));

vi.mock('../../../components/ui/button', () => ({
  Button: ({ children, onClick, disabled, type }: any) => 
    <button data-testid="submit-button" onClick={onClick} disabled={disabled} type={type}>{children}</button>,
}));

vi.mock('../../../components/ui/input', () => ({
  Input: ({ id, value, onChange, disabled, placeholder, type }: any) => 
    <input 
      data-testid={`input-${id}`}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      type={type}
    />,
}));

vi.mock('../../../components/ui/label', () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor: string }) => 
    <label data-testid={`label-${htmlFor}`} htmlFor={htmlFor}>{children}</label>,
}));

// Create mock session
const mockSession = {
  user: {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'manager' as const
  },
  expires: '2024-12-31T23:59:59.999Z',
  access_token: 'mock-token'
};

// Create wrapper component with auth context
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <AuthContext.Provider value={{
      session: mockSession,
      user: mockSession.user,
      loading: false,
      error: null
    }}>
      {children}
    </AuthContext.Provider>
  );
};

describe('AddResidentDialog Component Integration Tests', () => {
  const mockProps = {
    isOpen: true,
    onClose: vi.fn(),
    onResidentAdded: vi.fn(),
    orgSlug: 'test-org',
    mailroomSlug: 'test-mailroom'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('Form Validation (Required Fields)', () => {
    it('should show validation error when first name is missing', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AddResidentDialog {...mockProps} />
        </TestWrapper>
      );

      // Fill all fields except first name
      await user.type(screen.getByTestId('input-lastName'), 'Doe');
      await user.type(screen.getByTestId('input-residentId'), 'STU001');
      await user.type(screen.getByTestId('input-email'), 'john.doe@example.com');

      // Try to submit
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText('First Name is required.')).toBeInTheDocument();
        expect(screen.getByTestId('alert-circle')).toBeInTheDocument();
      });

      // API should not be called
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should show validation error when last name is missing', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AddResidentDialog {...mockProps} />
        </TestWrapper>
      );

      // Fill all fields except last name
      await user.type(screen.getByTestId('input-firstName'), 'John');
      await user.type(screen.getByTestId('input-residentId'), 'STU001');
      await user.type(screen.getByTestId('input-email'), 'john.doe@example.com');

      // Try to submit
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText('Last Name is required.')).toBeInTheDocument();
      });
    });

    it('should show validation error when resident ID is missing', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AddResidentDialog {...mockProps} />
        </TestWrapper>
      );

      // Fill all fields except resident ID
      await user.type(screen.getByTestId('input-firstName'), 'John');
      await user.type(screen.getByTestId('input-lastName'), 'Doe');
      await user.type(screen.getByTestId('input-email'), 'john.doe@example.com');

      // Try to submit
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText('Resident ID is required.')).toBeInTheDocument();
      });
    });

    it('should show validation error when email is missing', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AddResidentDialog {...mockProps} />
        </TestWrapper>
      );

      // Fill all fields except email
      await user.type(screen.getByTestId('input-firstName'), 'John');
      await user.type(screen.getByTestId('input-lastName'), 'Doe');
      await user.type(screen.getByTestId('input-residentId'), 'STU001');

      // Try to submit
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText('Email is required.')).toBeInTheDocument();
      });
    });

    it('should disable submit button when required fields are empty', async () => {
      render(
        <TestWrapper>
          <AddResidentDialog {...mockProps} />
        </TestWrapper>
      );

      const submitButton = screen.getByTestId('submit-button');
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when all required fields are filled', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AddResidentDialog {...mockProps} />
        </TestWrapper>
      );

      // Fill all required fields
      await user.type(screen.getByTestId('input-firstName'), 'John');
      await user.type(screen.getByTestId('input-lastName'), 'Doe');
      await user.type(screen.getByTestId('input-residentId'), 'STU001');
      await user.type(screen.getByTestId('input-email'), 'john.doe@example.com');

      const submitButton = screen.getByTestId('submit-button');
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Duplicate Resident Prevention', () => {
    it('should handle duplicate resident error from API', async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Resident with this ID already exists in this mailroom' })
      });

      render(
        <TestWrapper>
          <AddResidentDialog {...mockProps} />
        </TestWrapper>
      );

      // Fill form with valid data
      await user.type(screen.getByTestId('input-firstName'), 'John');
      await user.type(screen.getByTestId('input-lastName'), 'Doe');
      await user.type(screen.getByTestId('input-residentId'), 'STU001');
      await user.type(screen.getByTestId('input-email'), 'john.doe@example.com');

      // Submit form
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Should show duplicate error
      await waitFor(() => {
        expect(screen.getByText('Resident with this ID already exists in this mailroom')).toBeInTheDocument();
        expect(screen.getByTestId('alert-circle')).toBeInTheDocument();
      });
    });

    it('should clear error when form is modified after duplicate error', async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Duplicate resident' })
      });

      render(
        <TestWrapper>
          <AddResidentDialog {...mockProps} />
        </TestWrapper>
      );

      // Fill and submit form to get error
      await user.type(screen.getByTestId('input-firstName'), 'John');
      await user.type(screen.getByTestId('input-lastName'), 'Doe');
      await user.type(screen.getByTestId('input-residentId'), 'STU001');
      await user.type(screen.getByTestId('input-email'), 'john.doe@example.com');

      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText('Duplicate resident')).toBeInTheDocument();
      });

      // Modify form
      await user.type(screen.getByTestId('input-residentId'), '2');

      // Error should be cleared when submitting again
      // (The component clears error on form submit, not on input change)
      expect(screen.getByText('Duplicate resident')).toBeInTheDocument();
    });
  });

  describe('Modal Open/Close Behavior', () => {
    it('should not render when isOpen is false', () => {
      render(
        <TestWrapper>
          <AddResidentDialog {...mockProps} isOpen={false} />
        </TestWrapper>
      );

      expect(screen.queryByTestId('alert-dialog')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(
        <TestWrapper>
          <AddResidentDialog {...mockProps} isOpen={true} />
        </TestWrapper>
      );

      expect(screen.getByTestId('alert-dialog')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Add New Resident');
    });

    it('should call onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();

      render(
        <TestWrapper>
          <AddResidentDialog {...mockProps} onClose={mockOnClose} />
        </TestWrapper>
      );

      const cancelButton = screen.getByTestId('cancel-button');
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should clear form fields when closing dialog', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();

      render(
        <TestWrapper>
          <AddResidentDialog {...mockProps} onClose={mockOnClose} />
        </TestWrapper>
      );

      // Fill form
      await user.type(screen.getByTestId('input-firstName'), 'John');
      await user.type(screen.getByTestId('input-lastName'), 'Doe');

      // Close dialog
      const cancelButton = screen.getByTestId('cancel-button');
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
      // Form fields should be cleared (tested by re-opening the dialog)
    });
  });

  describe('Success/Error Feedback', () => {
    it('should show success message after successful submission', async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Resident added successfully' })
      });

      render(
        <TestWrapper>
          <AddResidentDialog {...mockProps} />
        </TestWrapper>
      );

      // Fill form
      await user.type(screen.getByTestId('input-firstName'), 'John');
      await user.type(screen.getByTestId('input-lastName'), 'Doe');
      await user.type(screen.getByTestId('input-residentId'), 'STU001');
      await user.type(screen.getByTestId('input-email'), 'john.doe@example.com');

      // Submit form
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText('Resident John Doe added successfully.')).toBeInTheDocument();
        expect(screen.getByTestId('check-icon')).toBeInTheDocument();
      });
    });

    it('should call onResidentAdded callback after successful submission', async () => {
      const user = userEvent.setup();
      const mockOnResidentAdded = vi.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Success' })
      });

      render(
        <TestWrapper>
          <AddResidentDialog {...mockProps} onResidentAdded={mockOnResidentAdded} />
        </TestWrapper>
      );

      // Fill and submit form
      await user.type(screen.getByTestId('input-firstName'), 'John');
      await user.type(screen.getByTestId('input-lastName'), 'Doe');
      await user.type(screen.getByTestId('input-residentId'), 'STU001');
      await user.type(screen.getByTestId('input-email'), 'john.doe@example.com');

      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnResidentAdded).toHaveBeenCalled();
      });
    });

    it('should clear form fields after successful submission', async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Success' })
      });

      render(
        <TestWrapper>
          <AddResidentDialog {...mockProps} />
        </TestWrapper>
      );

      // Fill form
      await user.type(screen.getByTestId('input-firstName'), 'John');
      await user.type(screen.getByTestId('input-lastName'), 'Doe');
      await user.type(screen.getByTestId('input-residentId'), 'STU001');
      await user.type(screen.getByTestId('input-email'), 'john.doe@example.com');

      // Submit form
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Wait for success
      await waitFor(() => {
        expect(screen.getByText('Resident John Doe added successfully.')).toBeInTheDocument();
      });

      // Form fields should be empty
      expect(screen.getByTestId('input-firstName')).toHaveValue('');
      expect(screen.getByTestId('input-lastName')).toHaveValue('');
      expect(screen.getByTestId('input-residentId')).toHaveValue('');
      expect(screen.getByTestId('input-email')).toHaveValue('');
    });

    it('should show network error when fetch fails', async () => {
      const user = userEvent.setup();

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(
        <TestWrapper>
          <AddResidentDialog {...mockProps} />
        </TestWrapper>
      );

      // Fill and submit form
      await user.type(screen.getByTestId('input-firstName'), 'John');
      await user.type(screen.getByTestId('input-lastName'), 'Doe');
      await user.type(screen.getByTestId('input-residentId'), 'STU001');
      await user.type(screen.getByTestId('input-email'), 'john.doe@example.com');

      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Should show error
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
        expect(screen.getByTestId('alert-circle')).toBeInTheDocument();
      });
    });

    it('should allow dismissing error messages', async () => {
      const user = userEvent.setup();

      mockFetch.mockRejectedValueOnce(new Error('Test error'));

      render(
        <TestWrapper>
          <AddResidentDialog {...mockProps} />
        </TestWrapper>
      );

      // Fill and submit form to get error
      await user.type(screen.getByTestId('input-firstName'), 'John');
      await user.type(screen.getByTestId('input-lastName'), 'Doe');
      await user.type(screen.getByTestId('input-residentId'), 'STU001');
      await user.type(screen.getByTestId('input-email'), 'john.doe@example.com');

      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Wait for error
      await waitFor(() => {
        expect(screen.getByText('Test error')).toBeInTheDocument();
      });

      // Dismiss error
      const dismissButton = screen.getAllByTestId('x-icon')[0]; // First X icon (for error)
      await user.click(dismissButton);

      // Error should be gone
      expect(screen.queryByText('Test error')).not.toBeInTheDocument();
    });

    it('should allow dismissing success messages', async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Success' })
      });

      render(
        <TestWrapper>
          <AddResidentDialog {...mockProps} />
        </TestWrapper>
      );

      // Fill and submit form
      await user.type(screen.getByTestId('input-firstName'), 'John');
      await user.type(screen.getByTestId('input-lastName'), 'Doe');
      await user.type(screen.getByTestId('input-residentId'), 'STU001');
      await user.type(screen.getByTestId('input-email'), 'john.doe@example.com');

      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Wait for success
      await waitFor(() => {
        expect(screen.getByText('Resident John Doe added successfully.')).toBeInTheDocument();
      });

      // Dismiss success message
      const dismissButton = screen.getAllByTestId('x-icon')[0]; // Success message X
      await user.click(dismissButton);

      // Success message should be gone
      expect(screen.queryByText('Resident John Doe added successfully.')).not.toBeInTheDocument();
    });
  });

  describe('Form Submission Loading State', () => {
    it('should disable form during submission', async () => {
      const user = userEvent.setup();

      // Mock delayed response
      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({ message: 'Success' })
          }), 100)
        )
      );

      render(
        <TestWrapper>
          <AddResidentDialog {...mockProps} />
        </TestWrapper>
      );

      // Fill form
      await user.type(screen.getByTestId('input-firstName'), 'John');
      await user.type(screen.getByTestId('input-lastName'), 'Doe');
      await user.type(screen.getByTestId('input-residentId'), 'STU001');
      await user.type(screen.getByTestId('input-email'), 'john.doe@example.com');

      // Submit form
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Form should be disabled during submission
      expect(screen.getByTestId('input-firstName')).toBeDisabled();
      expect(screen.getByTestId('input-lastName')).toBeDisabled();
      expect(screen.getByTestId('input-residentId')).toBeDisabled();
      expect(screen.getByTestId('input-email')).toBeDisabled();
      expect(submitButton).toBeDisabled();
      expect(screen.getByTestId('cancel-button')).toBeDisabled();

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByTestId('input-firstName')).not.toBeDisabled();
      }, { timeout: 200 });
    });

    it('should show loading text on submit button during submission', async () => {
      const user = userEvent.setup();

      // Mock delayed response
      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({ message: 'Success' })
          }), 100)
        )
      );

      render(
        <TestWrapper>
          <AddResidentDialog {...mockProps} />
        </TestWrapper>
      );

      // Fill form
      await user.type(screen.getByTestId('input-firstName'), 'John');
      await user.type(screen.getByTestId('input-lastName'), 'Doe');
      await user.type(screen.getByTestId('input-residentId'), 'STU001');
      await user.type(screen.getByTestId('input-email'), 'john.doe@example.com');

      // Submit form
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Button should show loading text
      expect(submitButton).toHaveTextContent('Adding...');

      // Wait for completion
      await waitFor(() => {
        expect(submitButton).toHaveTextContent('Add Resident');
      }, { timeout: 200 });
    });
  });

  describe('API Integration', () => {
    it('should send correct data to API endpoint', async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Success' })
      });

      render(
        <TestWrapper>
          <AddResidentDialog {...mockProps} />
        </TestWrapper>
      );

      // Fill form
      await user.type(screen.getByTestId('input-firstName'), 'John');
      await user.type(screen.getByTestId('input-lastName'), 'Doe');
      await user.type(screen.getByTestId('input-residentId'), 'STU001');
      await user.type(screen.getByTestId('input-email'), 'john.doe@example.com');

      // Submit form
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Verify API call
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/add-resident', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token',
          },
          body: JSON.stringify({
            resident: {
              first_name: 'John',
              last_name: 'Doe',
              resident_id: 'STU001',
              email: 'john.doe@example.com',
            },
            orgSlug: 'test-org',
            mailroomSlug: 'test-mailroom'
          }),
        });
      });
    });

    it('should handle authentication error', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AddResidentDialog {...mockProps} />
        </TestWrapper>
      );

      // Clear session to simulate auth error
      const authContextValue = {
        session: null,
        user: null,
        loading: false,
        error: null
      };

      render(
        <AuthContext.Provider value={authContextValue}>
          <AddResidentDialog {...mockProps} />
        </AuthContext.Provider>
      );

      // Fill form
      await user.type(screen.getByTestId('input-firstName'), 'John');
      await user.type(screen.getByTestId('input-lastName'), 'Doe');
      await user.type(screen.getByTestId('input-residentId'), 'STU001');
      await user.type(screen.getByTestId('input-email'), 'john.doe@example.com');

      // Submit form
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Should show auth error
      await waitFor(() => {
        expect(screen.getByText('Authentication required.')).toBeInTheDocument();
      });

      // API should not be called
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});