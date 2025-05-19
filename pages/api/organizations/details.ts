import { NextApiRequest, NextApiResponse } from 'next';

import { createAdminClient } from '@/lib/supabase';
import getUserId from '@/lib/handleSession';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ organizationId: string; organizationName?: string; } | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseAdmin = createAdminClient();
  const authHeader = req.headers.authorization;

  try {
    // Ensure user is authenticated
    await getUserId(supabaseAdmin, authHeader);

    const { orgSlug } = req.query;

    if (!orgSlug || typeof orgSlug !== 'string') {
      return res.status(400).json({ error: 'Organization slug is required.' });
    }

    const { data: organization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name') // Assuming 'slug' is the column for orgSlug
      .eq('slug', orgSlug) // Use the actual column name for the slug in your DB
      .single();

    if (orgError) {
      if (orgError.code === 'PGRST116') { // Row not found
        return res.status(404).json({ error: 'Organization not found.' });
      }
      console.error('Error fetching organization details by slug:', orgError);
      return res.status(500).json({ error: `Database error: ${orgError.message}` });
    }

    // The .single() method should ensure that if no error, 'organization' is not null.
    // However, an explicit check can be kept if preferred, though typically PGRST116 handles it.
    if (!organization) { 
      return res.status(404).json({ error: 'Organization not found (unexpected).' });
    }

    return res.status(200).json({ 
      organizationId: organization.id,
      organizationName: organization.name 
    });

  } catch (error) {
    console.error('Server error fetching organization details:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (errorMessage.toLowerCase().includes('jwt expired') || errorMessage.toLowerCase().includes('invalid token')) {
        return res.status(401).json({ error: "Session expired or invalid. Please log in again." });
    }
    return res.status(500).json({ error: errorMessage });
  }
} 