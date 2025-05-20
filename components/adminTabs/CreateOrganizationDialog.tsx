import React, { useEffect, useState } from 'react';

import { X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface CreateOrganizationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onOrganizationCreated: () => void;
}

export const CreateOrganizationDialog: React.FC<CreateOrganizationDialogProps> = ({ isOpen, onClose, onOrganizationCreated }) => {
  const { session } = useAuth();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState('PENDING_SETUP'); // Default status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Reset form when dialog is closed/opened
    if (isOpen) {
      setName('');
      setSlug('');
      setStatus('PENDING_SETUP');
      setIsSubmitting(false);
      setError(null);
      setSuccess(null);
    }
  }, [isOpen]);

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawSlug = e.target.value;
    const sanitizedSlug = rawSlug.toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/-+/g, '-');
    setSlug(sanitizedSlug);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      setError('Organization Name and Slug are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      if (!session?.access_token) {
        setError('Authentication required.');
        setIsSubmitting(false);
        return;
      }

      const response = await fetch('/api/organizations/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name, slug, status }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || `Failed to create organization: ${response.status}`);
      }
      
      setSuccess(`Organization '${responseData.name}' created successfully!`);
      // setName(''); // Keep fields for a moment to show success, or clear them
      // setSlug('');
      onOrganizationCreated(); // Callback to refresh list and potentially close dialog
      // Optionally close dialog after a delay or let parent handle it via onOrganizationCreated
      // setTimeout(onClose, 2000); 

    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred while creating the organization.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative border-2 border-[#075985]">
        <button 
          onClick={onClose} 
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close dialog"
        >
          <X size={24} />
        </button>
        <h2 className="text-xl font-semibold text-[#075985] mb-4">Create New Organization</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="orgName" className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
            <input 
              type="text" 
              id="orgName" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              required 
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#075985] focus:border-[#075985] sm:text-sm"
              placeholder="e.g., Acme Corporation"
            />
          </div>

          <div>
            <label htmlFor="orgSlug" className="block text-sm font-medium text-gray-700 mb-1">Organization Slug</label>
            <input 
              type="text" 
              id="orgSlug" 
              value={slug} 
              onChange={handleSlugChange} 
              required 
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#075985] focus:border-[#075985] sm:text-sm"
              placeholder="e.g., acme-corp (auto-sanitized)"
            />
            {slug && <p className="text-xs text-gray-500 mt-1">Generated slug: {slug}</p>}
          </div>

          <div>
            <label htmlFor="orgStatus" className="block text-sm font-medium text-gray-700 mb-1">Initial Status</label>
            <select 
              id="orgStatus" 
              value={status} 
              onChange={(e) => setStatus(e.target.value)} 
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#075985] focus:border-[#075985] sm:text-sm bg-white"
            >
              <option value="PENDING_SETUP">Pending Setup</option>
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Disabled</option>
              {/* Add other statuses as needed */}
            </select>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</p>}
          {success && <p className="text-sm text-green-600 bg-green-50 p-3 rounded-md">{success}</p>}

          <div className="flex justify-end space-x-3 pt-2">
            <button 
              type="button" 
              onClick={onClose} 
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-[#075985] hover:bg-sky-700 rounded-md border border-transparent disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Create Organization'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 