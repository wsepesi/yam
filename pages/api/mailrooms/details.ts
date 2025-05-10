import { NextApiRequest, NextApiResponse } from 'next';

import { createAdminClient } from '@/lib/supabase';
import getUserId from '@/lib/handleSession';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('API route /api/mailrooms/details called with query:', req.query);

  // Create a Supabase admin client
  const supabaseAdmin = createAdminClient();

  try {
    const authHeader = req.headers.authorization;
    const userId = await getUserId(supabaseAdmin, authHeader)
    
    const { orgSlug, mailroomSlug } = req.query;

    console.log('Processing request with slugs:', { orgSlug, mailroomSlug });
    
    if (!orgSlug || !mailroomSlug || typeof orgSlug !== 'string' || typeof mailroomSlug !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid organization or mailroom slug' });
    }

    // Fetch current user's profile to check permissions
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, organization_id')
      .eq('id', userId)
      .single();

    console.log('User profile check:', { 
      hasProfile: !!userProfile, 
      role: userProfile?.role,
      organizationId: userProfile?.organization_id,
      error: profileError?.message
    });
    
    if (profileError || !userProfile) {
      console.log('Authentication failed: Could not fetch user profile', profileError);
      return res.status(400).json({ error: 'Could not fetch user profile' });
    }

    // First, get the organization ID from its slug
    // Note: This assumes you have a slug field in your organizations table
    // If not, you'd need to add that or use another identifier
    const { data: organization, error: organizationError } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .single();

    console.log('Organization lookup:', { 
      found: !!organization, 
      orgId: organization?.id,
      error: organizationError?.message
    });
    
    if (organizationError || !organization) {
      console.log('Organization not found for slug:', orgSlug, organizationError);
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Now get the mailroom ID from its slug
    // Again, assuming there's a slug field in mailrooms table
    const { data: mailroom, error: mailroomError } = await supabaseAdmin
      .from('mailrooms')
      .select('id, organization_id')
      .eq('slug', mailroomSlug)
      .eq('organization_id', organization.id)
      .single();

    console.log('Mailroom lookup:', { 
      found: !!mailroom, 
      mailroomId: mailroom?.id,
      mailroomOrgId: mailroom?.organization_id,
      error: mailroomError?.message
    });
    
    if (mailroomError || !mailroom) {
      console.log('Mailroom not found for slug:', mailroomSlug, mailroomError);
      return res.status(404).json({ error: 'Mailroom not found' });
    }

    // Verify user has access to this organization (is an admin or belongs to the organization)
    console.log('Access check:', {
      userRole: userProfile.role,
      userOrgId: userProfile.organization_id,
      targetOrgId: organization.id,
      hasAccess: userProfile.role === 'admin' || userProfile.organization_id === organization.id
    });
    
    if (userProfile.role !== 'admin' && userProfile.organization_id !== organization.id) {
      console.log('Access denied: User does not have access to this organization');
      return res.status(403).json({ error: 'You do not have access to this organization' });
    }

    // Return the IDs
    console.log('Access granted: Returning organization and mailroom IDs');
    return res.status(200).json({
      organizationId: organization.id,
      mailroomId: mailroom.id
    });
  } catch (error) {
    console.error('Error fetching mailroom details:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 