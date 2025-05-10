import { NextApiRequest, NextApiResponse } from 'next';

import { Package } from '@/lib/types';
import { createAdminClient } from '@/lib/supabase';
import getUserId from '@/lib/handleSession';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ records: Package[] } | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const studentId = req.body as string;
    
    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required' });
    }
    
    const supabaseAdmin = createAdminClient()
    const authHeader = req.headers.authorization;
    const userId = await getUserId(supabaseAdmin, authHeader)
    
    // Get the mailroom ID for the user
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('mailroom_id')
      .eq('id', userId)
      .single();
    
    if (profileError || !profileData?.mailroom_id) {
      return res.status(400).json({ error: 'User not associated with a mailroom' });
    }
    
    const mailroomId = profileData.mailroom_id;
    
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