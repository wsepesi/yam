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
}

interface MailroomBreakdownData {
  mailroomID: string;
  mailroomName: string;
  totalPackages: number;
  totalResidents: number;
  packagesAwaitingPickup: number;
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

interface DistinctRecipientID {
    resident_id: string;
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

    const { orgId: orgSlug } = req.query; // Rename to orgSlug for clarity
    if (!orgSlug || typeof orgSlug !== 'string') {
      return res.status(400).json({ error: 'Organization slug (orgId) is required in query parameters' });
    }

    // Fetch Organization ID and Name using the slug
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name') // Select id and name
      .eq('slug', orgSlug) // Query by slug
      .single();

    if (orgError) throw new Error(`Failed to fetch organization details: ${orgError.message}`);
    if (!orgData) throw new Error('Organization not found for the provided slug.');
    const organizationUUID = orgData.id; // This is the actual UUID
    const orgName = orgData.name;

    // Authorization: Check if the user is part of the organization using the fetched organizationUUID
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
      .select('id, name')
      .eq('organization_id', organizationUUID); // Use organizationUUID

    if (mailroomsError) throw new Error(`Failed to fetch mailrooms: ${mailroomsError.message}`);
    if (!mailroomsData) throw new Error('No mailrooms found for this organization.');

    const totalMailrooms = mailroomsData.length;
    const mailroomBreakdown: MailroomBreakdownData[] = [];
    let overallTotalPackages = 0;
    let overallTotalResidents = 0;

    for (const mr of mailroomsData) {
      const { count: totalPackages, error: pkgError } = await supabaseAdmin
        .from('packages')
        .select('id', { count: 'exact', head: true })
        .eq('mailroom_id', mr.id);
      if (pkgError) console.warn(`Error fetching package count for mailroom ${mr.id}: ${pkgError.message}`);
      
      // Fetch distinct recipient_ids and count them
      const { data: distinctRecipients, error: distinctRecipientsError } = await supabaseAdmin
        .from('packages')
        .select('resident_id', { count: 'planned', head:false }) // Changed to planned to avoid actual distinct on DB if large
        .eq('mailroom_id', mr.id)
        .neq('resident_id', null); // Ensure recipient_id is not null

      let totalResidents = 0;
      if (distinctRecipientsError) {
        console.warn(`Error fetching distinct recipients for mailroom ${mr.id}: ${distinctRecipientsError.message}. Falling back to 0.`);
      } else if (distinctRecipients) {
        // Count unique resident_ids from the fetched data
        const uniqueIds = new Set(distinctRecipients.map((p: DistinctRecipientID) => p.resident_id));
        totalResidents = uniqueIds.size;
      }
      
      const { count: awaitingPickup, error: awaitError } = await supabaseAdmin
        .from('packages')
        .select('id', { count: 'exact', head: true })
        .eq('mailroom_id', mr.id)
        .eq('status', 'WAITING');
      if (awaitError) console.warn(`Error fetching awaiting pickup count for mailroom ${mr.id}: ${awaitError.message}`);

      mailroomBreakdown.push({
        mailroomID: mr.id,
        mailroomName: mr.name,
        totalPackages: totalPackages || 0,
        totalResidents: totalResidents || 0,
        packagesAwaitingPickup: awaitingPickup || 0,
      });
      overallTotalPackages += (totalPackages || 0);
      overallTotalResidents += (totalResidents || 0);
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