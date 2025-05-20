import React, { useEffect, useState } from 'react'; // Added useEffect, useState

import { PlusCircle } from 'lucide-react'; // Import an icon for the create button
import { useAuth } from '@/context/AuthContext'; // Added useAuth
import { useRouter } from 'next/router';

// Interface for mailroom data fetched from API
interface MailroomData {
  id: string;
  name: string;
  slug: string; // Added slug
  // status: string; // Temporarily removed
  totalPackages: number;
  packagesPending: number;
  // totalUsers: number; // Temporarily removed
  totalResidents: number;
}

// Interface for the API response structure (specifically the part we need)
interface OrgOverviewStats {
  mailroomBreakdown: Array<{
    mailroomID: string;
    mailroomName: string;
    mailroomSlug: string; // Added mailroomSlug
    totalPackages: number;
    packagesAwaitingPickup: number;
    totalResidents: number;
  }>;
}

// Skeleton Row for loading state
const SkeletonRow = () => (
  <tr>
    <td className="px-6 py-5"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td>
    <td className="px-6 py-5"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
    <td className="px-6 py-5"><div className="h-4 bg-gray-200 rounded w-1/4"></div></td>
    <td className="px-6 py-5"><div className="h-4 bg-gray-200 rounded w-1/4"></div></td>
    {/* <td className="px-6 py-5"><div className="h-4 bg-gray-200 rounded w-1/4"></div></td> */}
    {/* <td className="px-6 py-5"><div className="h-4 bg-gray-200 rounded w-1/4"></div></td> */}
  </tr>
);


// Updated placeholder data with new fields
// const MOCK_MAILROOMS = [
//   { id: 'mailroom1', name: 'Main Campus Mailroom', status: 'Active', totalPackages: 1500, packagesPending: 120, totalUsers: 250, totalResidents: 500 },
//   { id: 'mailroom2', name: 'Downtown Annex', status: 'Active', totalPackages: 700, packagesPending: 35, totalUsers: 100, totalResidents: 150 },
//   { id: 'mailroom3', name: 'North Hall', status: 'Inactive', totalPackages: 300, packagesPending: 0, totalUsers: 50, totalResidents: 90 },
// ];

const OrgMailroomsTab: React.FC = () => {
  const router = useRouter();
  const { org: orgSlug } = router.query; // org is orgSlug
  const { session } = useAuth();

  const [mailrooms, setMailrooms] = useState<MailroomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMailroomData = async () => {
      if (!orgSlug || typeof orgSlug !== 'string' || !session?.access_token) {
        setLoading(false);
        if (!session?.access_token) setError("Authentication required.");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/get-org-overview-stats?orgId=${orgSlug}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch mailroom data: ${response.status}`);
        }

        const data: OrgOverviewStats = await response.json();
        
        const formattedMailrooms = data.mailroomBreakdown.map(mr => ({
          id: mr.mailroomID,
          name: mr.mailroomName,
          slug: mr.mailroomSlug, // Added slug
          totalPackages: mr.totalPackages,
          packagesPending: mr.packagesAwaitingPickup,
          totalResidents: mr.totalResidents,
        }));
        setMailrooms(formattedMailrooms);

      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An unknown error occurred while fetching mailroom data.');
        }
        console.error("Error fetching mailroom data:", err);
      } finally {
        setLoading(false);
      }
    };

    if (router.isReady) {
      fetchMailroomData();
    }
  }, [orgSlug, session, router.isReady]);

  const handleCreateNewMailroom = () => {
    console.log(`Navigate to create mailroom page for org: ${orgSlug}`);
    alert('Placeholder: Create New Mailroom functionality');
    // router.push(`/${orgSlug}/mailrooms/new`); // Example future navigation
  };

  const handleViewMailroom = (mailroomSlug: string) => { // Parameter changed to mailroomSlug
    router.push(`/${orgSlug}/${mailroomSlug}`); // Uses mailroomSlug for navigation
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
                {/* <th className="px-6 py-4 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Status</th> */}
                <th className="px-6 py-4 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Total Packages</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Packages Pending</th>
                {/* <th className="px-6 py-4 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Users</th> */}
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
                  <td colSpan={4} className="px-6 py-10 text-center text-sm text-red-600 italic"> {/* Adjusted colSpan */}
                    Error: {error}
                  </td>
                </tr>
              ) : mailrooms.length > 0 ? (
                mailrooms.map((mailroom) => (
                  <tr key={mailroom.id} className="hover:bg-[#fffaf5]">
                    <td className="px-6 py-5 whitespace-nowrap text-sm text-[#471803]">
                      <button
                        onClick={() => handleViewMailroom(mailroom.slug)} // Changed to pass mailroom.slug
                        className="font-semibold hover:text-[#5a2004] hover:underline text-left"
                      >
                        {mailroom.name}
                      </button>
                    </td>
                    {/* <td className="px-6 py-5 whitespace-nowrap text-sm">
                      <span
                        className={`px-2.5 py-1.5 font-semibold leading-tight text-xs ${
                          mailroom.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {mailroom.status}
                      </span>
                    </td> */}
                    <td className="px-6 py-5 whitespace-nowrap text-sm text-[#471803]">{mailroom.totalPackages.toLocaleString()}</td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm text-[#471803]">{mailroom.packagesPending.toLocaleString()}</td>
                    {/* <td className="px-6 py-5 whitespace-nowrap text-sm text-[#471803]">{mailroom.totalUsers.toLocaleString()}</td> */}
                    <td className="px-6 py-5 whitespace-nowrap text-sm text-[#471803]">{mailroom.totalResidents.toLocaleString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-sm text-[#471803]/70 italic"> {/* Adjusted colSpan */}
                    No mailrooms found for this organization.
                  </td>
                </tr>
              )}
              <tr>
                <td colSpan={4} className="p-0 whitespace-nowrap"> {/* Adjusted colSpan */}
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
    </div>
  );
};

export default OrgMailroomsTab; 