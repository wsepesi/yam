import { NextApiRequest, NextApiResponse } from 'next';

import { Resident } from '@/lib/types';
import { createAdminClient } from '@/lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ records: Resident[] } | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orgSlug, mailroomSlug, query: searchQuery } = req.query;

  if (!orgSlug || !mailroomSlug || typeof orgSlug !== 'string' || typeof mailroomSlug !== 'string') {
    return res.status(400).json({ error: 'orgSlug and mailroomSlug are required query parameters.' });
  }

  try {
    const supabaseAdmin = createAdminClient();

    // Fetch mailroom_id based on orgSlug and mailroomSlug
    const { data: mailroomData, error: mailroomError } = await supabaseAdmin
      .from('mailrooms')
      .select('id, organization_id')
      .eq('slug', mailroomSlug)
      .single();

    if (mailroomError || !mailroomData) {
      console.error(`Error fetching mailroom by slug ${mailroomSlug}:`, mailroomError);
      return res.status(404).json({ error: 'Mailroom not found.' });
    }

    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .eq('id', mailroomData.organization_id)
      .single();

    if (orgError || !orgData) {
      console.error(`Error fetching organization by slug ${orgSlug} or mailroom mismatch:`, orgError);
      return res.status(404).json({ error: 'Organization not found or mailroom does not belong to it.' });
    }

    const mailroomId = mailroomData.id;

    // Get all residents for this mailroom
    let queryBuilder = supabaseAdmin
      .from('residents')
      .select('id, mailroom_id, first_name, last_name, student_id, email, created_at, updated_at, added_by, status')
      .eq('mailroom_id', mailroomId)
      .eq('status', 'ACTIVE');

    if (searchQuery && typeof searchQuery === 'string') {
      // Add conditions for search query. Example: searching by student_id or name
      // This is a simple example, you might need more sophisticated search logic
      queryBuilder = queryBuilder.or(`student_id.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`);
    }

    const { data: residents, error: residentsError } = await queryBuilder;

    if (residentsError) {
      console.error('Error fetching residents:', residentsError);
      return res.status(500).json({ error: 'Failed to fetch residents' });
    }

    if (!residents) {
      return res.status(200).json({ records: [] }); // Return empty array if no residents found
    }

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300');
    return res.status(200).json({ records: residents as Resident[] });
  } catch (error) {
    console.error('Error fetching residents:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 