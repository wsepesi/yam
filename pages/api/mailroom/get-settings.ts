import { NextApiRequest, NextApiResponse } from 'next';

import { createAdminClient } from '@/lib/supabase';
import getUserId from '@/lib/handleSession';

interface MailroomSettingsResponse {
  pickup_option?: 'resident_id' | 'resident_name';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('API route /api/mailroom/get-settings called with query:', req.query);

  // Create a Supabase admin client
  const supabaseAdmin = createAdminClient();

  try {
    const authHeader = req.headers.authorization;
    const userId = await getUserId(supabaseAdmin, authHeader);
    
    const { mailroomId } = req.query;

    console.log('Processing request with mailroomId:', mailroomId);
    
    if (!mailroomId || typeof mailroomId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid mailroom ID' });
    }

    // Fetch current user's profile to check permissions
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, organization_id, mailroom_id')
      .eq('id', userId)
      .single();

    console.log('User profile check:', { 
      hasProfile: !!userProfile, 
      role: userProfile?.role,
      organizationId: userProfile?.organization_id,
      mailroomId: userProfile?.mailroom_id,
      error: profileError?.message
    });
    
    if (profileError || !userProfile) {
      console.log('Authentication failed: Could not fetch user profile', profileError);
      return res.status(400).json({ error: 'Could not fetch user profile' });
    }

    // Get the mailroom to verify organization ownership and permissions
    const { data: mailroom, error: mailroomError } = await supabaseAdmin
      .from('mailrooms')
      .select('id, organization_id, pickup_option')
      .eq('id', mailroomId)
      .single();

    console.log('Mailroom lookup:', { 
      found: !!mailroom, 
      mailroomId: mailroom?.id,
      organizationId: mailroom?.organization_id,
      pickupOption: mailroom?.pickup_option,
      error: mailroomError?.message
    });
    
    if (mailroomError || !mailroom) {
      console.log('Mailroom not found for ID:', mailroomId, mailroomError);
      return res.status(404).json({ error: 'Mailroom not found' });
    }

    // Verify user has access to this mailroom
    if (userProfile.role !== 'super-admin' && 
        userProfile.role !== 'admin' && 
        userProfile.organization_id !== mailroom.organization_id &&
        userProfile.mailroom_id !== mailroom.id) {
      console.log('Access denied: User does not have access to this mailroom');
      return res.status(403).json({ error: 'You do not have access to this mailroom' });
    }

    // Return the settings
    const response: MailroomSettingsResponse = {
      pickup_option: mailroom.pickup_option || 'resident_id'
    };

    console.log('Access granted: Returning mailroom settings');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600');
    return res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching mailroom settings:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 