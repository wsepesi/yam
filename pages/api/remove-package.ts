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

  const { packageId, orgSlug, mailroomSlug } = req.body;

  if (!packageId || !orgSlug || !mailroomSlug) {
    return res.status(400).json({ error: 'packageId, orgSlug, and mailroomSlug are required in the request body.' });
  }

  try {
    const supabaseAdmin = createAdminClient();
    const authHeader = req.headers.authorization;
    const userId = await getUserId(supabaseAdmin, authHeader);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized or unable to determine staff ID for logging.' });
    }

    const { data: mailroomData, error: mailroomError } = await supabaseAdmin
      .from('mailrooms')
      .select('id, organization_id')
      .eq('slug', mailroomSlug)
      .single();

    if (mailroomError || !mailroomData) {
      console.error(`Error fetching mailroom by slug ${mailroomSlug}:`, mailroomError);
      return res.status(404).json({ error: 'Mailroom not found.' });
    }

    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .eq('id', mailroomData.organization_id)
      .single();

    if (orgError || !orgData) {
      console.error(`Error fetching organization by slug ${orgSlug} or mailroom mismatch:`, orgError);
      return res.status(404).json({ error: 'Organization not found or mailroom does not belong to it.' });
    }
    
    const mailroomId = mailroomData.id;
    
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