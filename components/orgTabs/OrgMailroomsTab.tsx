import React, { useEffect, useState } from 'react';

import { CreateMailroomDialog } from './CreateMailroomDialog';
import { PlusCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';

interface MailroomData {
  id: string;
  name: string;
  slug: string;
  totalPackages: number;
  packagesPending: number;
  totalResidents: number;
  status: string; // Example: 'Active', 'Inactive' - if you add this, update API and rendering
  totalUsers: number; // Example - if you add this, update API and rendering
}

interface OrgDetails {
  organizationId: string;
  organizationName: string;
  // Add other org details you might need
}

interface OrgOverviewStats {
  mailroomBreakdown: Array<{
    mailroomID: string;
    mailroomName: string;
    mailroomSlug: string;
    totalPackages: number;
    packagesAwaitingPickup: number;
    totalResidents: number;
    mailroomStatus?: string; // If you plan to add status
    totalUsersInMailroom?: number; // If you plan to add user count
  }>;
  // organizationId?: string; // We will fetch this separately and more reliably
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

const OrgMailroomsTab: React.FC = () => {
  const router = useRouter();
  const orgSlugFromQuery = router.query.org;
  const orgSlug = Array.isArray(orgSlugFromQuery) ? orgSlugFromQuery[0] : orgSlugFromQuery;
  const { session } = useAuth();

  const [mailrooms, setMailrooms] = useState<MailroomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateMailroomDialogOpen, setIsCreateMailroomDialogOpen] = useState(false);
  const [currentOrganizationId, setCurrentOrganizationId] = useState<string | null>(null);
  // const [currentOrgName, setCurrentOrgName] = useState<string | null>(null); // Optional: if you want to display org name

  const fetchOrgDetailsAndMailrooms = async () => {
    if (!router.isReady) {
      return;
    }

    if (!session?.access_token) {
      setError("Authentication required.");
      setLoading(false);
      return;
    }

    if (!orgSlug || typeof orgSlug !== 'string' || orgSlug.trim() === '') {
      setError("Organization slug is not available or invalid.");
      console.error("fetchOrgDetailsAndMailrooms: orgSlug is missing or invalid", orgSlug);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setCurrentOrganizationId(null); // Reset on new fetch

    try {
      // Step 1: Fetch Organization Details (including ID)
      const orgDetailsResponse = await fetch(`/api/organizations/details?slug=${orgSlug}`, { // Assumed API endpoint
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!orgDetailsResponse.ok) {
        const errorData = await orgDetailsResponse.json();
        throw new Error(errorData.error || `Failed to fetch organization details: ${orgDetailsResponse.status}`);
      }
      const orgDetails: OrgDetails = await orgDetailsResponse.json();
      if (!orgDetails.organizationId) {
        console.log('orgDetails', orgDetails);
        throw new Error('Organization ID not found in organization details.');
      }
      setCurrentOrganizationId(orgDetails.organizationId);
      // setCurrentOrgName(orgDetails.name); // Optional

      // Step 2: Fetch Mailroom Overview Stats (now that we have organizationId if needed by this API)
      const statsResponse = await fetch(`/api/get-org-overview-stats?orgSlug=${orgSlug}`, { // Use orgDetails.id if API needs ID
        // Or if get-org-overview-stats still uses slug, you can keep orgSlug:
        // const statsResponse = await fetch(`/api/get-org-overview-stats?orgSlug=${orgSlug}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!statsResponse.ok) {
        const errorData = await statsResponse.json();
        throw new Error(errorData.error || `Failed to fetch mailroom data: ${statsResponse.status}`);
      }
      const statsData: OrgOverviewStats = await statsResponse.json();
      
      const formattedMailrooms = statsData.mailroomBreakdown.map(mr => ({
        id: mr.mailroomID,
        name: mr.mailroomName,
        slug: mr.mailroomSlug,
        totalPackages: mr.totalPackages,
        packagesPending: mr.packagesAwaitingPickup,
        totalResidents: mr.totalResidents,
        status: mr.mailroomStatus || 'N/A', // If you add status
        totalUsers: mr.totalUsersInMailroom || 0, // If you add user count
      }));
      setMailrooms(formattedMailrooms);

    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred.');
      }
      console.error("Error fetching organization/mailroom data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (router.isReady && orgSlug && session) { // Ensure orgSlug and session are available
      fetchOrgDetailsAndMailrooms();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, session, router.isReady]);

  const handleCreateNewMailroom = () => {
    if (!currentOrganizationId) {
      setError("Organization details are not yet loaded or failed to load. Cannot create mailroom.");
      // Optionally, you could try to re-fetch org details here or guide the user.
      // fetchOrgDetailsAndMailrooms(); // Be careful with re-fetching to avoid loops if it fails consistently.
      alert("Organization details are missing. Please refresh or try again."); // Simple alert
      return;
    }
    setIsCreateMailroomDialogOpen(true);
  };

  const handleViewMailroom = (mailroomSlug: string) => {
    router.push(`/${orgSlug}/${mailroomSlug}`);
  };

  // Determine colspan based on visible columns (Name, Status, Total Pkgs, Pkgs Pending, Users, Residents = 6)
  const visibleColumnCount = 6; 

  const getStatusPillClasses = (status: string): string => {
    const baseClasses = 'inline-block px-2.5 py-1 text-xs font-semibold leading-tight'; // No rounded edges
    switch (status.toUpperCase()) {
      case 'ACTIVE':
        return `${baseClasses} bg-green-100 text-green-700`;
      case 'DEMO':
        return `${baseClasses} bg-blue-100 text-blue-700`;
      case 'DEFUNCT':
        return `${baseClasses} bg-red-100 text-red-700`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-700`; // Default pill style
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-medium text-[#471803]">Mailrooms</h2>

      <div className="bg-white border border-[#471803]/20">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#471803]/20">
            <thead>
              <tr className="bg-white">
                <th className="px-6 py-4 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Mailroom Name</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Total Packages</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Packages Pending</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Users</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Residents</th>
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
              ) : mailrooms.length > 0 ? (
                mailrooms.map((mailroom) => (
                  <tr key={mailroom.id} className="hover:bg-[#fffaf5]">
                    <td className="px-6 py-5 whitespace-nowrap text-sm text-[#471803]">
                      <button
                        onClick={() => handleViewMailroom(mailroom.slug)}
                        className="font-semibold text-[#471803] hover:text-[#5a2004] py-1 px-2 rounded hover:bg-[#F5EFE6] focus:outline-none focus:ring-1 ring-inset focus:ring-[#471803] transition-colors"
                      >
                        {mailroom.name}
                      </button>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm">
                      <span className={getStatusPillClasses(mailroom.status)}>
                        {mailroom.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm text-[#471803]">{mailroom.totalPackages.toLocaleString()}</td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm text-[#471803]">{mailroom.packagesPending.toLocaleString()}</td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm text-[#471803]">{mailroom.totalUsers.toLocaleString()}</td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm text-[#471803]">{mailroom.totalResidents.toLocaleString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={visibleColumnCount} className="px-6 py-10 text-center text-sm text-[#471803]/70 italic">
                    No mailrooms found for this organization.
                  </td>
                </tr>
              )}
              <tr>
                <td colSpan={visibleColumnCount} className="p-0 whitespace-nowrap">
                  <button
                    onClick={handleCreateNewMailroom}
                    className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-[#471803] bg-[#F5EFE6] text-[#471803] text-sm font-medium hover:bg-[#EAE0D5] transition-colors focus:outline-none focus:ring-2 focus:ring-[#471803] focus:ring-opacity-50"
                  >
                    <PlusCircle size={20} className="mr-2" />
                    Create New Mailroom
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <CreateMailroomDialog
        isOpen={isCreateMailroomDialogOpen}
        onClose={() => setIsCreateMailroomDialogOpen(false)}
        onMailroomCreated={() => {
          setIsCreateMailroomDialogOpen(false);
          fetchOrgDetailsAndMailrooms(); // Refresh mailroom list & org details potentially
        }}
        organizationId={currentOrganizationId} // This should now be more reliably set
      />
    </div>
  );
};

export default OrgMailroomsTab; 