import React, { useEffect, useState } from 'react';

import AdminOrganizationsTab from '@/components/adminTabs/AdminOrganizationsTab';
import AdminOverviewTab from '@/components/adminTabs/AdminOverviewTab';
import Layout from '@/components/Layout';
import UserTabPageSkeleton from '@/components/UserTabPageSkeleton';
import { useRouter } from 'next/router';
import { useUserRole } from '@/context/AuthContext';
import { withAuth } from '@/components/withAuth';

// Define the possible tab values for the admin page
const ADMIN_TABS = ['overview', 'organizations'] as const;

// Placeholder components for tab content
// const AdminOverviewTab: React.FC = () => <p>Admin Overview Content</p>;
// const AdminOrganizationsTab: React.FC = () => <p>Admin Organizations Content - List, Create New</p>;

// Tab configuration mapping
const TAB_CONFIG = {
  'overview': {
    title: 'overview',
    Component: AdminOverviewTab,
  },
  'organizations': {
    title: 'organizations',
    Component: AdminOrganizationsTab,
  },
} as const;

type AdminTabType = typeof ADMIN_TABS[number];

const AdminPage: React.FC = () => {
  const router = useRouter();
  const { tab } = router.query;
  const { role, isLoading: isRoleLoading } = useUserRole();
  const [isValidating, setIsValidating] = useState(true); // Using for role check consistency

  // Only 'super-admin' can see this page
  const AVAILABLE_TABS = React.useMemo(() => {
    if (role === 'super-admin') {
      return [...ADMIN_TABS];
    }
    return [];
  }, [role]);

  // Determine the active tab, default to 'overview'
  const activeTab: AdminTabType = React.useMemo(() => {
    if (!router.isReady) return 'overview'; // Default during hydration

    const currentTabValue = (Array.isArray(tab) ? tab[0] : tab)?.replace(/-/g, ' ') || 'overview';

    if (!AVAILABLE_TABS.includes(currentTabValue as AdminTabType)) {
      return AVAILABLE_TABS.length > 0 ? AVAILABLE_TABS[0] as AdminTabType : 'overview';
    }
    return currentTabValue as AdminTabType;
  }, [router.isReady, tab, AVAILABLE_TABS]);

  // Effect for initial validation (e.g. role check simulated delay)
  useEffect(() => {
    if (!isRoleLoading) {
      setIsValidating(false);
    }
  }, [isRoleLoading]);

  // Handle invalid tabs in URL query and redirect if necessary
  useEffect(() => {
    if (router.isReady && AVAILABLE_TABS.length > 0 && role === 'super-admin') {
      const rawTabQueryParam = Array.isArray(router.query.tab) ? router.query.tab[0] : router.query.tab;

      if (rawTabQueryParam) {
        const normalizedRawTab = rawTabQueryParam.replace(/-/g, ' ');
        if (!AVAILABLE_TABS.includes(normalizedRawTab as AdminTabType)) {
          const defaultAvailableTab = AVAILABLE_TABS[0] as AdminTabType;
          const defaultUrlQuerySegment = defaultAvailableTab.replace(/\s+/g, '-');

          if (defaultAvailableTab === 'overview') {
            router.replace('/admin', undefined, { shallow: true });
          } else {
            router.replace(`/admin?tab=${defaultUrlQuerySegment}`, undefined, { shallow: true });
          }
        }
      }
    }
  }, [router.isReady, router.query.tab, role, AVAILABLE_TABS, router]);


  // Handle loading state
  if (!router.isReady || isRoleLoading || isValidating) {
    return <Layout title="Admin Dashboard" glassy={false}><UserTabPageSkeleton /></Layout>;
  }

  if (AVAILABLE_TABS.length === 0 && !isRoleLoading) {
     return (
        <Layout title="Access Denied" glassy={false}>
            <div className="flex flex-col items-center justify-center h-full">
                <h1 className="text-2xl font-semibold text-gray-700">Access Denied</h1>
                <p className="text-gray-500">You do not have permission to view this page. This page is for super-admins only.</p>
            </div>
        </Layout>
     );
  }

  const handleTabClick = (newTab: AdminTabType) => {
    const urlTabSegment = newTab.replace(/\s+/g, '-');
    let path;
    if (newTab === 'overview') {
      path = '/admin';
    } else {
      path = `/admin?tab=${urlTabSegment}`;
    }
    router.push(path, undefined, { shallow: true });
  };

  const TabComponent = TAB_CONFIG[activeTab]?.Component;

  return (
    <Layout title="Yam Admin Dashboard" glassy={false}>
      <div className="flex flex-col md:flex-row flex-1 h-full">
        {/* Sidebar with Tabs */}
        <div className="w-full md:w-48 bg-[#ffeedd] p-4 pt-20 md:h-full overflow-y-auto">
          <nav>
            {AVAILABLE_TABS.length > 0 && (
              <div className="mb-6">
                <div className="flex flex-col space-y-1">
                  {AVAILABLE_TABS.map((tabName) => (
                    <button
                      key={tabName}
                      onClick={() => handleTabClick(tabName)}
                      className={`text-xs px-3 py-2 text-left tracking-wide relative ${
                        activeTab === tabName ? 'text-[#471803] font-bold' : 'text-gray-500'
                      } hover:text-[#471803] transition-colors`}
                    >
                      {TAB_CONFIG[tabName].title}
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
            <h1 className="text-2xl font-medium text-[#471803] relative">
              Yam Admin
              <div className="absolute -bottom-1 right-0 w-[100%] border-b-2 mr-1 border-[#471803]"></div>
            </h1>
            {TAB_CONFIG[activeTab]?.title && (
              <h2 className="text-xl font-semibold text-[#471803] italic relative">
                {TAB_CONFIG[activeTab].title}
                <div className="absolute -bottom-1 right-0 w-[100%] border-b-2 border-[#471803]"></div>
              </h2>
            )}
          </div>
          {TabComponent ? <TabComponent /> : <p>Tab content not found.</p>}
        </div>
      </div>
    </Layout>
  );
};

export default withAuth(AdminPage, 'super-admin'); 