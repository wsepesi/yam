import { NextApiRequest, NextApiResponse } from 'next';
import { createAdminClient, supabase } from '@/lib/supabase';

import getUserId from '@/lib/handleSession';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow PUT requests for updating
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabaseAdmin = createAdminClient()
    const authHeader = req.headers.authorization;
    const userId = await getUserId(supabaseAdmin, authHeader)

    // Get manager ID from URL and role from request body
    const { id } = req.query;
    const { role, status } = req.body;

    if (!id || !role) {
      return res.status(400).json({ error: 'Missing required parameters (id, role)' });
    }

    // Verify that only proper roles are assigned
    if (role !== 'user' && role !== 'manager' && role !== 'admin') {
      return res.status(400).json({ error: 'Invalid role value' });
    }

    // Verify status if provided
    if (status && status !== 'INVITED' && status !== 'ACTIVE' && status !== 'REMOVED') {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    // Fetch current user's profile to check permissions
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role, organization_id, mailroom_id')
      .eq('id', userId)
      .single();

    if (profileError || !userProfile) {
      return res.status(400).json({ error: 'Could not fetch user profile' });
    }

    // Only admins and managers can update roles
    if (userProfile.role !== 'manager' && userProfile.role !== 'admin') {
      return res.status(403).json({ error: 'Only managers and admins can update roles' });
    }

    // Fetch the target manager's profile
    const { data: managerProfile, error: managerError } = await supabase
      .from('profiles')
      .select('role, organization_id, mailroom_id')
      .eq('id', id)
      .single();

    if (managerError || !managerProfile) {
      return res.status(404).json({ error: 'Manager not found' });
    }

    // Verify the manager belongs to the same organization as the user
    if (userProfile.role !== 'admin' && userProfile.organization_id !== managerProfile.organization_id) {
      return res.status(403).json({ error: 'You can only update managers in your organization' });
    }

    // Prevent non-admins from promoting to admin (only demoting is allowed)
    if (userProfile.role !== 'admin' && role === 'admin') {
      return res.status(403).json({ error: 'Only admins can promote to admin' });
    }

    // Prepare data for update
    const updateData: { role: string; status?: string } = { role };
    if (status) {
      updateData.status = status;
    }

    // Update the manager's role and/or status
    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('Error updating manager profile:', updateError);
      return res.status(500).json({ error: 'Failed to update manager profile' });
    }

    return res.status(200).json({ message: 'Manager profile updated successfully' });
  } catch (error) {
    console.error('Error processing request:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 