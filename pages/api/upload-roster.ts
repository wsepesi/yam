import { NextApiRequest, NextApiResponse } from 'next';

import { createAdminClient } from '@/lib/supabase';
import getUserId from '@/lib/handleSession';

interface UploadedResident {
  first_name?: string;
  last_name?: string;
  resident_id?: string;
  email?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ message: string } | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { residents: newResidentsData, orgSlug, mailroomSlug } = req.body as { residents: UploadedResident[], orgSlug: string, mailroomSlug: string };

  if (!newResidentsData || !Array.isArray(newResidentsData) || newResidentsData.length === 0 || !orgSlug || !mailroomSlug) {
    return res.status(400).json({ error: 'No resident data provided, or orgSlug/mailroomSlug missing, or data is invalid.' });
  }

  try {
    const supabaseAdmin = createAdminClient();
    const authHeader = req.headers.authorization;
    const userId = await getUserId(supabaseAdmin, authHeader);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated or staff ID cannot be determined for logging.' });
    }

    const { data: mailroomRecord, error: mailroomFetchError } = await supabaseAdmin
      .from('mailrooms')
      .select('id, organization_id')
      .eq('slug', mailroomSlug)
      .single();

    if (mailroomFetchError || !mailroomRecord) {
      console.error(`Error fetching mailroom by slug ${mailroomSlug}:`, mailroomFetchError);
      return res.status(404).json({ error: 'Mailroom not found.' });
    }

    const { data: orgData, error: orgFetchError } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .eq('id', mailroomRecord.organization_id)
      .single();

    if (orgFetchError || !orgData) {
      console.error(`Error fetching organization by slug ${orgSlug} or mailroom mismatch:`, orgFetchError);
      return res.status(404).json({ error: 'Organization not found or mailroom does not belong to it.' });
    }
    
    const mailroomId = mailroomRecord.id;

    for (const resident of newResidentsData) {
      if (!resident.first_name || !resident.last_name || !resident.resident_id) {
        return res.status(400).json({ error: `Missing required fields for one or more residents. Ensure first_name, last_name, and resident_id are present. Problematic entry: ${JSON.stringify(resident)}` });
      }
    }
    
    const { error: updateError } = await supabaseAdmin
      .from('residents')
      .update({ status: 'REMOVED_BULK', updated_at: new Date().toISOString() })
      .eq('mailroom_id', mailroomId)
      .eq('status', 'ACTIVE');

    if (updateError) {
      console.error('Error updating existing residents:', updateError);
      return res.status(500).json({ error: 'Failed to update existing residents.' });
    }

    const residentsToInsert = newResidentsData.map(resData => ({
      mailroom_id: mailroomId,
      first_name: resData.first_name,
      last_name: resData.last_name,
      student_id: resData.resident_id,
      email: resData.email,
      added_by: userId,
      status: 'ACTIVE',
    }));

    const { data: insertedData, error: insertError } = await supabaseAdmin
      .from('residents')
      .insert(residentsToInsert)
      .select();

    if (insertError) {
      console.error('Error inserting new residents:', insertError);
      return res.status(500).json({ error: `Failed to insert new residents: ${insertError.message}` });
    }

    const count = insertedData?.length || 0;
    return res.status(200).json({ message: `${count} residents successfully uploaded and added.` });

  } catch (error: unknown) {
    console.error('Error processing roster upload:', error);
    let errorMessage = 'Internal server error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return res.status(500).json({ error: errorMessage });
  }
} 