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

interface UpdateMailroomEmailSettingsRequestBody {
  mailroomId: string;
  // emailSubjectTemplate?: string;
  // emailBodyTemplate?: string;
  mailroomHours?: Record<string, MailroomDayHours>;
  emailAdditionalText?: string;
  // pickupInstructions?: string;
}

// For Supabase update, ensure keys match DB column names on 'mailrooms' table
interface MailroomSettingsUpdate {
  // email_subject_template?: string;
  // email_body_template?: string;
  mailroom_hours?: Record<string, MailroomDayHours>;
  email_additional_text?: string;
  // pickup_instructions?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean; message: string } | { error: string }>
) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseAdmin = createAdminClient();
  const authHeader = req.headers.authorization;

  try {
    const userId = await getUserId(supabaseAdmin, authHeader);

    const {
      mailroomId,
      // emailSubjectTemplate,
      // emailBodyTemplate,
      mailroomHours,
      emailAdditionalText,
      // pickupInstructions,
    } = req.body as UpdateMailroomEmailSettingsRequestBody;

    if (!mailroomId) {
      return res.status(400).json({ error: 'Mailroom ID is required.' });
    }

    // Fetch user profile to check permissions (e.g., user is manager of this mailroom)
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, mailroom_id, organization_id') // Assuming profile has mailroom_id
      .eq('id', userId)
      .single();

    if (profileError || !profileData) {
      console.error('Profile fetch error:', profileError);
      return res.status(401).json({ error: 'Unauthorized or profile not found.' });
    }

    // Permission check: User must be admin or manager of the specific mailroom.
    // Adjust this logic based on your exact permission model.
    // (profileData.role === 'admin' && profileData.organization_id === /* mailroom's orgId */) ||
    if (!(profileData.role === 'admin' || profileData.role === 'super-admin' || (profileData.role === 'manager' && profileData.mailroom_id === mailroomId))) {
         return res.status(403).json({ error: 'Insufficient permissions to update settings for this mailroom.' });
    }

    const updateObject: MailroomSettingsUpdate = {};
    // if (emailSubjectTemplate !== undefined) updateObject.email_subject_template = emailSubjectTemplate;
    // if (emailBodyTemplate !== undefined) updateObject.email_body_template = emailBodyTemplate;
    if (mailroomHours !== undefined) updateObject.mailroom_hours = mailroomHours;
    if (emailAdditionalText !== undefined) updateObject.email_additional_text = emailAdditionalText;
    // if (pickupInstructions !== undefined) updateObject.pickup_instructions = pickupInstructions;

    if (Object.keys(updateObject).length === 0) {
        return res.status(400).json({ error: 'No update data provided.' });
    }
    
    const { error: updateError } = await supabaseAdmin
      .from('mailrooms') // Update 'mailrooms' table
      .update(updateObject)
      .eq('id', mailroomId);

    if (updateError) {
      console.error('Error updating mailroom email settings:', updateError);
      return res.status(500).json({ error: `Failed to update email settings: ${updateError.message}` });
    }

    return res.status(200).json({ success: true, message: 'Email settings updated successfully.' });
  } catch (error) {
    console.error('Server error updating email settings:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (errorMessage.toLowerCase().includes('jwt expired') || errorMessage.toLowerCase().includes('invalid token')) {
        return res.status(401).json({ error: "Session expired or invalid. Please log in again." });
    }
    return res.status(500).json({ error: errorMessage });
  }
} 