import { NextApiRequest, NextApiResponse } from 'next';

import { createAdminClient } from '@/lib/supabase';
import getUserId from '@/lib/handleSession';

interface MailroomHourPeriod {
  open: string;
  close: string;
}

interface MailroomDayHours {
  periods: MailroomHourPeriod[];
  closed: boolean;
}

interface MailroomSettingsResponse {
  // email_subject_template?: string;
  // email_body_template?: string;
  mailroom_hours?: Record<string, MailroomDayHours>;
  email_additional_text?: string;
  // pickup_instructions?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MailroomSettingsResponse | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseAdmin = createAdminClient();
  const authHeader = req.headers.authorization;
  const { mailroomId } = req.query;

  if (!mailroomId || typeof mailroomId !== 'string') {
    return res.status(400).json({ error: 'Mailroom ID is required.' });
  }

  try {
    const userId = await getUserId(supabaseAdmin, authHeader);

    // Fetch user profile to check permissions
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, mailroom_id, organization_id')
      .eq('id', userId)
      .single();

    if (profileError || !profileData) {
      console.error('Profile fetch error:', profileError);
      return res.status(401).json({ error: 'Unauthorized or profile not found.' });
    }

    // Permission check: User must be admin or manager of the specific mailroom.
    // Adjust based on your exact permission model.
    if (!(profileData.role === 'admin' || profileData.role === 'super-admin' || (profileData.role === 'manager' && profileData.mailroom_id === mailroomId))) {
      return res.status(403).json({ error: 'Insufficient permissions to view settings for this mailroom.' });
    }

    const { data, error } = await supabaseAdmin
      .from('mailrooms') // Select from 'mailrooms' table
      .select('mailroom_hours, email_additional_text') // Corrected select string
      .eq('id', mailroomId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { 
        return res.status(404).json({ error: 'No email settings found for this mailroom.' });
      }
      console.error('Error fetching mailroom email settings:', error);
      return res.status(500).json({ error: `Database error: ${error.message}` });
    }

    if (!data) {
        return res.status(404).json({ error: 'No email settings found (data is null).' });
    }

    const responseData: MailroomSettingsResponse = {
        // email_subject_template: data.email_subject_template,
        // email_body_template: data.email_body_template,
        mailroom_hours: data.mailroom_hours || {},
        email_additional_text: data.email_additional_text,
        // pickup_instructions: data.pickup_instructions,
    };

    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=300');
    res.setHeader('Vary', 'Authorization');
    return res.status(200).json(responseData);

  } catch (err) {
    console.error('Server error fetching email settings:', err);
    const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
    if (errorMessage.toLowerCase().includes('jwt expired') || errorMessage.toLowerCase().includes('invalid token')) {
        return res.status(401).json({ error: "Session expired or invalid. Please log in again." });
    }
    return res.status(500).json({ error: errorMessage });
  }
} 