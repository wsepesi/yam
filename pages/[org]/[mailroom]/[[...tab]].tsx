import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getMailroomDisplayName, getOrgDisplayName } from '@/lib/userPreferences';

import Layout from '@/components/Layout';
import ManageEmailContent from '@/components/mailroomTabs/ManageEmailContent';
import ManageManagers from '@/components/mailroomTabs/ManageManagers';
import ManagePackages from '@/components/mailroomTabs/ManagePackages';
import ManageRoster from '@/components/mailroomTabs/ManageRoster';
import ManageUsers from '@/components/mailroomTabs/ManageUsers';
// Import all tab components
import Overview from '@/components/mailroomTabs/Overview';
import Pickup from '@/components/mailroomTabs/Pickup';
import Register from '@/components/mailroomTabs/RegisterPackage'
import UserTabPageSkeleton from '@/components/UserTabPageSkeleton';
import { useRouter } from 'next/router';
import { useUserRole } from '@/context/AuthContext';
import { withAuth } from '@/components/withAuth';

// Define the possible tab values for each role
const USER_TABS = ['overview', 'pickup', 'register'] as const;
const MANAGER_TABS = ['manage users', 'manage roster', 'manage packages', 'manage managers', 'manage email content'] as const;
const ADMIN_TABS = [] as const; // Keeping admin section in code but empty for now

// Tab configuration mapping
const TAB_CONFIG = {
  'overview': {
    title: 'overview',
    Component: Overview
  },
  'pickup': {
    title: 'pickup',
    Component: Pickup
  },
  'register': {
    title: 'register',
    Component: Register
  },
  'manage users': {
    title: 'manage users',
    Component: ManageUsers
  },
  'manage roster': {
    title: 'manage roster',
    Component: ManageRoster
  },
  'manage packages': {
    title: 'manage packages',
    Component: ManagePackages
  },
  'manage managers': {
    title: 'manage managers',
    Component: ManageManagers
  },
  'manage email content': {
    title: 'manage email content',
    Component: ManageEmailContent
  }
} as const;

type UserTabType = typeof USER_TABS[number];
type ManagerTabType = typeof MANAGER_TABS[number];
type AdminTabType = typeof ADMIN_TABS[number];
type TabType = UserTabType | ManagerTabType | AdminTabType;

// We'll use the userPreferences synchronous functions for now
// The page already has many state updates so doing this async would complicate things

export function UserTabPage() {
  const router = useRouter();
  const { tab, org: orgQuery, mailroom: mailroomQuery } = router.query; // Destructure with new names
  const { role, isLoading } = useUserRole();
  const [orgDisplayName, setOrgDisplayName] = useState<string>('');
  const [mailroomDisplayName, setMailroomDisplayName] = useState<string>('');
  const [isValidating, setIsValidating] = useState(true);

  // Refs to store previously validated slugs
  const prevOrgSlugRef = useRef<string | undefined>(undefined);
  const prevMailroomSlugRef = useRef<string | undefined>(undefined);

  // Memoize orgSlug and mailroomSlug
  const orgSlug = useMemo((): string | undefined => (typeof orgQuery === 'string' ? orgQuery : undefined), [orgQuery]);
  const mailroomSlug = useMemo((): string | undefined => (typeof mailroomQuery === 'string' ? mailroomQuery : undefined), [mailroomQuery]);

  // Get available tabs based on role
  const AVAILABLE_TABS = React.useMemo(() => {
    const tabs: TabType[] = [...USER_TABS];
    if (role === 'manager' || role === 'admin') {
      tabs.push(...MANAGER_TABS);
    }
    if (role === 'admin') {
      tabs.push(...ADMIN_TABS);
    }
    return tabs;
  }, [role]);

  // Extract the actual tab value (first element if array, or undefined)
  const currentTabValue = React.useMemo(() => {
    if (Array.isArray(tab)) {
      return tab[0]?.replace(/-/g, ' ');
    }
    return tab?.replace(/-/g, ' ');
  }, [tab]);

  // useEffect for org and mailroom validation, and setting display names
  useEffect(() => {
    if (!router.isReady) {
      setIsValidating(true);
      return;
    }

    if (!orgSlug || !mailroomSlug) {
      // If slugs are missing after router is ready, it's likely an invalid path
      router.replace('/404');
      return;
    }

    const needsValidation =
      !orgDisplayName || // Org display name not fetched
      !mailroomDisplayName || // Mailroom display name not fetched
      orgSlug !== prevOrgSlugRef.current || // Org slug changed
      mailroomSlug !== prevMailroomSlugRef.current; // Mailroom slug changed

    if (needsValidation) {
      const validateOrgAndMailroom = async () => {
        setIsValidating(true);
        try {
          // 1. Validate Org (async)
          const fetchedOrgDisplayName = await getOrgDisplayName(orgSlug!);
          if (!fetchedOrgDisplayName) {
            router.replace('/404');
            return;
          }
          setOrgDisplayName(fetchedOrgDisplayName);
          prevOrgSlugRef.current = orgSlug; // Store current orgSlug after successful validation

          // 2. Validate Mailroom (async)
          const fetchedMailroomDisplayName = await getMailroomDisplayName(mailroomSlug!);
          if (!fetchedMailroomDisplayName) {
            router.replace('/404');
            return;
          }
          setMailroomDisplayName(fetchedMailroomDisplayName);
          prevMailroomSlugRef.current = mailroomSlug; // Store current mailroomSlug after successful validation

        } catch (error) {
          console.error("Error validating org or mailroom:", error);
          router.replace('/404');
        } finally {
          setIsValidating(false);
        }
      };
      validateOrgAndMailroom();
    } else {
      // Slugs haven't changed and display names are present, no need to re-validate
      setIsValidating(false);
    }
  }, [router.isReady, orgSlug, mailroomSlug, orgDisplayName, mailroomDisplayName, router]);

  // Store current tab in sessionStorage when it changes
  useEffect(() => {
    if (router.isReady && currentTabValue && orgSlug && mailroomSlug) {
      try {
        sessionStorage.setItem(`${orgSlug}-${mailroomSlug}-tab`, currentTabValue);
      } catch (error) {
        console.error('Error storing tab in sessionStorage:', error);
      }
    }
  }, [router.isReady, currentTabValue, orgSlug, mailroomSlug]);

  // Cleanup sessionStorage on unmount
  useEffect(() => {
    // This function will be called when the component unmounts
    return () => {
      if (orgSlug && mailroomSlug) {
        try {
          sessionStorage.removeItem(`${orgSlug}-${mailroomSlug}-tab`);
          console.log(`Cleaned up sessionStorage for ${orgSlug}-${mailroomSlug}-tab`);
        } catch (error) {
          console.error('Error removing tab from sessionStorage on unmount:', error);
        }
      }
    };
  }, [orgSlug, mailroomSlug]); // Rerun if orgSlug or mailroomSlug change

  // Determine the active tab based on URL, using the extracted value
  const activeTab: TabType = React.useMemo(() => {
    if (!router.isReady) return 'overview';
    if (!currentTabValue) return 'overview';
    if (!AVAILABLE_TABS.includes(currentTabValue as TabType)) return 'overview';
    return currentTabValue as TabType;
  }, [router.isReady, currentTabValue, AVAILABLE_TABS]);

  // Handle invalid tabs and redirect to overview
  useEffect(() => {
    if (router.isReady && orgSlug && mailroomSlug) {
      // Only redirect if we have:
      // 1. A tab value that's not empty
      // 2. Available tabs are loaded
      // 3. The current tab isn't in the available tabs
      if (currentTabValue &&
          AVAILABLE_TABS.length > 0 &&
          !AVAILABLE_TABS.includes(currentTabValue as TabType)) {
        router.replace(`/${orgSlug}/${mailroomSlug}`);
      }
    }
  }, [router.isReady, currentTabValue, orgSlug, mailroomSlug, router, AVAILABLE_TABS]);

  // Handle loading state while router is hydrating, auth is loading, or org/mailroom are validating
  if (!router.isReady || isLoading || isValidating) {
    return <Layout title="Package Management" glassy={false}><UserTabPageSkeleton /></Layout>;
  }

  const handleTabClick = (newTab: TabType) => {
    const urlTab = newTab.replace(/\s+/g, '-');
    // Ensure orgSlug and mailroomSlug are defined before using them
    if (!orgSlug || !mailroomSlug) {
      console.error("Org or Mailroom slug is undefined. Cannot navigate.");
      return;
    }
    const path = newTab === 'overview'
      ? `/${orgSlug}/${mailroomSlug}`
      : `/${orgSlug}/${mailroomSlug}/${urlTab}`;

    // Store the selected tab in sessionStorage
    try {
      sessionStorage.setItem(`${orgSlug}-${mailroomSlug}-tab`, newTab);
    } catch (error) {
      console.error('Error storing tab in sessionStorage:', error);
    }

    router.push(path, undefined, { shallow: true });
  };

  // Group tabs by role level
  const userTabs = USER_TABS;
  const managerTabs = (role === 'manager' || role === 'admin') ? MANAGER_TABS : [];
  const adminTabs = (role === 'admin') ? ADMIN_TABS : [];

  // Render the page layout with tabs and active content
  return (
    <Layout title={`${mailroomDisplayName} | Package Management`} glassy={false}>
      <div className="flex flex-col md:flex-row flex-1 h-full">
        <div className="flex flex-col md:flex-row flex-1">
          {/* Sidebar with Tabs */}
          <div className="w-full md:w-48 bg-[#ffeedd] p-4 pt-20 md:h-full overflow-y-auto">
            <nav>
              {userTabs.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xs uppercase text-[#471803] font-bold mb-2">General</h3>
                  <div className="flex flex-col space-y-1">
                    {userTabs.map((tabName) => (
                      <button
                        key={tabName}
                        onClick={() => handleTabClick(tabName)}
                        className={`text-xs px-3 py-2 text-left tracking-wide relative ${
                          activeTab === tabName ? 'text-[#471803] font-bold' : 'text-gray-500'
                        } hover:text-[#471803] transition-colors`}
                      >
                        {tabName}
                        {activeTab === tabName && (
                          <span className="absolute w-full h-[2px] bottom-0 left-0 bg-[#471803]"></span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {managerTabs.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xs uppercase text-[#471803] font-bold mb-2">Management</h3>
                  <div className="flex flex-col space-y-1">
                    {managerTabs.map((tabName) => (
                      <button
                        key={tabName}
                        onClick={() => handleTabClick(tabName)}
                        className={`text-xs px-3 py-2 text-left tracking-wide relative ${
                          activeTab === tabName ? 'text-[#471803] font-bold' : 'text-gray-500'
                        } hover:text-[#471803] transition-colors`}
                      >
                        {tabName}
                        {activeTab === tabName && (
                          <span className="absolute w-full h-[2px] bottom-0 left-0 bg-[#471803]"></span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {adminTabs.length > 0 && (
                <div>
                  <h3 className="text-xs uppercase text-[#471803] font-bold mb-2">Admin</h3>
                  <div className="flex flex-col space-y-1">
                    {adminTabs.map((tabName) => (
                      <button
                        key={tabName}
                        onClick={() => handleTabClick(tabName)}
                        className={`text-xs px-3 py-2 text-left tracking-wide relative ${
                          activeTab === tabName ? 'text-[#471803] font-bold' : 'text-gray-500'
                        } hover:text-[#471803] transition-colors`}
                      >
                        {tabName}
                        {activeTab === tabName && (
                          <span className="absolute w-full h-[2px] bottom-0 left-0 bg-[#471803]"></span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </nav>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 px-12">
            <div className="flex justify-between items-center mb-4 pt-6">
              <h1 className="text-2xl font-medium text-[#471803]">
                <b className='text-2xl'>{mailroomDisplayName}</b> <p className='text-lg inline'>at</p> <p className='text-xl inline'>{orgDisplayName}</p>
                <div className="absolute -bottom-1 right-0 w-[100%] border-b-2 mr-1 border-[#471803]"></div>
              </h1>
              <h2 className="text-xl font-semibold text-[#471803] italic relative">
                {TAB_CONFIG[activeTab] ? TAB_CONFIG[activeTab].title : 'Loading...'}
                <div className="absolute -bottom-1 right-0 w-[100%] border-b-2 border-[#471803]"></div>
              </h2>
            </div>          
            {TAB_CONFIG[activeTab] && React.createElement(TAB_CONFIG[activeTab].Component)}
          </div>
        </div>
      </div>
    </Layout>
  );
}

// Optional: If you need server-side data fetching based on the tab
// export async function getServerSideProps(context) {
//   const { tab } = context.params;
//   // Fetch data based on tab
//   return { props: { initialTab: tab /*, other data */ } };
// }

// Optional: If you are using static generation and know the tabs beforehand
// export async function getStaticPaths() {
//   return {
//     paths: [
//       { params: { tab: 'pickup' } },
//       { params: { tab: 'dropoff' } },
//     ],
//     fallback: false, // or 'blocking' or true if tabs can be added dynamically
//   };
// }

// export async function getStaticProps(context) {
//    const { tab } = context.params;
//    return { props: { initialTab: tab } };
// }

// Export the page wrapped with auth protection
export default withAuth(UserTabPage);