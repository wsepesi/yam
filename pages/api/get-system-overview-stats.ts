import { NextApiRequest, NextApiResponse } from 'next';

import { createAdminClient } from '@/lib/supabase';
import getUserId from '@/lib/handleSession';

// Define interfaces for the data structure
interface SystemMonthlyChartDataPoint {
  name: string; // Month name
  totalPackages: number;
  // Potentially other system-wide metrics
}

interface SystemOverviewStats {
  totalOrganizations: number;
  totalUsers: number; // Across all orgs
  totalMailrooms: number; // System-wide
  overallTotalPackages: number; // System-wide
  monthlyChartData: SystemMonthlyChartDataPoint[];
  // Potentially other stats like active users, new sign-ups etc.
}

// Helper function to get month-year strings for the chart
const getMonthYearStrings = (numMonths: number): { name: string, isoMonth: string }[] => {
  const months: { name: string, isoMonth: string }[] = [];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentDate = new Date();
  for (let i = 0; i < numMonths; i++) {
    const monthIndex = currentDate.getMonth();
    const year = currentDate.getFullYear();
    months.unshift({ 
        name: `${monthNames[monthIndex]} ${year % 100}`, // e.g., "Jun 24"
        isoMonth: `${year}-${(monthIndex + 1).toString().padStart(2, '0')}` // e.g., "2024-06"
    });
    currentDate.setMonth(currentDate.getMonth() - 1);
  }
  return months;
};

// interface PackageTimestamp { // Interface for package creation dates
//     created_at: string;
// }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseAdmin = createAdminClient();
  try {
    const authHeader = req.headers.authorization;
    const userId = await getUserId(supabaseAdmin, authHeader);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Fetch current user's profile to check permissions
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileError || !userProfile) {
      return res.status(400).json({ error: 'Could not fetch user profile' });
    }

    // Authorization: Only super-admins can access system overview stats
    if (userProfile.role !== 'super-admin') {
      return res.status(403).json({ error: 'User does not have permission to access system overview statistics.' });
    }

    // --- Fetch Real Data ---
    const totalOrganizations = await supabaseAdmin.from('organizations').select('id', { count: 'exact', head: true }).then(r => r.count || 0);
    const totalUsers = await supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).then(r => r.count || 0);
    const totalMailrooms = await supabaseAdmin.from('mailrooms').select('id', { count: 'exact', head: true }).then(r => r.count || 0);
    
    const { count: overallTotalPackages, error: packagesError } = await supabaseAdmin
      .from('packages')
      .select('id', { count: 'exact', head: true });

    if (packagesError) {
      console.error('Error fetching total packages count:', packagesError);
      // Decide if this is a critical error or if you can proceed with a count of 0 or partial data
      return res.status(500).json({ error: `Failed to fetch total packages: ${packagesError.message}` });
    }
    
    const numMonthsForChart = 6;
    const monthYearStrings = getMonthYearStrings(numMonthsForChart);
    
    const initialMonthlyChartData: SystemMonthlyChartDataPoint[] = monthYearStrings.map(m => ({
      name: m.name,
      totalPackages: 0,
    }));

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - numMonthsForChart + 1);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0,0,0,0);

    const { data: monthlyPackagesRaw, error: monthlyPackagesError } = await supabaseAdmin
      .from('packages')
      .select('created_at')
      .gte('created_at', sixMonthsAgo.toISOString());

    if (monthlyPackagesError) {
      console.error('Error fetching monthly package data:', monthlyPackagesError);
      // Decide if this is critical or if you can proceed with empty chart data
      return res.status(500).json({ error: `Failed to fetch monthly package data: ${monthlyPackagesError.message}` });
    }
    
    const finalMonthlyChartData = initialMonthlyChartData.reduce((acc, monthData) => {
        const monthPackages = monthlyPackagesRaw?.filter(pkg => {
            const pkgDate = new Date(pkg.created_at);
            return `${pkgDate.getFullYear()}-${(pkgDate.getMonth() + 1).toString().padStart(2, '0')}` === monthYearStrings.find(m => m.name === monthData.name)?.isoMonth;
        }).length || 0;
        
        acc.push({ ...monthData, totalPackages: monthPackages });
        return acc;
    }, [] as SystemMonthlyChartDataPoint[]);


    // --- End Fetch Real Data ---

    const stats: SystemOverviewStats = {
      totalOrganizations,
      totalUsers,
      totalMailrooms,
      overallTotalPackages: overallTotalPackages || 0, // Use fetched count
      monthlyChartData: finalMonthlyChartData, // Use fetched and processed data
    };

    res.setHeader('Cache-Control', 'private, s-maxage=60, stale-while-revalidate=120');
    return res.status(200).json(stats);

  } catch (error) {
    console.error('Error fetching system overview stats:', error);
    if (error instanceof Error) {
        return res.status(500).json({ error: error.message });
    }
    return res.status(500).json({ error: 'An unexpected error occurred on the server.' });
  }
} 