import { NextApiRequest, NextApiResponse } from 'next';

import { createAdminClient } from '@/lib/supabase';
import getUserId from '@/lib/handleSession';

interface UpdateMailroomSettingsRequestBody {
  mailroomId: string;
  pickupOption?: 'resident_id' | 'resident_name';
}

interface MailroomSettingsUpdate {
  pickup_option?: 'resident_id' | 'resident_name';
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
      pickupOption,
    } = req.body as UpdateMailroomSettingsRequestBody;

    if (!mailroomId) {
      return res.status(400).json({ error: 'Mailroom ID is required.' });
    }

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

    // Get the mailroom to verify organization ownership
    const { data: mailroom, error: mailroomError } = await supabaseAdmin
      .from('mailrooms')
      .select('id, organization_id')
      .eq('id', mailroomId)
      .single();

    if (mailroomError || !mailroom) {
      console.error('Mailroom fetch error:', mailroomError);
      return res.status(404).json({ error: 'Mailroom not found.' });
    }

    // Permission check: User must be admin, super-admin, or manager of the specific mailroom
    if (!(profileData.role === 'admin' || 
          profileData.role === 'super-admin' || 
          (profileData.role === 'manager' && profileData.mailroom_id === mailroomId) ||
          (profileData.role === 'admin' && profileData.organization_id === mailroom.organization_id))) {
      return res.status(403).json({ error: 'Insufficient permissions to update settings for this mailroom.' });
    }

    const updateObject: MailroomSettingsUpdate = {};
    if (pickupOption !== undefined) updateObject.pickup_option = pickupOption;

    if (Object.keys(updateObject).length === 0) {
      return res.status(400).json({ error: 'No update data provided.' });
    }
    
    const { error: updateError } = await supabaseAdmin
      .from('mailrooms')
      .update(updateObject)
      .eq('id', mailroomId);

    if (updateError) {
      console.error('Error updating mailroom settings:', updateError);
      return res.status(500).json({ error: `Failed to update settings: ${updateError.message}` });
    }

    return res.status(200).json({ success: true, message: 'Settings updated successfully.' });
  } catch (error) {
    console.error('Server error updating settings:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (errorMessage.toLowerCase().includes('jwt expired') || errorMessage.toLowerCase().includes('invalid token')) {
      return res.status(401).json({ error: "Session expired or invalid. Please log in again." });
    }
    return res.status(500).json({ error: errorMessage });
  }
} 