import { NextApiRequest, NextApiResponse } from 'next';

import { createAdminClient } from '@/lib/supabase';
import getUserId from '@/lib/handleSession';

interface PackageData {
  name: string; // e.g., 'Nov'
  packages: number;
  increase: number;
}

interface MailroomStats {
  totalPackagesCount: number;
  totalPackagesIncrease: number;
  currentResidentsCount: number;
  awaitingPickupCount: number;
  awaitingPickupTodayCount: number;
  packageVolumeMonthly: PackageData[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MailroomStats | { error: string }>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabaseAdmin = createAdminClient();
    const authHeader = req.headers.authorization;
    const userId = await getUserId(supabaseAdmin, authHeader);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('mailroom_id')
      .eq('id', userId)
      .single();

    if (profileError || !profileData?.mailroom_id) {
      console.error('Error fetching profile or mailroom_id:', profileError);
      return res.status(400).json({ error: 'User not associated with a mailroom' });
    }

    const mailroomId = profileData.mailroom_id;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(todayStart.getDate() + 1);

    const [
      residentsResult,
      awaitingResult,
      awaitingTodayResult,
      monthlyStatsResult,
    ] = await Promise.all([
      supabaseAdmin
        .from('residents')
        .select('*', { count: 'exact', head: true })
        .eq('mailroom_id', mailroomId),
      supabaseAdmin
        .from('packages')
        .select('*', { count: 'exact', head: true })
        .eq('mailroom_id', mailroomId)
        .eq('status', 'WAITING'),
      supabaseAdmin
        .from('packages')
        .select('*', { count: 'exact', head: true })
        .eq('mailroom_id', mailroomId)
        .eq('status', 'WAITING')
        .gte('created_at', todayStart.toISOString())
        .lt('created_at', tomorrowStart.toISOString()),
      supabaseAdmin.rpc(
        'get_monthly_package_stats_for_mailroom', 
        { p_mailroom_id: mailroomId }
      )
    ]);

    if (residentsResult.error) {
      console.error('Error fetching residents count:', residentsResult.error);
      return res.status(500).json({ error: 'Failed to fetch residents count' });
    }
    const residentsCount = residentsResult.count;

    if (awaitingResult.error) {
      console.error('Error fetching awaiting pickup count:', awaitingResult.error);
      return res.status(500).json({ error: 'Failed to fetch awaiting pickup count' });
    }
    const awaitingPickupCount = awaitingResult.count;

    if (awaitingTodayResult.error) {
      console.error('Error fetching awaiting today count:', awaitingTodayResult.error);
      return res.status(500).json({ error: 'Failed to fetch new packages today count' });
    }
    const awaitingTodayCount = awaitingTodayResult.count;
    
    if (monthlyStatsResult.error) {
        console.error('Error fetching monthly package stats:', monthlyStatsResult.error);
        return res.status(500).json({ error: 'Failed to fetch monthly package statistics' });
    }
    const monthlyPackageStats = monthlyStatsResult.data;
    
    const packageVolumeMonthly: PackageData[] = [];
    let lastMonthPackages = 0;

    if (monthlyPackageStats && Array.isArray(monthlyPackageStats)) {
        for (const row of monthlyPackageStats) {
            const currentPackages = Number(row.package_count || 0);
            // For the first month in the series, increase is 0 or relative to a non-existent previous month.
            // If packageVolumeMonthly is empty, it's the first data point.
            const increase = packageVolumeMonthly.length > 0 || monthlyPackageStats.indexOf(row) > 0 ? currentPackages - lastMonthPackages : 0;
            packageVolumeMonthly.push({
                name: row.month_name,
                packages: currentPackages,
                increase: increase,
            });
            lastMonthPackages = currentPackages;
        }
    }
    
    const latestMonthData = packageVolumeMonthly.length > 0 ? packageVolumeMonthly[packageVolumeMonthly.length - 1] : { name: '', packages: 0, increase: 0};

    const stats: MailroomStats = {
      totalPackagesCount: latestMonthData.packages,
      totalPackagesIncrease: latestMonthData.increase,
      currentResidentsCount: residentsCount || 0,
      awaitingPickupCount: awaitingPickupCount || 0,
      awaitingPickupTodayCount: awaitingTodayCount || 0,
      packageVolumeMonthly: packageVolumeMonthly,
    };

    // Cache for 5 minutes on Vercel's CDN, allow serving stale while revalidating
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).json(stats);
  } catch (error) {
    console.error('Error in get-packages-mailroom handler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 