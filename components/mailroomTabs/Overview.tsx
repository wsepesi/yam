import { Calendar, Package, Users } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, TooltipProps, XAxis, YAxis } from 'recharts';
import React, { useEffect, useState } from 'react';

import { MailroomTabProps } from '@/lib/types/MailroomTabProps';
import { useAuth } from '@/context/AuthContext';

// Interface for individual month data in the chart (matches API)
interface PackageData {
  name: string; // e.g., 'Nov'
  packages: number;
  increase: number;
}

// Interface for the overall stats fetched from the API
interface MailroomStats {
  totalPackagesCount: number;
  totalPackagesIncrease: number;
  currentResidentsCount: number;
  awaitingPickupCount: number;
  awaitingPickupTodayCount: number;
  packageVolumeMonthly: PackageData[];
}

// Custom tooltip component for the chart
const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as PackageData; // This casting remains correct
    return (
      <div className="bg-white p-3 border-2 border-[#471803] shadow-md">
        <p className="font-medium">{`${data.name} 2025`}</p>
        <p className="text-sm">Total: <span className="font-medium">{data.packages}</span> packages</p>
        <p className="text-sm text-green-600">+{data.increase} from previous month</p>
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
        <div className="h-4 bg-[#471803]/20 rounded w-3/4 mb-2"></div>
        <div className="h-8 bg-[#471803]/20 rounded w-1/2 mb-2"></div>
        <div className="h-3 bg-[#471803]/20 rounded w-1/4"></div>
      </div>
      <div className="w-10 h-10 bg-[#471803]/20 rounded"></div>
    </div>
  </div>
);

const SkeletonChart = () => (
  <div className="border-2 border-[#471803]/30 bg-[#fffaf5]/70 p-6 animate-pulse">
    <div className="h-6 bg-[#471803]/20 rounded w-1/3 mb-4"></div>
    <div className="h-64 bg-[#471803]/20 rounded"></div>
  </div>
);

export default function Overview({ orgSlug, mailroomSlug }: MailroomTabProps) {
  const { session } = useAuth();
  const [stats, setStats] = useState<MailroomStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        if (!session || !session.access_token) {
          setError('Authentication required. Please log in.');
          setLoading(false);
          return;
        }
        if (!orgSlug || !mailroomSlug) {
          setError('Organization or Mailroom not specified.');
          setLoading(false);
          return;
        }

        const response = await fetch(`/api/get-packages-mailroom?orgSlug=${encodeURIComponent(orgSlug)}&mailroomSlug=${encodeURIComponent(mailroomSlug)}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch stats: ${response.status}`);
        }
        const data: MailroomStats = await response.json();
        setStats(data);
        setError(null);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An unknown error occurred');
        }
        console.error("Error fetching mailroom stats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [session, orgSlug, mailroomSlug]);

  if (loading) {
    return (
      <div className="w-full space-y-10">
        {/* Skeleton for Stats cards */}
        <div className="grid grid-cols-3 gap-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        {/* Skeleton for Chart */}
        <SkeletonChart />
      </div>
    );
  }

  if (error) {
    return <div className="w-full text-center p-10 text-red-600">Error: {error}</div>;
  }

  if (!stats) {
    if (!error) {
      return <div className="w-full text-center p-10">No data available.</div>;
    }
    return null;
  }

  return (
    <div className="w-full space-y-10">
      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-6">
        <div className="border-2 border-[#471803] bg-[#fffaf5] p-4">
          <div className="flex justify-between">
            <div>
              <h3 className="text-sm text-[#471803]/70 mb-1">Total Packages</h3>
              <p className="text-3xl font-bold text-[#471803]">{stats.totalPackagesCount.toLocaleString()}</p>
              {stats.totalPackagesIncrease !== 0 && (
                <p className={`text-sm ${stats.totalPackagesIncrease > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {stats.totalPackagesIncrease > 0 ? '+' : ''}{stats.totalPackagesIncrease} this month
                </p>
              )}
            </div>
            <Package className="text-[#471803] opacity-70" size={40} />
          </div>
        </div>
        
        <div className="border-2 border-[#471803] bg-[#fffaf5] p-4">
          <div className="flex justify-between">
            <div>
              <h3 className="text-sm text-[#471803]/70 mb-1">Current Residents</h3>
              <p className="text-3xl font-bold text-[#471803]">{stats.currentResidentsCount.toLocaleString()}</p>
            </div>
            <Users className="text-[#471803] opacity-70" size={40} />
          </div>
        </div>
        
        <div className="border-2 border-[#471803] bg-[#fffaf5] p-4">
          <div className="flex justify-between">
            <div>
              <h3 className="text-sm text-[#471803]/70 mb-1">Awaiting Pickup</h3>
              <p className="text-3xl font-bold text-[#471803]">{stats.awaitingPickupCount.toLocaleString()}</p>
              {stats.awaitingPickupTodayCount > 0 && (
                <p className="text-[#471803]/70 text-sm">{stats.awaitingPickupTodayCount} new today</p>
              )}
            </div>
            <Calendar className="text-[#471803] opacity-70" size={40} />
          </div>
        </div>
      </div>
      
      {/* Chart */}
      <div className="border-2 border-[#471803] bg-[#fffaf5] p-6 -mt-4">
        <h3 className="text-lg font-medium text-[#471803] mb-4">Package Volume (Last 6 Months)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.packageVolumeMonthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffeedd" />
              <XAxis dataKey="name" stroke="#471803" />
              <YAxis stroke="#471803" />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="packages" 
                stroke="#471803" 
                strokeWidth={2}
                dot={{ stroke: '#471803', strokeWidth: 2, r: 4, fill: '#fffaf5' }}
                activeDot={{ r: 6, stroke: '#471803', strokeWidth: 2, fill: '#ffeedd' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
} 