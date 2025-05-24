import { NextApiRequest, NextApiResponse } from 'next';

import { createAdminClient } from '@/lib/supabase';
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

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or missing user session.' });
    }

    // Get manager ID from URL and role from request body
    const { id } = req.query;
    const { role, status } = req.body;

    if (!id || !role) {
      return res.status(400).json({ error: 'Missing required parameters (id, role)' });
    }

    // Verify that only proper roles are assigned (super-admin cannot be assigned via this endpoint)
    if (role !== 'user' && role !== 'manager' && role !== 'admin') {
      return res.status(400).json({ error: 'Invalid target role value. Can only assign user, manager, or admin.' });
    }

    // Verify status if provided
    if (status && status !== 'INVITED' && status !== 'ACTIVE' && status !== 'REMOVED') {
      return res.status(400).json({ error: 'Invalid status value' });
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

    // Authorization: Who can update roles?
    if (userProfile.role !== 'super-admin' && userProfile.role !== 'admin' && userProfile.role !== 'manager') {
      return res.status(403).json({ error: 'Only super-admins, admins, and managers can update roles' });
    }

    // Fetch the target manager's profile
    const { data: managerProfile, error: managerError } = await supabaseAdmin
      .from('profiles')
      .select('role, organization_id, mailroom_id')
      .eq('id', id)
      .single();

    if (managerError || !managerProfile) {
      return res.status(404).json({ error: 'Manager not found' });
    }

    // Organizational and Promotion Constraints:
    if (userProfile.role === 'manager') {
      // Managers can only update users in their own organization
      if (userProfile.organization_id !== managerProfile.organization_id) {
        return res.status(403).json({ error: 'Managers can only update users in their own organization' });
      }
      // Managers cannot promote to admin or change an admin's role
      if (role === 'admin' || managerProfile.role === 'admin' || managerProfile.role === 'super-admin') {
        return res.status(403).json({ error: 'Managers cannot promote to admin or modify an admin\'s role' });
      }
    } else if (userProfile.role === 'admin' || userProfile.role === 'super-admin') {
      // Admins cannot modify a super-admin's role or promote someone to super-admin (though super-admin is not an assignable role here)
      if (managerProfile.role === 'super-admin') { // Target is super-admin
        return res.status(403).json({ error: 'Admins cannot modify a super-admin\'s role.' });
      }
      // Admins cannot assign/change role of users outside of an organization if the target user is not in an org (edge case, profiles usually have orgs)
      // This is mostly covered by admins operating on managerProfile which should have an org.
    }
    // Super-admins have no organizational or promotion restrictions through this endpoint for assignable roles.

    // Prevent non-super-admins and non-admins from promoting to admin
    // This is somewhat redundant due to the manager block above, but good as a direct check.
    if (role === 'admin' && userProfile.role !== 'admin' && userProfile.role !== 'super-admin') {
        return res.status(403).json({ error: 'Only admins or super-admins can promote to admin' });
    }

    // Prepare data for update
    const updateData: { role: string; status?: string } = { role };
    if (status) {
      updateData.status = status;
    }

    // Update the manager's role and/or status
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('Error updating manager profile:', updateError);
      return res.status(500).json({ error: 'Failed to update manager profile' });
    }

    // If status is REMOVED, delete the user from the auth table
    if (status === 'REMOVED') {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(id as string);
      if (deleteError) {
        console.error('Error deleting user from auth table:', deleteError);
        return res.status(500).json({ error: 'Failed to delete user from auth table' });
      }
    }

    return res.status(200).json({ message: 'Manager profile updated successfully' });
  } catch (error) {
    console.error('Error processing request:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 