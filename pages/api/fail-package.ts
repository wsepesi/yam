import { NextApiRequest, NextApiResponse } from 'next';

import { Package } from '@/lib/types';
import { createAdminClient } from '@/lib/supabase';
import getUserId from '@/lib/handleSession';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean } | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const failedPackage = req.body as Package;
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
    
    // Log the failed package to a special table for staff follow-up
    const { error: logError } = await supabaseAdmin
      .from('failed_package_logs')
      .insert({
        mailroom_id: profileData.mailroom_id,
        staff_id: userId,
        first_name: failedPackage.First,
        last_name: failedPackage.Last,
        email: failedPackage.Email,
        resident_id: failedPackage.residentId,
        provider: failedPackage.provider,
        error_details: req.body.error || 'Unknown error during package registration',
        resolved: false
      });
    
    if (logError) {
      console.error('Error logging failed package:', logError);
      return res.status(500).json({ error: 'Failed to log package error' });
    }
    
    // Notify admin about the failed package if enabled
    try {
      // Implementation for admin notification would go here
      // This could be a separate email or notification system
    } catch (notifyError) {
      console.error('Failed to notify admin:', notifyError);
      // Continue anyway since we've already logged the failure
    }
    
    return res.status(200).json({ success: true });
    
  } catch (error) {
    console.error('Error handling failed package:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process package failure';
    return res.status(500).json({ error: errorMessage });
  }
} 