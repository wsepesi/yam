import { NextApiRequest, NextApiResponse } from 'next';

import { Package } from '@/lib/types';
import { createAdminClient } from '@/lib/supabase';
import getUserId from '@/lib/handleSession';

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
    const packageData = req.body as Package;
    
    if (!packageData || !packageData.packageId) {
      return res.status(400).json({ error: 'Package data is required' });
    }

    const supabaseAdmin = createAdminClient()
    const authHeader = req.headers.authorization;
    const userId = await getUserId(supabaseAdmin, authHeader)
    // Get the mailroom ID for the user
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('mailroom_id, organization_id')
      .eq('id', userId)
      .single();
    
    if (profileError || !profileData?.mailroom_id) {
      return res.status(400).json({ error: 'User not associated with a mailroom' });
    }
    
    const mailroomId = profileData.mailroom_id;
    
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