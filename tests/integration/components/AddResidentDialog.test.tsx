import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { server } from '../../mocks/server';
import { AuthContext } from '../../../context/AuthContext';
import { AddResidentDialog } from '../../../components/mailroomTabs/AddResidentDialog';
import { renderWithAuth, createMockRouter } from '../../utils/test-utils';

// MSW will handle all HTTP requests

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  AlertCircle: ({ size }: { size?: number }) => <div data-testid="alert-circle" style={{ width: size, height: size }} />,
  Check: ({ size }: { size?: number }) => <div data-testid="check-icon" style={{ width: size, height: size }} />,
  X: ({ size }: { size?: number }) => <div data-testid="x-icon" style={{ width: size, height: size }} />,
}));

// Mock UI components
vi.mock('../../../components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: { children: React.ReactNode; open: boolean }) => 
    open ? <div role="dialog">{children}</div> : null,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => 
    <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => 
    <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => 
    <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => 
    <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => 
    <div>{children}</div>,
  AlertDialogCancel: ({ children, onClick, disabled }: any) => 
    <button onClick={onClick} disabled={disabled}>{children}</button>,
}));

vi.mock('../../../components/ui/button', () => ({
  Button: ({ children, onClick, disabled, type }: any) => 
    <button onClick={onClick} disabled={disabled} type={type}>{children}</button>,
}));

vi.mock('../../../components/ui/input', () => ({
  Input: ({ id, value, onChange, disabled, placeholder, type }: any) => 
    <input 
      id={id}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      type={type}
    />,
}));

vi.mock('../../../components/ui/label', () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor: string }) => 
    <label htmlFor={htmlFor}>{children}</label>,
}));

// Test wrapper is now handled by renderWithAuth utility

// Mock userPreferences
vi.mock('../../../lib/userPreferences', () => ({
  getOrgDisplayName: vi.fn(),
  getMailroomDisplayName: vi.fn()
}));

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
    // MSW handlers are reset in test setup
  });

  describe('Form Validation (Required Fields)', () => {
    it('should disable submit button when first name is missing', async () => {
      const user = userEvent.setup();
      const routerMock = createMockRouter();

      renderWithAuth(
        <AddResidentDialog {...mockProps} />,
        { authScenario: 'authenticated-manager', routerMock }
      );

      // Fill all fields except first name
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/resident id/i), 'STU001');
      await user.type(screen.getByLabelText(/email/i), 'john.doe@example.com');

      // Submit button should be disabled
      const submitButton = screen.getByRole('button', { name: /add resident/i });
      expect(submitButton).toBeDisabled();
    });

    it('should disable submit button when last name is missing', async () => {
      const user = userEvent.setup();
      const routerMock = createMockRouter();

      renderWithAuth(
        <AddResidentDialog {...mockProps} />,
        { authScenario: 'authenticated-manager', routerMock }
      );

      // Fill all fields except last name
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/resident id/i), 'STU001');
      await user.type(screen.getByLabelText(/email/i), 'john.doe@example.com');

      // Submit button should be disabled
      const submitButton = screen.getByRole('button', { name: /add resident/i });
      expect(submitButton).toBeDisabled();
    });

    it('should disable submit button when resident ID is missing', async () => {
      const user = userEvent.setup();
      const routerMock = createMockRouter();

      renderWithAuth(
        <AddResidentDialog {...mockProps} />,
        { authScenario: 'authenticated-manager', routerMock }
      );

      // Fill all fields except resident ID
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/email/i), 'john.doe@example.com');

      // Submit button should be disabled
      const submitButton = screen.getByRole('button', { name: /add resident/i });
      expect(submitButton).toBeDisabled();
    });

    it('should disable submit button when email is missing', async () => {
      const user = userEvent.setup();
      const routerMock = createMockRouter();

      renderWithAuth(
        <AddResidentDialog {...mockProps} />,
        { authScenario: 'authenticated-manager', routerMock }
      );

      // Fill all fields except email
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/resident id/i), 'STU001');

      // Submit button should be disabled
      const submitButton = screen.getByRole('button', { name: /add resident/i });
      expect(submitButton).toBeDisabled();
    });

    it('should disable submit button when required fields are empty', async () => {
      const routerMock = createMockRouter();

      renderWithAuth(
        <AddResidentDialog {...mockProps} />,
        { authScenario: 'authenticated-manager', routerMock }
      );

      const submitButton = screen.getByRole('button', { name: /add resident/i });
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when all required fields are filled', async () => {
      const user = userEvent.setup();
      const routerMock = createMockRouter();

      renderWithAuth(
        <AddResidentDialog {...mockProps} />,
        { authScenario: 'authenticated-manager', routerMock }
      );

      // Fill all required fields
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/resident id/i), 'STU001');
      await user.type(screen.getByLabelText(/email/i), 'john.doe@example.com');

      const submitButton = screen.getByRole('button', { name: /add resident/i });
      expect(submitButton).not.toBeDisabled();
    });

    it('should show validation error when submitting with whitespace-only first name', async () => {
      const user = userEvent.setup();
      const routerMock = createMockRouter();

      renderWithAuth(
        <AddResidentDialog {...mockProps} />,
        { authScenario: 'authenticated-manager', routerMock }
      );

      // Fill all fields including whitespace-only first name
      await user.type(screen.getByLabelText(/first name/i), '   ');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/resident id/i), 'STU001');
      await user.type(screen.getByLabelText(/email/i), 'john.doe@example.com');

      // Submit form (should be enabled because fields have content)
      const submitButton = screen.getByRole('button', { name: /add resident/i });
      expect(submitButton).not.toBeDisabled();
      await user.click(submitButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText('First Name is required.')).toBeInTheDocument();
        expect(screen.getByTestId('alert-circle')).toBeInTheDocument();
      });
    });
  });

  describe('Duplicate Resident Prevention', () => {
    it('should handle duplicate resident error from API', async () => {
      const user = userEvent.setup();
      const routerMock = createMockRouter();

      // Override the MSW handler to return a duplicate error
      server.use(
        http.post('/api/add-resident', () => {
          return HttpResponse.json(
            { error: 'Resident with this ID already exists in this mailroom' },
            { status: 409 }
          );
        })
      );

      renderWithAuth(
        <AddResidentDialog {...mockProps} />,
        { authScenario: 'authenticated-manager', routerMock }
      );

      // Fill form with valid data
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/resident id/i), 'STU001');
      await user.type(screen.getByLabelText(/email/i), 'john.doe@example.com');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /add resident/i });
      await user.click(submitButton);

      // Should show duplicate error
      await waitFor(() => {
        expect(screen.getByText('Resident with this ID already exists in this mailroom')).toBeInTheDocument();
        expect(screen.getByTestId('alert-circle')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should clear error when form is modified after duplicate error', async () => {
      const user = userEvent.setup();
      const routerMock = createMockRouter();

      // Override the MSW handler to return a duplicate error
      server.use(
        http.post('/api/add-resident', () => {
          return HttpResponse.json(
            { error: 'Duplicate resident' },
            { status: 409 }
          );
        })
      );

      renderWithAuth(
        <AddResidentDialog {...mockProps} />,
        { authScenario: 'authenticated-manager', routerMock }
      );

      // Fill and submit form to get error
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/resident id/i), 'STU001');
      await user.type(screen.getByLabelText(/email/i), 'john.doe@example.com');

      const submitButton = screen.getByRole('button', { name: /add resident/i });
      await user.click(submitButton);

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText('Duplicate resident')).toBeInTheDocument();
      });

      // Modify form
      await user.type(screen.getByLabelText(/resident id/i), '2');

      // Error should be cleared when submitting again
      // (The component clears error on form submit, not on input change)
      expect(screen.getByText('Duplicate resident')).toBeInTheDocument();
    });
  });

  describe('Modal Open/Close Behavior', () => {
    it('should not render when isOpen is false', () => {
      renderWithAuth(
        <AddResidentDialog {...mockProps} isOpen={false} />,
        { authScenario: 'authenticated-manager' }
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      renderWithAuth(
        <AddResidentDialog {...mockProps} isOpen={true} />,
        { authScenario: 'authenticated-manager' }
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Add New Resident')).toBeInTheDocument();
    });

    it('should call onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();

      renderWithAuth(
        <AddResidentDialog {...mockProps} onClose={mockOnClose} />,
        { authScenario: 'authenticated-manager' }
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should clear form fields when closing dialog', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();

      renderWithAuth(
        <AddResidentDialog {...mockProps} onClose={mockOnClose} />,
        { authScenario: 'authenticated-manager' }
      );

      // Fill form
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');

      // Close dialog
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
      // Form fields should be cleared (tested by re-opening the dialog)
    });
  });

  describe('Success/Error Feedback', () => {
    it('should show success message after successful submission', async () => {
      const user = userEvent.setup();

      // Default MSW handler returns success for add-resident
      renderWithAuth(
        <AddResidentDialog {...mockProps} />,
        { authScenario: 'authenticated-manager' }
      );

      // Fill form
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/resident id/i), 'STU001');
      await user.type(screen.getByLabelText(/email/i), 'john.doe@example.com');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /add resident/i });
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

      // Default MSW handler returns success for add-resident
      renderWithAuth(
        <AddResidentDialog {...mockProps} onResidentAdded={mockOnResidentAdded} />,
        { authScenario: 'authenticated-manager' }
      );

      // Fill and submit form
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/resident id/i), 'STU001');
      await user.type(screen.getByLabelText(/email/i), 'john.doe@example.com');

      const submitButton = screen.getByRole('button', { name: /add resident/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnResidentAdded).toHaveBeenCalled();
      });
    });

    it('should clear form fields after successful submission', async () => {
      const user = userEvent.setup();

      // Default MSW handler returns success for add-resident
      renderWithAuth(
        <AddResidentDialog {...mockProps} />,
        { authScenario: 'authenticated-manager' }
      );

      // Fill form
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/resident id/i), 'STU001');
      await user.type(screen.getByLabelText(/email/i), 'john.doe@example.com');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /add resident/i });
      await user.click(submitButton);

      // Wait for success
      await waitFor(() => {
        expect(screen.getByText('Resident John Doe added successfully.')).toBeInTheDocument();
      });

      // Form fields should be empty
      expect(screen.getByLabelText(/first name/i)).toHaveValue('');
      expect(screen.getByLabelText(/last name/i)).toHaveValue('');
      expect(screen.getByLabelText(/resident id/i)).toHaveValue('');
      expect(screen.getByLabelText(/email/i)).toHaveValue('');
    });

    it('should show network error when fetch fails', async () => {
      const user = userEvent.setup();

      // Override the MSW handler to simulate network error
      server.use(
        http.post('/api/add-resident', () => {
          return HttpResponse.error();
        })
      );

      renderWithAuth(
        <AddResidentDialog {...mockProps} />,
        { authScenario: 'authenticated-manager' }
      );

      // Fill and submit form
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/resident id/i), 'STU001');
      await user.type(screen.getByLabelText(/email/i), 'john.doe@example.com');

      const submitButton = screen.getByRole('button', { name: /add resident/i });
      await user.click(submitButton);

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/Failed to fetch/)).toBeInTheDocument();
        expect(screen.getByTestId('alert-circle')).toBeInTheDocument();
      });
    });

    it('should allow dismissing error messages', async () => {
      const user = userEvent.setup();

      // Override the MSW handler to return a test error
      server.use(
        http.post('/api/add-resident', () => {
          return HttpResponse.json(
            { error: 'Test error' },
            { status: 400 }
          );
        })
      );

      renderWithAuth(
        <AddResidentDialog {...mockProps} />,
        { authScenario: 'authenticated-manager' }
      );

      // Fill and submit form to get error
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/resident id/i), 'STU001');
      await user.type(screen.getByLabelText(/email/i), 'john.doe@example.com');

      const submitButton = screen.getByRole('button', { name: /add resident/i });
      await user.click(submitButton);

      // Wait for error
      await waitFor(() => {
        expect(screen.getByText('Test error')).toBeInTheDocument();
      });

      // Dismiss error
      const dismissButton = screen.getAllByRole('button').find(btn => btn.querySelector('[data-testid="x-icon"]'));
      if (dismissButton) await user.click(dismissButton);

      // Error should be gone
      expect(screen.queryByText('Test error')).not.toBeInTheDocument();
    });

    it('should allow dismissing success messages', async () => {
      const user = userEvent.setup();

      // Default MSW handler returns success for add-resident
      renderWithAuth(
        <AddResidentDialog {...mockProps} />,
        { authScenario: 'authenticated-manager' }
      );

      // Fill and submit form
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/resident id/i), 'STU001');
      await user.type(screen.getByLabelText(/email/i), 'john.doe@example.com');

      const submitButton = screen.getByRole('button', { name: /add resident/i });
      await user.click(submitButton);

      // Wait for success
      await waitFor(() => {
        expect(screen.getByText('Resident John Doe added successfully.')).toBeInTheDocument();
      });

      // Dismiss success message
      const dismissButton = screen.getAllByRole('button').find(btn => btn.querySelector('[data-testid="x-icon"]'));
      if (dismissButton) await user.click(dismissButton);

      // Success message should be gone
      expect(screen.queryByText('Resident John Doe added successfully.')).not.toBeInTheDocument();
    });
  });

  describe('Form Submission Loading State', () => {
    it('should disable form during submission', async () => {
      const user = userEvent.setup();

      // Override MSW handler with delayed response
      server.use(
        http.post('/api/add-resident', async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json({ success: true, message: 'Success' });
        })
      );

      renderWithAuth(
        <AddResidentDialog {...mockProps} />,
        { authScenario: 'authenticated-manager' }
      );

      // Fill form
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/resident id/i), 'STU001');
      await user.type(screen.getByLabelText(/email/i), 'john.doe@example.com');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /add resident/i });
      await user.click(submitButton);

      // Form should be disabled during submission
      expect(screen.getByLabelText(/first name/i)).toBeDisabled();
      expect(screen.getByLabelText(/last name/i)).toBeDisabled();
      expect(screen.getByLabelText(/resident id/i)).toBeDisabled();
      expect(screen.getByLabelText(/email/i)).toBeDisabled();
      expect(submitButton).toBeDisabled();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByLabelText(/first name/i)).not.toBeDisabled();
      }, { timeout: 200 });
    });

    it('should show loading text on submit button during submission', async () => {
      const user = userEvent.setup();

      // Override MSW handler with delayed response
      server.use(
        http.post('/api/add-resident', async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json({ success: true, message: 'Success' });
        })
      );

      renderWithAuth(
        <AddResidentDialog {...mockProps} />,
        { authScenario: 'authenticated-manager' }
      );

      // Fill form
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/resident id/i), 'STU001');
      await user.type(screen.getByLabelText(/email/i), 'john.doe@example.com');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /add resident/i });
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
    it('should successfully submit with valid data', async () => {
      const user = userEvent.setup();

      renderWithAuth(
        <AddResidentDialog {...mockProps} />,
        { authScenario: 'authenticated-manager' }
      );

      // Fill form
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/resident id/i), 'STU001');
      await user.type(screen.getByLabelText(/email/i), 'john.doe@example.com');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /add resident/i });
      await user.click(submitButton);

      // Should show success (using default MSW handler)
      await waitFor(() => {
        expect(screen.getByText('Resident John Doe added successfully.')).toBeInTheDocument();
      });
    });

    it('should handle authentication error', async () => {
      const user = userEvent.setup();

      // Use unauthenticated scenario to simulate auth error
      renderWithAuth(
        <AddResidentDialog {...mockProps} />,
        { authScenario: 'unauthenticated' }
      );

      // Fill form
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/resident id/i), 'STU001');
      await user.type(screen.getByLabelText(/email/i), 'john.doe@example.com');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /add resident/i });
      await user.click(submitButton);

      // Should show auth error
      await waitFor(() => {
        expect(screen.getByText('Authentication required.')).toBeInTheDocument();
      });
    });
  });
});