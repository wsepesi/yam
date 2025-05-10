import { NextApiRequest, NextApiResponse } from 'next';

import { createAdminClient } from '@/lib/supabase';
import getUserId from '@/lib/handleSession';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Create a Supabase admin client
  const supabaseAdmin = createAdminClient();

  try {
    // Extract the authorization token from request headers
    const authHeader = req.headers.authorization;
    const userId = await getUserId(supabaseAdmin, authHeader);

    // Get mailroom ID from query parameters
    const { mailroomId } = req.query;

    if (!mailroomId || typeof mailroomId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid mailroom ID' });
    }

    // Fetch current user's profile to check permissions
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, organization_id, mailroom_id')
      .eq('id', userId)
      .single();

    if (profileError || !userProfile) {
      return res.status(400).json({ error: 'Could not fetch user profile' });
    }

    // Get the actual mailroom to verify it exists and user has access
    const { data: mailroom, error: mailroomError } = await supabaseAdmin
      .from('mailrooms')
      .select('id, organization_id')
      .eq('id', mailroomId)
      .single();

    if (mailroomError || !mailroom) {
      return res.status(404).json({ error: 'Mailroom not found' });
    }

    // Verify user has access to this mailroom (same org or admin)
    if (userProfile.role !== 'admin' && userProfile.organization_id !== mailroom.organization_id) {
      return res.status(403).json({ error: 'You do not have access to this mailroom' });
    }

    // Fetch all users (profiles) for the specified mailroom
    const { data: users, error: usersError } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        role,
        created_at,
        email,
        status
      `)
      .eq('mailroom_id', mailroomId);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    // Also fetch pending invitations for this mailroom
    const { data: invitations, error: invitationsError } = await supabaseAdmin
      .from('invitations')
      .select('id, email, role, created_at, expires_at, status')
      .eq('mailroom_id', mailroomId)
      .eq('status', 'PENDING');

    if (invitationsError) {
      console.error('Error fetching invitations:', invitationsError);
      return res.status(500).json({ error: 'Failed to fetch invitations' });
    }

    // Return both users and pending invitations
    return res.status(200).json({
      users: users || [],
      invitations: invitations || []
    });
  } catch (error) {
    console.error('Error fetching mailroom users:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}