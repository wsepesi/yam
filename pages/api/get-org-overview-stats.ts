import type { NextApiRequest, NextApiResponse } from 'next';

// import { supabase } from '@/lib/supabaseClient'; // We will use createAdminClient
import { createAdminClient } from '@/lib/supabase'; // Assuming this is your admin client setup
import getUserId from '@/lib/handleSession'; // Assuming this is your session handler

// Updated interfaces (should match OrgOverview.tsx - consider shared types)
interface MonthlyChartDataPoint {
  name: string; // Month name, e.g., "Jan"
  total: number; // Total packages for the org for this month
  [mailroomIdOrName: string]: number | string; // Package count for each mailroom OR the month name
}

interface MailroomCoreData {
    id: string;
    name: string;
    slug: string;
    status: string; // Added status
}

interface MailroomBreakdownData {
  mailroomID: string;
  mailroomName: string;
  mailroomSlug: string;
  totalPackages: number;
  totalResidents: number;
  packagesAwaitingPickup: number;
  mailroomStatus: string; // Added mailroomStatus
  totalUsersInMailroom: number; // Added totalUsersInMailroom
}

export interface OrgOverviewStats { 
  orgName: string;
  totalMailrooms: number;
  overallTotalPackages: number;
  overallTotalResidents: number;
  monthlyChartData: MonthlyChartDataPoint[]; // Changed from overallPackageVolumeMonthly
  mailroomBreakdown: MailroomBreakdownData[];
}

interface PackageTimestamp {
    mailroom_id: string;
    created_at: string;
}

const getMonthYearStrings = (numMonths: number): { name: string, isoMonth: string }[] => {
  const months: { name: string, isoMonth: string }[] = [];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentDate = new Date(); // Use a new variable that is modified
  for (let i = 0; i < numMonths; i++) {
    const monthIndex = currentDate.getMonth();
    const year = currentDate.getFullYear();
    months.unshift({ 
        name: `${monthNames[monthIndex]} ${year % 100}`,
        isoMonth: `${year}-${(monthIndex + 1).toString().padStart(2, '0')}`
    });
    currentDate.setMonth(currentDate.getMonth() - 1);
  }
  return months;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<OrgOverviewStats | { error: string }>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const supabaseAdmin = createAdminClient();

    const authHeader = req.headers.authorization;
    const userId = await getUserId(supabaseAdmin, authHeader);

    if (!userId) { // getUserId might return null or throw, handle null case
        return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const { orgSlug } = req.query;

    if (!orgSlug || typeof orgSlug !== 'string') {
      return res.status(400).json({ error: 'Organization slug is required and must be a string in query parameters' });
    }

    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name') // Select id and name
      .eq('slug', orgSlug as string) // Query by slug
      .single();

    if (orgError) throw new Error(`Failed to fetch organization details: ${orgError.message}`);
    if (!orgData) throw new Error(`Organization not found for the provided slug: ${orgSlug}`);
    const organizationUUID = orgData.id; // This is the actual UUID
    const orgName = orgData.name;

    const { count: orgUserCount, error: orgUserError } = await supabaseAdmin
      .from('organization_users')
      .select('', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('organization_id', organizationUUID); // Use organizationUUID

    if (orgUserError) {
      console.error('Error checking organization membership:', orgUserError);
      return res.status(500).json({ error: 'Error checking organization membership' });
    }
    if (orgUserCount === 0) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this organization.' });
    }
    
    const { data: mailroomsData, error: mailroomsError } = await supabaseAdmin
      .from('mailrooms')
      .select('id, name, slug, status') // Added status
      .eq('organization_id', organizationUUID); // Use organizationUUID

    if (mailroomsError) throw new Error(`Failed to fetch mailrooms: ${mailroomsError.message}`);
    if (!mailroomsData) throw new Error('No mailrooms found for this organization.');

    const totalMailrooms = mailroomsData.length;
    const mailroomBreakdown: MailroomBreakdownData[] = [];
    let overallTotalPackages = 0;
    let overallTotalResidents = 0;

    const mailroomIDs = mailroomsData.map(mr => mr.id);

    const { data: allPackages, error: allPackagesError } = await supabaseAdmin
      .from('packages')
      .select('id, mailroom_id, resident_id, status')
      .in('mailroom_id', mailroomIDs);

    if (allPackagesError) throw new Error(`Failed to fetch packages for mailrooms: ${allPackagesError.message}`);

    const { data: allProfiles, error: allProfilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, mailroom_id')
      .eq('organization_id', organizationUUID)
      .in('mailroom_id', mailroomIDs);
    
    if (allProfilesError) throw new Error(`Failed to fetch profiles for mailrooms: ${allProfilesError.message}`);

    for (const mr of mailroomsData as MailroomCoreData[]) {
      const packagesForMailroom = allPackages?.filter(p => p.mailroom_id === mr.id) || [];
      const profilesForMailroom = allProfiles?.filter(p => p.mailroom_id === mr.id) || [];

      const totalPackages = packagesForMailroom.length;
      
      const uniqueResidentIds = new Set(packagesForMailroom.map(p => p.resident_id));
      const totalResidents = uniqueResidentIds.size;

      const packagesAwaitingPickup = packagesForMailroom.filter(p => p.status === 'WAITING').length;
      
      const totalUsersInMailroom = profilesForMailroom.length;

      mailroomBreakdown.push({
        mailroomID: mr.id,
        mailroomName: mr.name,
        mailroomSlug: mr.slug,
        totalPackages: totalPackages,
        totalResidents: totalResidents,
        packagesAwaitingPickup: packagesAwaitingPickup,
        mailroomStatus: mr.status || 'N/A',
        totalUsersInMailroom: totalUsersInMailroom,
      });
      overallTotalPackages += totalPackages;
      overallTotalResidents += totalResidents;
    }

    const numMonthsForChart = 6;
    const monthYearStrings = getMonthYearStrings(numMonthsForChart);
    const monthlyChartData: MonthlyChartDataPoint[] = monthYearStrings.map(m => ({
      name: m.name,
      total: 0,
      ...mailroomsData.reduce((acc: { [key: string]: number }, currentMailroom: MailroomCoreData) => {
        acc[currentMailroom.id] = 0;
        return acc;
      }, {})
    }));

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - numMonthsForChart + 1);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0,0,0,0);

    const { data: monthlyPackagesRaw, error: monthlyPackagesError } = await supabaseAdmin
      .from('packages')
      .select('mailroom_id, created_at')
      .in('mailroom_id', mailroomsData.map((currentMailroom: MailroomCoreData) => currentMailroom.id))
      .gte('created_at', sixMonthsAgo.toISOString());

    if (monthlyPackagesError) throw new Error(`Failed to fetch monthly package data: ${monthlyPackagesError.message}`);

    if (monthlyPackagesRaw) {
      for (const pkg of monthlyPackagesRaw as PackageTimestamp[]) { 
        const pkgDate = new Date(pkg.created_at);
        const pkgMonthISO = `${pkgDate.getFullYear()}-${(pkgDate.getMonth() + 1).toString().padStart(2, '0')}`;
        
        const chartPoint = monthlyChartData.find(cd => monthYearStrings.find(mys => mys.isoMonth === pkgMonthISO && mys.name === cd.name));
        if (chartPoint && pkg.mailroom_id) {
          (chartPoint[pkg.mailroom_id] as number) = ((chartPoint[pkg.mailroom_id] as number) || 0) + 1;
          chartPoint.total = (chartPoint.total || 0) + 1;
        }
      }
    }
    
    const responsePayload: OrgOverviewStats = {
      orgName,
      totalMailrooms,
      overallTotalPackages,
      overallTotalResidents,
      monthlyChartData,
      mailroomBreakdown,
    };

    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    // Since Authorization is used to determine access to the organization,
    // and the data itself is org-specific but not user-specific within that org,
    // we vary by Authorization. If different users within the same org see different stats,
    // this approach needs re-evaluation or the endpoint might not be suitable for shared caching.
    res.setHeader('Vary', 'Authorization');

    return res.status(200).json(responsePayload);

  } catch (e: unknown) { 
    let errorMessage = 'Internal Server Error';
    if (e instanceof Error) {
        errorMessage = e.message;
    }
    console.error('Error in get-org-overview-stats handler:', e);
    return res.status(500).json({ error: errorMessage });
  }
} 