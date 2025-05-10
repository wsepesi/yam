import { NextApiRequest, NextApiResponse } from 'next';

import { createAdminClient } from '@/lib/supabase';
import getUserId from '@/lib/handleSession';

// import { Package } from '@/lib/types';

// In a real application, this would be a database operation
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<boolean | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const packageId = req.body as string;
    
    if (!packageId) {
      return res.status(400).json({ error: 'Package ID is required' });
    }

    const supabaseAdmin = createAdminClient()
    const authHeader = req.headers.authorization;
    const userId = await getUserId(supabaseAdmin, authHeader)
    
    // Get the mailroom ID for the user
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('mailroom_id')
      .eq('id', userId)
      .single();
    
    if (profileError || !profileData?.mailroom_id) {
      return res.status(400).json({ error: 'User not associated with a mailroom' });
    }
    
    const mailroomId = profileData.mailroom_id;
    
    // Get the package details first to make sure it exists in this mailroom
    const { data: packageData, error: packageError } = await supabaseAdmin
      .from('packages')
      .select('id, package_id, mailroom_id, status')
      .eq('package_id', parseInt(packageId))
      .eq('mailroom_id', mailroomId)
      .eq('status', 'WAITING')
      .single();
    
    if (packageError || !packageData) {
      return res.status(404).json({ error: `Package not found or already retrieved: ${packageError?.message}` });
    }
    
    // Update the package status to RETRIEVED and record who processed the pickup
    const { error: updateError } = await supabaseAdmin
      .from('packages')
      .update({ 
        status: 'RETRIEVED',
        pickup_staff_id: userId,
        // The retrieved_timestamp will be set automatically by the trigger
      })
      .eq('id', packageData.id);
    
    if (updateError) {
      return res.status(500).json({ error: `Failed to update package status: ${updateError.message}` });
    }
    
    // Release the package ID back to the queue
    const { data: release, error: releaseError } = await supabaseAdmin.rpc(
      'release_package_number',
      { 
        p_mailroom_id: mailroomId,
        p_package_number: packageData.package_id
      }
    );
    
    if (releaseError || !release) {
      return res.status(500).json({ error: `Failed to release package number: ${releaseError?.message}` });
    }
    
    return res.status(200).json(true);
  } catch (error) {
    console.error('Error removing package:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to remove package';
    return res.status(500).json({ error: errorMessage });
  }
} 