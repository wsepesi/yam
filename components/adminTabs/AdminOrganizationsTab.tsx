import React, { useEffect, useState } from 'react';

import { CreateOrganizationDialog } from '@/components/adminTabs/CreateOrganizationDialog';
import { PlusCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';

// Interface for data from /api/organizations/list-all
interface OrganizationListItem {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  status: string;
  totalMailrooms: number;
  totalUsers: number;
}

const SkeletonRow = () => (
  <tr>
    <td className="px-6 py-5"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td>
    <td className="px-6 py-5"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
    <td className="px-6 py-5"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
    <td className="px-6 py-5"><div className="h-4 bg-gray-200 rounded w-1/4"></div></td>
    <td className="px-6 py-5"><div className="h-4 bg-gray-200 rounded w-1/4"></div></td>
    <td className="px-6 py-5"><div className="h-4 bg-gray-200 rounded w-1/4"></div></td> 
  </tr>
);

const AdminOrganizationsTab: React.FC = () => {
  const router = useRouter();
  const { session } = useAuth();

  const [organizations, setOrganizations] = useState<OrganizationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOrgDialogOpen, setIsCreateOrgDialogOpen] = useState(false);

  const fetchOrganizations = async () => {
    if (!session?.access_token) {
      setError("Authentication required.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/organizations/list-all', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch organizations: ${response.status}`);
      }
      const data: OrganizationListItem[] = await response.json();
      setOrganizations(data);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred.');
      }
      console.error("Error fetching organizations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) { 
      fetchOrganizations();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const handleViewOrganization = (orgSlug: string) => {
    router.push(`/${orgSlug}`); // Navigate to the organization's page
  };
  
  const getStatusPillClasses = (status: string): string => {
    const baseClasses = 'inline-block px-2.5 py-1 text-xs font-semibold leading-tight';
    switch (status?.toUpperCase()) {
      case 'ACTIVE':
        return `${baseClasses} bg-green-100 text-green-700`;
      case 'PENDING_SETUP':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'DISABLED':
        return `${baseClasses} bg-red-100 text-red-700`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-700`;
    }
  };

  const visibleColumnCount = 6; // Name, Status, Created, Mailrooms, Users, Slug (actions not a column)

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-medium text-[#471803]">All Organizations</h2>

      <div className="bg-white border border-[#471803]/20">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#471803]/20">
            <thead>
              <tr className="bg-white">
                <th className="px-6 py-4 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Created At</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Mailrooms</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Users</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Slug</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-[#471803]/10">
              {loading ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : error ? (
                <tr>
                  <td colSpan={visibleColumnCount} className="px-6 py-10 text-center text-sm text-red-600 italic">
                    Error: {error}
                  </td>
                </tr>
              ) : organizations.length > 0 ? (
                organizations.map((org) => (
                  <tr key={org.id} className="hover:bg-[#fffaf5]">
                    <td className="px-6 py-5 whitespace-nowrap text-sm text-[#471803]">
                      <button
                        onClick={() => handleViewOrganization(org.slug)}
                        className="font-semibold text-[#471803] hover:text-[#5a2004] py-1 px-2 rounded hover:bg-[#F5EFE6] focus:outline-none focus:ring-1 ring-inset focus:ring-[#471803] transition-colors"
                      >
                        {org.name}
                      </button>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm">
                      <span className={getStatusPillClasses(org.status)}>
                        {org.status || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm text-[#471803]">{new Date(org.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm text-[#471803]">{org.totalMailrooms.toLocaleString()}</td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm text-[#471803]">{org.totalUsers.toLocaleString()}</td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm text-[#471803] font-mono">{org.slug}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={visibleColumnCount} className="px-6 py-10 text-center text-sm text-[#471803]/70 italic">
                    No organizations found.
                  </td>
                </tr>
              )}
              <tr>
                <td colSpan={visibleColumnCount} className="p-0 whitespace-nowrap">
                  <button
                    onClick={() => setIsCreateOrgDialogOpen(true)}
                    className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-[#471803] bg-[#F5EFE6] text-[#471803] text-sm font-medium hover:bg-[#EAE0D5] transition-colors focus:outline-none focus:ring-2 focus:ring-[#471803] focus:ring-opacity-50"
                  >
                    <PlusCircle size={20} className="mr-2" />
                    Create New Organization
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <CreateOrganizationDialog
        isOpen={isCreateOrgDialogOpen}
        onClose={() => setIsCreateOrgDialogOpen(false)}
        onOrganizationCreated={() => {
          setIsCreateOrgDialogOpen(false);
          fetchOrganizations(); // Refresh list
        }}
      />
    </div>
  );
};

export default AdminOrganizationsTab; 