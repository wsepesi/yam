import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";

import Layout from "@/components/Layout";
import OrgMailroomsTab from "@/components/orgTabs/OrgMailroomsTab";
import OrgOverview from "@/components/orgTabs/OrgOverview";
import UserTabPageSkeleton from "@/components/UserTabPageSkeleton";
import { withAuth } from "@/components/withAuth";
import { useUserRole } from "@/context/AuthContext";
import { getOrgDisplayName } from "@/lib/userPreferences";

// Define the possible tab values for the organization page
const ORG_TABS = ["overview", "mailrooms"] as const; // Add other org-level tabs here in the future
// const ORG_ADMIN_TABS = ['settings', 'manage mailrooms'] as const; // Example for future expansion

// Tab configuration mapping
const TAB_CONFIG = {
  overview: {
    title: "overview",
    Component: OrgOverview,
  },
  mailrooms: {
    title: "Mailrooms",
    Component: OrgMailroomsTab,
  },
  // Future tabs:
  // 'settings': {
  //   title: 'Settings',
  //   Component: OrgSettings, // Placeholder for a future component
  // },
  // 'manage mailrooms': {
  //   title: 'Manage Mailrooms',
  //   Component: ManageOrgMailrooms, // Placeholder for a future component
  // },
} as const;

type OrgTabType = (typeof ORG_TABS)[number];

const OrgIndexPage: React.FC = () => {
  const router = useRouter();
  const { org, tab } = router.query; // 'tab' might come from URL if we implement it
  const { role, isLoading: isRoleLoading } = useUserRole();
  const [orgDisplayName, setOrgDisplayName] = useState<string>("");
  const [isValidating, setIsValidating] = useState(true); // New state for validation

  // For now, only 'admin' can see this page as per original withAuth
  // We can expand AVAILABLE_TABS based on more granular org roles if needed
  const AVAILABLE_TABS = React.useMemo(() => {
    if (role === "admin" || role === "super-admin") {
      return [...ORG_TABS];
    }
    return []; // No tabs for other roles on this page for now
  }, [role]);

  // Extract the actual tab value (first element if array, or undefined)
  // For org page, default to 'overview' if no tab in URL
  const currentTabValue = React.useMemo(() => {
    let tabVal = Array.isArray(tab) ? tab[0] : tab;
    tabVal = tabVal?.replace(/-/g, " ") || "overview"; // Default to overview
    return tabVal;
  }, [tab]);

  // Determine the active tab
  const activeTab: OrgTabType = React.useMemo(() => {
    if (!router.isReady) return "overview"; // Default during hydration
    if (!AVAILABLE_TABS.includes(currentTabValue as OrgTabType)) {
      // If currentTab is invalid or not available for the role, default to the first available tab or overview
      return AVAILABLE_TABS.length > 0 ? AVAILABLE_TABS[0] : "overview";
    }
    return currentTabValue as OrgTabType;
  }, [router.isReady, currentTabValue, AVAILABLE_TABS]);

  // Validate org and set display name
  useEffect(() => {
    if (!router.isReady) {
      setIsValidating(true);
      return;
    }

    const orgSlug = typeof org === "string" ? org : undefined;

    if (!orgSlug) {
      router.replace("/404"); // Should not happen if Next.js routing is correct, but good for safety
      return;
    }

    const validateAndSetOrgName = async () => {
      setIsValidating(true);
      try {
        const fetchedOrgDisplayName = await getOrgDisplayName(orgSlug);
        if (!fetchedOrgDisplayName) {
          router.replace("/404"); // Org not found
        } else {
          setOrgDisplayName(fetchedOrgDisplayName);
        }
      } catch (error) {
        console.error("Error validating org:", error);
        router.replace("/404");
      } finally {
        setIsValidating(false);
      }
    };

    validateAndSetOrgName();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, org]);

  // Handle invalid tabs in URL query and redirect if necessary
  useEffect(() => {
    if (
      router.isReady &&
      AVAILABLE_TABS.length > 0 &&
      typeof org === "string"
    ) {
      const rawTabQueryParam = Array.isArray(router.query.tab)
        ? router.query.tab[0]
        : router.query.tab;

      if (rawTabQueryParam) {
        // Only act if a tab is specified in the URL query
        const normalizedRawTab = rawTabQueryParam.replace(/-/g, " ");
        if (!AVAILABLE_TABS.includes(normalizedRawTab as OrgTabType)) {
          // The tab from URL query is invalid or not available. Redirect.
          const defaultAvailableTab = AVAILABLE_TABS[0]; // Assumes AVAILABLE_TABS[0] is valid
          const defaultUrlQuerySegment = defaultAvailableTab.replace(
            /\s+/g,
            "-"
          );

          if (defaultAvailableTab === "overview") {
            router.replace(`/${org}`, undefined, { shallow: true });
          } else {
            router.replace(`/${org}?tab=${defaultUrlQuerySegment}`, undefined, {
              shallow: true,
            });
          }
        }
      }
    }
    // Adding router.query.tab to dependencies as it's directly used.
  }, [router.isReady, router.query.tab, org, AVAILABLE_TABS, router]);

  // Handle loading state
  if (!router.isReady || isRoleLoading || isValidating) {
    return (
      <Layout title="Organization Dashboard" glassy={false}>
        <UserTabPageSkeleton />
      </Layout>
    );
  }

  if (AVAILABLE_TABS.length === 0 && !isRoleLoading) {
    return (
      <Layout title="Access Denied" glassy={false}>
        <div className="flex flex-col items-center justify-center h-full">
          <h1 className="text-2xl font-semibold text-gray-700">
            Access Denied
          </h1>
          <p className="text-gray-500">
            You do not have permission to view this page.
          </p>
        </div>
      </Layout>
    );
  }

  const handleTabClick = (newTab: OrgTabType) => {
    const urlTabSegment = newTab.replace(/\s+/g, "-");
    let path;
    if (newTab === "overview") {
      path = `/${org}`;
    } else {
      path = `/${org}?tab=${urlTabSegment}`;
    }
    router.push(path, undefined, { shallow: true });
  };

  const TabComponent = TAB_CONFIG[activeTab]?.Component;

  return (
    <Layout title={`${orgDisplayName} | Organization Dashboard`} glassy={false}>
      <div className="flex flex-col md:flex-row flex-1 h-full">
        {/* Sidebar with Tabs */}
        <div className="w-full md:w-48 bg-[#ffeedd] p-4 pt-20 md:h-full overflow-y-auto">
          <nav>
            {AVAILABLE_TABS.length > 0 && (
              <div className="mb-6">
                {/* No sub-headings like 'General' needed if only one tab type for now */}
                <div className="flex flex-col space-y-1">
                  {AVAILABLE_TABS.map((tabName) => (
                    <button
                      key={tabName}
                      onClick={() => handleTabClick(tabName)}
                      className={`text-xs px-3 py-2 text-left tracking-wide relative ${
                        activeTab === tabName
                          ? "text-[#471803] font-bold"
                          : "text-gray-500"
                      } hover:text-[#471803] transition-colors`}
                    >
                      {tabName}
                      {activeTab === tabName && (
                        <span className="absolute w-full h-[2px] bottom-0 left-0 bg-[#471803]" />
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
              <b className="text-2xl">{orgDisplayName}</b>{" "}
              <p className="text-lg inline" />
              <div className="absolute -bottom-1 right-0 w-[100%] border-b-2 mr-1 border-[#471803]" />
            </h1>
            {TAB_CONFIG[activeTab]?.title && (
              <h2 className="text-xl font-semibold text-[#471803] italic relative">
                {TAB_CONFIG[activeTab].title}
                <div className="absolute -bottom-1 right-0 w-[100%] border-b-2 border-[#471803]" />
              </h2>
            )}
          </div>
          {TabComponent ? <TabComponent /> : <p>Tab content not found.</p>}
        </div>
      </div>
    </Layout>
  );
};

// Wrap the component with withAuth to ensure authenticated access (e.g., 'admin' or new 'org_admin' role)
export default withAuth(OrgIndexPage, "admin");
