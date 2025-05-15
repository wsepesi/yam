// // pages/api/invitations/create.ts
// // import { createClient } from '@supabase/supabase-js';

import { NextApiRequest, NextApiResponse } from 'next';

import { createAdminClient } from '@/lib/supabase';
import getUserId from '@/lib/handleSession';

// Number of days until invitation expires
const INVITATION_EXPIRY_DAYS = 7;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabaseAdmin = createAdminClient()
    const authHeader = req.headers.authorization;
    const userId = await getUserId(supabaseAdmin, authHeader)

    // Get required parameters from request body
    const { email, role = 'user', organizationId, mailroomId } = req.body;

    if (!email || !organizationId || !mailroomId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Fetch current user's profile to check permissions
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, organization_id')
      .eq('id', userId)
      .single();

    if (profileError || !userProfile) {
      return res.status(400).json({ error: 'Could not fetch user profile' });
    }

    // Verify user has manager or admin role
    if (userProfile.role !== 'manager' && userProfile.role !== 'admin') {
      return res.status(403).json({ error: 'Only managers and admins can send invitations' });
    }

    // Verify organization matches (unless admin)
    if (userProfile.role !== 'admin' && userProfile.organization_id !== organizationId) {
      return res.status(403).json({ error: 'You can only invite users to your organization' });
    }

    console.log('mailroomId', mailroomId)
    console.log('organizationId', organizationId)
    // Verify mailroom exists and belongs to specified organization
    const { data: mailroom, error: mailroomError } = await supabaseAdmin
      .from('mailrooms')
      .select('id')
      .eq('id', mailroomId)
      .eq('organization_id', organizationId)
      .single();

    if (mailroomError || !mailroom) {
      return res.status(400).json({ error: 'Invalid mailroom' });
    }

    // Set expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

    // Create the invitation record
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from('invitations')
      .insert({
        email,
        role,
        organization_id: organizationId,
        mailroom_id: mailroomId,
        invited_by: userId,
        expires_at: expiresAt.toISOString(),
        used: false,
        status: 'PENDING'
      })
      .select()
      .single();

    if (invitationError) {
      console.error('Error creating invitation:', invitationError);
      return res.status(500).json({ error: 'Failed to create invitation' });
    }

    // Generate the invitation URL
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const invitationUrl = `${baseUrl}` //`{baseUrl}/register`;

    // Send the invitation email using Supabase's email functions
    // Note: admin.inviteUserByEmail might require admin rights 
    // and might not work with the regular client
    const { error: emailError } = await supabaseAdmin.auth.admin?.inviteUserByEmail(email, {
      redirectTo: invitationUrl,
      data: {
        invitation_id: invitation.id,
      }
    });

    if (emailError) {
      console.error('Error sending invitation email:', emailError);
      return res.status(500).json({ error: 'Failed to send invitation email' });
    } 

    // Return success with the invitation data
    return res.status(200).json({
      message: 'Invitation sent successfully',
      invitation: {
        id: invitation.id,
        email,
        expires_at: invitation.expires_at,
      }
    });
  } catch (error) {
    console.error('Error processing invitation:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}