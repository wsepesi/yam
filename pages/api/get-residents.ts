import { NextApiRequest, NextApiResponse } from 'next';

import { Resident } from '@/lib/types';
import { createAdminClient } from '@/lib/supabase';
import getUserId from '@/lib/handleSession';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ records: Resident[] } | { error: string }>
) {
  if (req.method !== 'GET') { // Changed to GET as we are fetching all residents for a mailroom
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabaseAdmin = createAdminClient();
    const authHeader = req.headers.authorization;
    const userId = await getUserId(supabaseAdmin, authHeader);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get the mailroom ID for the user
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('mailroom_id')
      .eq('id', userId)
      .single();

    if (profileError || !profileData?.mailroom_id) {
      console.error('Error fetching profile or mailroom_id:', profileError);
      return res.status(400).json({ error: 'User not associated with a mailroom' });
    }

    const mailroomId = profileData.mailroom_id;

    // Get all residents for this mailroom
    const { data: residents, error: residentsError } = await supabaseAdmin
      .from('residents')
      .select('id, mailroom_id, first_name, last_name, student_id, email, created_at, updated_at, added_by, status')
      .eq('mailroom_id', mailroomId)
      .eq('status', 'ACTIVE');

    if (residentsError) {
      console.error('Error fetching residents:', residentsError);
      return res.status(500).json({ error: 'Failed to fetch residents' });
    }

    if (!residents) {
      return res.status(200).json({ records: [] }); // Return empty array if no residents found
    }

    // Format residents for the frontend (if needed, current type matches DB)
    // const formattedResidents: Resident[] = residents.map(res => ({
    //   id: res.id,
    //   mailroom_id: res.mailroom_id,
    //   first_name: res.first_name,
    //   last_name: res.last_name,
    //   student_id: res.student_id,
    //   email: res.email,
    //   created_at: res.created_at,
    //   updated_at: res.updated_at,
    //   added_by: res.added_by,
    // }));

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300');
    return res.status(200).json({ records: residents as Resident[] });
  } catch (error) {
    console.error('Error fetching residents:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 