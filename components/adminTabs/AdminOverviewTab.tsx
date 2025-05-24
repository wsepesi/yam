import { Building2, Home, Package, Users } from "lucide-react";
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

// Interfaces from the API endpoint
interface SystemMonthlyChartDataPoint {
  name: string;
  totalPackages: number;
}

interface SystemOverviewStats {
  totalOrganizations: number;
  totalUsers: number;
  totalMailrooms: number;
  overallTotalPackages: number;
  monthlyChartData: SystemMonthlyChartDataPoint[];
}

// Custom tooltip for the chart
const CustomTooltip = ({
  active,
  payload,
  label,
}: TooltipProps<number, string>) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white p-3 border-2 border-gray-500 shadow-md">
        <p className="font-medium text-md text-gray-700">{`${label} 2025`}</p>{" "}
        {/* TODO: Make year dynamic */}
        {payload.map((pld) => (
          <div
            key={pld.dataKey}
            style={{ color: pld.color }}
            className="text-sm"
          >
            {`${pld.name ?? "Total Packages"}: `}
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

// Skeleton components (can be shared or specific if styling differs)
const SkeletonCard = ({ isAdminTheme = false }: { isAdminTheme?: boolean }) => {
  const borderColor = isAdminTheme
    ? "border-[#471803]/30"
    : "border-[#471803]/30";
  const bgColor = isAdminTheme ? "bg-[#fffaf5]/70" : "bg-[#fffaf5]/70";
  const itemColor = isAdminTheme ? "bg-[#471803]/20" : "bg-[#471803]/20";

  return (
    <div className={`border-2 ${borderColor} ${bgColor} p-4 animate-pulse`}>
      <div className="flex justify-between">
        <div>
          <div className={`h-4 ${itemColor} w-3/4 mb-2`} />
          <div className={`h-8 ${itemColor} w-1/2 mb-2`} />
          <div className={`h-3 ${itemColor} w-1/4`} />
        </div>
        <div className={`w-10 h-10 ${itemColor}`} />
      </div>
    </div>
  );
};

const SkeletonChart = ({
  isAdminTheme = false,
}: {
  isAdminTheme?: boolean;
}) => {
  const borderColor = isAdminTheme
    ? "border-[#471803]/30"
    : "border-[#471803]/30";
  const bgColor = isAdminTheme ? "bg-[#fffaf5]/70" : "bg-[#fffaf5]/70";
  const itemColor = isAdminTheme ? "bg-[#471803]/20" : "bg-[#471803]/20";
  return (
    <div className={`border-2 ${borderColor} ${bgColor} p-6 animate-pulse`}>
      <div className={`h-6 ${itemColor} w-1/3 mb-4`} />
      <div className={`h-64 ${itemColor}`} />
    </div>
  );
};

export default function AdminOverviewTab() {
  const { session } = useAuth();
  const [stats, setStats] = useState<SystemOverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSystemStats = async () => {
      try {
        setLoading(true);
        if (!session?.access_token) {
          setError("Authentication required. Please log in.");
          setLoading(false);
          return;
        }

        const response = await fetch(`/api/get-system-overview-stats`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error ??
              `Failed to fetch system stats: ${response.status}`
          );
        }
        const data: SystemOverviewStats = await response.json();
        setStats(data);
        setError(null);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("An unknown error occurred");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSystemStats();
  }, [session]);

  if (loading) {
    return (
      <div className="w-full space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <SkeletonCard isAdminTheme={true} />
          <SkeletonCard isAdminTheme={true} />
          <SkeletonCard isAdminTheme={true} />
          <SkeletonCard isAdminTheme={true} />
        </div>
        <SkeletonChart isAdminTheme={true} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full text-center p-10 text-red-600">Error: {error}</div>
    );
  }

  if (!stats) {
    return (
      <div className="w-full text-center p-10">No system data available.</div>
    );
  }

  const cardStyle = "border-2 border-[#471803] bg-[#fffaf5] p-4";
  const textMutedStyle = "text-sm text-[#471803]/70 mb-1";
  const textValueStyle = "text-3xl font-bold text-[#471803]";
  const iconStyle = "text-[#471803] opacity-70";

  return (
    <div className="w-full space-y-6 flex-1 overflow-y-auto pr-2 max-h-[70vh]">
      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className={cardStyle}>
          <div className="flex justify-between">
            <div>
              <h3 className={textMutedStyle}>Total Organizations</h3>
              <p className={textValueStyle}>
                {stats.totalOrganizations.toLocaleString()}
              </p>
            </div>
            <Building2 className={iconStyle} size={40} />
          </div>
        </div>
        <div className={cardStyle}>
          <div className="flex justify-between">
            <div>
              <h3 className={textMutedStyle}>Total Mailrooms</h3>
              <p className={textValueStyle}>
                {stats.totalMailrooms.toLocaleString()}
              </p>
            </div>
            <Home className={iconStyle} size={40} />
          </div>
        </div>
        <div className={cardStyle}>
          <div className="flex justify-between">
            <div>
              <h3 className={textMutedStyle}>Total Users</h3>
              <p className={textValueStyle}>
                {stats.totalUsers.toLocaleString()}
              </p>
            </div>
            <Users className={iconStyle} size={40} />
          </div>
        </div>
        <div className={cardStyle}>
          <div className="flex justify-between">
            <div>
              <h3 className={textMutedStyle}>Total Packages (System)</h3>
              <p className={textValueStyle}>
                {stats.overallTotalPackages.toLocaleString()}
              </p>
            </div>
            <Package className={iconStyle} size={40} />
          </div>
        </div>
      </div>

      {/* System Package Volume Chart */}
      <div className="border-2 border-[#471803] bg-[#fffaf5] p-6">
        <h3 className="text-lg font-medium text-[#471803] mb-4">
          System-Wide Package Volume (Last 6 Months)
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
                dataKey="totalPackages"
                name="Total Packages"
                stroke="#471803"
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
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
