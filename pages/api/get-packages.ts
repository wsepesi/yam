import { NextApiRequest, NextApiResponse } from 'next';

import { Package } from '@/lib/types';
import { createAdminClient } from '@/lib/supabase';

// import getUserId from '@/lib/handleSession'; // Removed as it's unused now

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ records: Package[] } | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { student_id: studentId, orgSlug, mailroomSlug } = req.body;

  if (!studentId || !orgSlug || !mailroomSlug) {
    return res.status(400).json({ error: 'student_id, orgSlug, and mailroomSlug are required in the request body.' });
  }

  try {
    const supabaseAdmin = createAdminClient();
    // const authHeader = req.headers.authorization; // Potentially needed for role checks
    // const userId = await getUserId(supabaseAdmin, authHeader);

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
    
    // Find the resident ID for this student in this mailroom
    const { data: resident, error: residentError } = await supabaseAdmin
      .from('residents')
      .select('id, first_name, last_name, email')
      .eq('student_id', studentId)
      .eq('mailroom_id', mailroomId)
      .single();
    
    if (residentError || !resident) {
      return res.status(404).json({ error: 'Student not found in this mailroom' });
    }
    
    // Get all pending packages for this resident
    const { data: packages, error: packagesError } = await supabaseAdmin
      .from('packages')
      .select('id, package_id, provider, status, created_at, updated_at')
      .eq('resident_id', resident.id)
      .eq('status', 'WAITING')
      .eq('mailroom_id', mailroomId);
    
    if (packagesError) {
      return res.status(500).json({ error: 'Failed to fetch packages' });
    }
    
    // Format packages for the frontend
    const formattedPackages: Package[] = packages.map(pkg => ({
      First: resident.first_name,
      Last: resident.last_name,
      Email: resident.email || '',
      provider: pkg.provider,
      residentId: studentId,
      packageId: pkg.package_id.toString(),
      status: 'pending',
      createdAt: pkg.created_at,
      updatedAt: pkg.updated_at
    }));
    
    return res.status(200).json({ records: formattedPackages });
  } catch (error) {
    console.error('Error fetching packages:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 