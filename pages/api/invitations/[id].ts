import { NextApiRequest, NextApiResponse } from 'next';

import { createAdminClient } from '@/lib/supabase';
import getUserId from '@/lib/handleSession';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow DELETE requests
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabaseAdmin = createAdminClient();
    const authHeader = req.headers.authorization;
    const userId = await getUserId(supabaseAdmin, authHeader)

    // Get invitation ID from URL
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'Missing invitation ID' });
    }

    // Fetch current user's profile to check permissions
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, organization_id')
      .eq('id', userId)
      .single();

    console.log('before', userProfile, userId, profileError)

    if (profileError || !userProfile) {
      return res.status(400).json({ error: 'Could not fetch user profile' });
    }

    // Verify user has manager, admin or super-admin role
    if (userProfile.role !== 'super-admin' && userProfile.role !== 'admin' && userProfile.role !== 'manager') {
      return res.status(403).json({ error: 'Only super-admins, admins, and managers can delete invitations' });
    }

    // Fetch the invitation to verify ownership
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from('invitations')
      .select('invited_by, organization_id')
      .eq('id', id)
      .single();

    if (invitationError || !invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Verify user belongs to the same organization as the invitation (unless super-admin or admin)
    if (userProfile.role !== 'super-admin' && userProfile.role !== 'admin' && userProfile.organization_id !== invitation.organization_id) {
      return res.status(403).json({ error: 'Managers can only delete invitations in their organization' });
    }

    // If user is not an admin or super-admin, verify they created the invitation
    if (userProfile.role !== 'super-admin' && userProfile.role !== 'admin' && invitation.invited_by !== userId) {
      return res.status(403).json({ error: 'Managers can only delete invitations they created' });
    }

    // Delete the invitation
    const { error: deleteError } = await supabaseAdmin
      .from('invitations')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting invitation:', deleteError);
      return res.status(500).json({ error: 'Failed to delete invitation' });
    }

    return res.status(200).json({ message: 'Invitation deleted successfully' });
  } catch (error) {
    console.error('Error processing request:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 