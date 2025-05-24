import { NextApiRequest, NextApiResponse } from 'next';

import { createAdminClient } from '@/lib/supabase';
import getUserId from '@/lib/handleSession';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseAdmin = createAdminClient();
  try {
    const authHeader = req.headers.authorization;
    const userId = await getUserId(supabaseAdmin, authHeader);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileError || !userProfile) {
      return res.status(400).json({ error: 'Could not fetch user profile' });
    }

    if (userProfile.role !== 'super-admin') {
      return res.status(403).json({ error: 'User does not have permission to create organizations.' });
    }

    const { name, slug, status = 'PENDING_SETUP' } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: 'Missing required fields: name or slug' });
    }

    // Validate slug format (e.g., lowercase, no spaces, hyphens allowed)
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(slug)) {
      return res.status(400).json({ error: 'Invalid slug format. Use lowercase letters, numbers, and hyphens.' });
    }
    
    // Check if org with the same slug already exists
    const { data: existingOrg, error: existingOrgError } = await supabaseAdmin
        .from('organizations')
        .select('id')
        .eq('slug', slug)
        .maybeSingle(); // Use maybeSingle to not error if it doesn't exist

    if (existingOrgError && existingOrgError.code !== 'PGRST116') { // PGRST116: Row not found
        console.error("Error checking for existing organization slug:", existingOrgError);
        return res.status(500).json({ error: "Error validating organization slug." });
    }
    if (existingOrg) {
        return res.status(409).json({ error: `An organization with slug '${slug}' already exists.` });
    }


    const { data: newOrganization, error: createError } = await supabaseAdmin
      .from('organizations')
      .insert([
        {
          name: name as string,
          slug: slug as string,
          created_by: userId, 
          status: status as string, // e.g., PENDING_SETUP, ACTIVE
          // Any other default fields for a new organization
        },
      ])
      .select()
      .single();

    if (createError) {
      console.error('Supabase create organization error:', createError);
      // Check for unique constraint violation on slug, though we checked above, this is a safeguard
      if (createError.code === '23505') { // Unique violation
          return res.status(409).json({ error: `Organization with name '${name}' or slug '${slug}' likely already exists.` });
      }
      return res.status(500).json({ error: createError.message || 'Failed to create organization.' });
    }

    if (!newOrganization) {
      return res.status(500).json({ error: 'Organization created but no data was returned.' });
    }

    return res.status(201).json(newOrganization);

  } catch (error) {
    console.error('API error creating organization:', error);
    if (error instanceof Error) {
        return res.status(500).json({ error: error.message });
    }
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
} 