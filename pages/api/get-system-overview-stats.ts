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

    // --- Mock Data for now --- 
    // Replace with actual Supabase queries to aggregate system-wide data

    const totalOrganizations = await supabaseAdmin.from('organizations').select('id', { count: 'exact', head: true }).then(r => r.count || 0);
    const totalUsers = await supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).then(r => r.count || 0); // Example: all profiles
    const totalMailrooms = await supabaseAdmin.from('mailrooms').select('id', { count: 'exact', head: true }).then(r => r.count || 0);
    
    // For overallTotalPackages and monthlyChartData, you'd need to aggregate from a 'packages' table or similar.
    // This is a simplified placeholder.
    const overallTotalPackages = 12345;
    const monthlyChartData: SystemMonthlyChartDataPoint[] = [
      { name: 'Jan', totalPackages: 1500 },
      { name: 'Feb', totalPackages: 1800 },
      { name: 'Mar', totalPackages: 2200 },
      { name: 'Apr', totalPackages: 2000 },
      { name: 'May', totalPackages: 2500 },
      { name: 'Jun', totalPackages: 2300 },
    ];
    // --- End Mock Data ---

    const stats: SystemOverviewStats = {
      totalOrganizations,
      totalUsers,
      totalMailrooms,
      overallTotalPackages,
      monthlyChartData,
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