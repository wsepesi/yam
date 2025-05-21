import { NextApiRequest, NextApiResponse } from 'next';

import { createAdminClient } from '@/lib/supabase';

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

  const { orgSlug, mailroomSlug } = req.query;

  if (!orgSlug || !mailroomSlug || typeof orgSlug !== 'string' || typeof mailroomSlug !== 'string') {
    return res.status(400).json({ error: 'orgSlug and mailroomSlug are required query parameters.' });
  }

  try {
    const supabaseAdmin = createAdminClient();
    // const authHeader = req.headers.authorization; // Authorization might still be needed for access control
    // const userId = await getUserId(supabaseAdmin, authHeader);

    // if (!userId) {
    //   return res.status(401).json({ error: 'Unauthorized' });
    // }

    // Fetch mailroom_id based on orgSlug and mailroomSlug
    const { data: mailroomData, error: mailroomError } = await supabaseAdmin
      .from('mailrooms')
      .select('id, organization_id')
      .eq('slug', mailroomSlug)
      .single();

    if (mailroomError || !mailroomData) {
      console.error(`Error fetching mailroom by slug ${mailroomSlug}:`, mailroomError);
      return res.status(404).json({ error: 'Mailroom not found or not unique.' });
    }

    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .eq('id', mailroomData.organization_id) // Ensure mailroom belongs to the org
      .single();

    if (orgError || !orgData) {
      console.error(`Error fetching organization by slug ${orgSlug} or mailroom mismatch:`, orgError);
      return res.status(404).json({ error: 'Organization not found or mailroom does not belong to it.' });
    }
    
    const mailroomId = mailroomData.id;

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