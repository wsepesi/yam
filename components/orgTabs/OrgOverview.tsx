import { Home, Package, Users } from "lucide-react";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
  XAxis,
  YAxis,
} from "recharts";

import { useAuth } from "@/context/AuthContext";

// New interface for the multi-line chart data points
interface MonthlyChartDataPoint {
  name: string; // Month name, e.g., "Jan"
  total: number; // Total packages for the org for this month
  [mailroomIdOrName: string]: number | string; // Package count for each mailroom (e.g., mailroom1: 100) OR the month name
}

// Interface for individual mailroom breakdown
interface MailroomBreakdownData {
  mailroomID: string;
  mailroomName: string;
  totalPackages: number;
  totalResidents: number;
  packagesAwaitingPickup: number;
}

// Interface for the overall org stats fetched from the API
interface OrgOverviewStats {
  orgName: string;
  totalMailrooms: number;
  overallTotalPackages: number;
  overallTotalResidents: number;
  monthlyChartData: MonthlyChartDataPoint[]; // New field for multi-line chart
  mailroomBreakdown: MailroomBreakdownData[];
}

// Custom tooltip component for the chart - will need update for multiple lines
const CustomTooltip = ({
  active,
  payload,
  label,
}: TooltipProps<number, string>) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white p-3 border-2 border-[#471803] shadow-md rounded">
        <p className="font-medium text-md text-[#471803]">{`${label} 2025`}</p>{" "}
        {/* TODO: Make year dynamic */}
        {payload.map((pld) => (
          <div
            key={pld.dataKey}
            style={{ color: pld.color }}
            className="text-sm"
          >
            {`${pld.name === "total" ? "Total Org" : pld.name}: `}
            <span className="font-medium">
              {pld.value?.toLocaleString()}
            </span>{" "}
            packages
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Skeleton components
const SkeletonCard = () => (
  <div className="border-2 border-[#471803]/30 bg-[#fffaf5]/70 p-4 animate-pulse">
    <div className="flex justify-between">
      <div>
        <div className="h-4 bg-[#471803]/20 rounded w-3/4 mb-2" />
        <div className="h-8 bg-[#471803]/20 rounded w-1/2 mb-2" />
        <div className="h-3 bg-[#471803]/20 rounded w-1/4" />
      </div>
      <div className="w-10 h-10 bg-[#471803]/20 rounded" />
    </div>
  </div>
);

const SkeletonChart = () => (
  <div className="border-2 border-[#471803]/30 bg-[#fffaf5]/70 p-6 animate-pulse">
    <div className="h-6 bg-[#471803]/20 rounded w-1/3 mb-4" />
    <div className="h-64 bg-[#471803]/20 rounded" />
  </div>
);

// const SkeletonTable = () => (
//   <div className="border-2 border-[#471803]/30 bg-[#fffaf5]/70 p-6 animate-pulse">
//     <div className="h-6 bg-[#471803]/20 rounded w-1/3 mb-4"></div>
//     <div className="space-y-2">
//       {[...Array(3)].map((_, i) => (
//         <div key={i} className="h-10 bg-[#471803]/20 rounded"></div>
//       ))}
//     </div>
//   </div>
// );

export default function OrgOverview() {
  const { session } = useAuth();
  const router = useRouter();
  const { org: orgSlug } = router.query;

  const [stats, setStats] = useState<OrgOverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrgStats = async () => {
      if (!orgSlug || typeof orgSlug !== "string") {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        if (!session?.access_token) {
          setError("Authentication required. Please log in.");
          setLoading(false);
          return;
        }

        const response = await fetch(
          `/api/get-org-overview-stats?orgSlug=${orgSlug}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || `Failed to fetch org stats: ${response.status}`
          );
        }
        const data: OrgOverviewStats = await response.json();
        setStats(data);
        setError(null);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("An unknown error occurred");
        }
        console.error("Error fetching org overview stats:", err);
      } finally {
        setLoading(false);
      }
    };

    if (router.isReady) {
      fetchOrgStats();
    }
  }, [session, orgSlug, router.isReady]);

  if (loading) {
    return (
      <div className="w-full space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonChart />
        {/* <SkeletonTable /> */}
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full text-center p-10 text-red-600">Error: {error}</div>
    );
  }

  if (!stats) {
    if (!error) {
      return (
        <div className="w-full text-center p-10">
          No data available for this organization.
        </div>
      );
    }
    return null;
  }

  return (
    <div className="w-full space-y-6 flex-1 overflow-y-auto pr-2 max-h-[70vh]">
      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="border-2 border-[#471803] bg-[#fffaf5] p-4">
          <div className="flex justify-between">
            <div>
              <h3 className="text-sm text-[#471803]/70 mb-1">
                Total Packages (Org)
              </h3>
              <p className="text-3xl font-bold text-[#471803]">
                {stats.overallTotalPackages.toLocaleString()}
              </p>
            </div>
            <Package className="text-[#471803] opacity-70" size={40} />
          </div>
        </div>

        <div className="border-2 border-[#471803] bg-[#fffaf5] p-4">
          <div className="flex justify-between">
            <div>
              <h3 className="text-sm text-[#471803]/70 mb-1">
                Total Residents (Org)
              </h3>
              <p className="text-3xl font-bold text-[#471803]">
                {stats.overallTotalResidents.toLocaleString()}
              </p>
            </div>
            <Users className="text-[#471803] opacity-70" size={40} />
          </div>
        </div>

        <div className="border-2 border-[#471803] bg-[#fffaf5] p-4">
          <div className="flex justify-between">
            <div>
              <h3 className="text-sm text-[#471803]/70 mb-1">
                Number of Mailrooms
              </h3>
              <p className="text-3xl font-bold text-[#471803]">
                {stats.totalMailrooms.toLocaleString()}
              </p>
            </div>
            <Home className="text-[#471803] opacity-70" size={40} />{" "}
            {/* Using Home icon for mailrooms */}
          </div>
        </div>
      </div>

      {/* Org Package Volume Chart */}
      <div className="border-2 border-[#471803] bg-[#fffaf5] p-6">
        <h3 className="text-lg font-medium text-[#471803] mb-4">
          Organization Package Volume (Last 6 Months)
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.monthlyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffeedd" />
              <XAxis dataKey="name" stroke="#471803" />
              <YAxis stroke="#471803" />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="total"
                name="Total Org"
                stroke="#471803" // Main org color
                strokeWidth={2.5}
                dot={{
                  stroke: "#471803",
                  strokeWidth: 2,
                  r: 4,
                  fill: "#fffaf5",
                }}
                activeDot={{
                  r: 6,
                  stroke: "#471803",
                  strokeWidth: 2,
                  fill: "#ffeedd",
                }}
              />
              {stats.mailroomBreakdown.map((mailroom, index) => {
                // Define a list of distinct colors, or use a color generation function
                const colors = [
                  "#d97706",
                  "#059669",
                  "#2563eb",
                  "#7c3aed",
                  "#db2777",
                ];
                const color = colors[index % colors.length];
                return (
                  <Line
                    key={mailroom.mailroomID}
                    type="monotone"
                    dataKey={mailroom.mailroomID} // Use mailroomID as dataKey
                    name={mailroom.mailroomName} // Use mailroomName for tooltip/legend
                    stroke={color}
                    strokeWidth={1.5}
                    dot={{
                      stroke: color,
                      strokeWidth: 1,
                      r: 3,
                      fill: "#fffaf5",
                    }}
                    activeDot={{
                      r: 5,
                      stroke: color,
                      strokeWidth: 1,
                      fill: "#ffeedd",
                    }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Mailroom Breakdown Table
      <div className="border-2 border-[#471803] bg-[#fffaf5] p-6">
        <h3 className="text-lg font-medium text-[#471803] mb-4">Mailroom Breakdown</h3>
        {stats.mailroomBreakdown.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#ffeedd]">
              <thead className="bg-[#fffaf5]">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[#471803] uppercase tracking-wider">
                    Mailroom Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[#471803] uppercase tracking-wider">
                    Total Packages
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[#471803] uppercase tracking-wider">
                    Total Residents
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[#471803] uppercase tracking-wider">
                    Awaiting Pickup
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-[#ffeedd]">
                {stats.mailroomBreakdown.map((mailroom) => (
                  <tr key={mailroom.mailroomID} className="hover:bg-[#fffaf5]/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#471803]">
                      {mailroom.mailroomName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {mailroom.totalPackages.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {mailroom.totalResidents.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {mailroom.packagesAwaitingPickup.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No mailroom data available for this organization.</p>
        )}
      </div> */}
    </div>
  );
}
