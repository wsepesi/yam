import { NextApiRequest, NextApiResponse } from 'next';

import { Package } from '@/lib/types';
import { createAdminClient } from '@/lib/supabase';

// import getUserId from '@/lib/handleSession'; // Removed as it's unused now

export interface LogPackage extends Package {
  pickedUpAt: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LogPackage | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orgSlug, mailroomSlug, ...packageData } = req.body as Package & { orgSlug: string, mailroomSlug: string };
    
    if (!packageData || !packageData.packageId || !orgSlug || !mailroomSlug) {
      return res.status(400).json({ error: 'Package data, orgSlug, and mailroomSlug are required' });
    }

    const supabaseAdmin = createAdminClient();
    // const authHeader = req.headers.authorization; // User ID might be needed if logging who performed the action
    // const userId = await getUserId(supabaseAdmin, authHeader);

    // Fetch mailroom_id based on orgSlug and mailroomSlug
    const { data: mailroomRecord, error: mailroomError } = await supabaseAdmin
      .from('mailrooms')
      .select('id, organization_id')
      .eq('slug', mailroomSlug)
      .single();

    if (mailroomError || !mailroomRecord) {
      console.error(`Error fetching mailroom by slug ${mailroomSlug}:`, mailroomError);
      return res.status(404).json({ error: 'Mailroom not found for logging.' });
    }

    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .eq('id', mailroomRecord.organization_id)
      .single();

    if (orgError || !orgData) {
      console.error(`Error fetching organization by slug ${orgSlug} or mailroom mismatch for logging:`, orgError);
      return res.status(404).json({ error: 'Organization not found or mailroom does not belong to it for logging.' });
    }
    
    const mailroomId = mailroomRecord.id;
    
    // Find the package in the database to get its retrieved timestamp
    const { data: packageRecord, error: packageError } = await supabaseAdmin
      .from('packages')
      .select('id, retrieved_timestamp')
      .eq('package_id', parseInt(packageData.packageId))
      .eq('mailroom_id', mailroomId)
      .eq('status', 'RETRIEVED')
      .single();
    
    if (packageError || !packageRecord) {
      return res.status(404).json({ error: 'Package not found or not marked as retrieved' });
    }
    
    // Convert the package data to the LogPackage format
    const pickedUpAt = packageRecord.retrieved_timestamp || new Date().toISOString();
    
    const loggedPackage: LogPackage = {
      ...packageData,
      pickedUpAt
    };
    
    // In a real world scenario, you might also want to:
    // 1. Log this event to an audit trail
    // 2. Send notifications 
    // 3. Create analytics for package pickups
    
    return res.status(200).json(loggedPackage);
  } catch (error) {
    console.error('Error logging package:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to log package';
    return res.status(500).json({ error: errorMessage });
  }
} 