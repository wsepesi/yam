import { NextApiRequest, NextApiResponse } from 'next';
import { Package, PackageNoIds } from '@/lib/types';

import { createAdminClient } from '@/lib/supabase';
import getUserId from '@/lib/handleSession';
import { processAndSendNotificationEmail } from './send-notification-email';
import { waitUntil } from '@vercel/functions';

// Type for the email payload, can be shared or defined here if specific
interface EmailPayloadForPackage {
  recipientEmail: string;
  recipientFirstName: string | null;
  packageId: string;
  provider: string;
  mailroomHoursString: string;
  additionalText: string | null;
  adminEmail: string;
  fromEmail: string;
  fromPass: string;
  pickupOption: string | null;
}

// Updated background email sending function
async function sendEmailDirectlyInBackground(
  emailPayload: EmailPayloadForPackage,
  packageId: string,
  recipientEmail: string
) {
  try {
    console.log(`Calling processAndSendNotificationEmail directly for package ${packageId}`);
    // Directly call the imported function
    await processAndSendNotificationEmail(emailPayload);
    console.log(`Successfully processed email for package ${packageId} to ${recipientEmail} via direct call`);
  } catch (error) {
    console.error(`Error calling processAndSendNotificationEmail for package ${packageId}:`, error);
    // Decide if this error needs to be handled beyond logging for background tasks
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Package | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { orgSlug, mailroomSlug, ...packageData } = req.body as PackageNoIds & { orgSlug: string, mailroomSlug: string };

    if (!packageData || !packageData.residentId || !packageData.provider || !orgSlug || !mailroomSlug) {
      return res.status(400).json({ error: 'Missing required package data, orgSlug, or mailroomSlug' });
    }
    
    const supabaseAdmin = createAdminClient();
    const authHeader = req.headers.authorization; // Keep for staff_id logging
    const userId = await getUserId(supabaseAdmin, authHeader);

    if (!userId) { // Ensure userId is fetched for logging
        return res.status(401).json({ error: 'Unauthorized or unable to determine staff ID for logging.' });
    }
    
    // Fetch mailroom_id and organization_id based on orgSlug and mailroomSlug
    const { data: mailroomRecord, error: mailroomError } = await supabaseAdmin
      .from('mailrooms')
      .select('id, organization_id, admin_email, mailroom_hours, email_additional_text, pickup_option') // Select fields needed later
      .eq('slug', mailroomSlug)
      .single();

    if (mailroomError || !mailroomRecord) {
      console.error(`Error fetching mailroom by slug ${mailroomSlug}:`, mailroomError);
      return res.status(404).json({ error: 'Mailroom not found.' });
    }

    const { data: orgRecord, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, notification_email, notification_email_password') // Select fields needed later
      .eq('slug', orgSlug)
      .eq('id', mailroomRecord.organization_id)
      .single();

    if (orgError || !orgRecord) {
      console.error(`Error fetching organization by slug ${orgSlug} or mailroom mismatch:`, orgError);
      return res.status(404).json({ error: 'Organization not found or mailroom does not belong to it.' });
    }
    
    const mailroomId = mailroomRecord.id;
    
    try {
      const { data: packageNumber, error: queueError } = await supabaseAdmin.rpc(
        'get_next_package_number',
        { p_mailroom_id: mailroomId }
      );
      
      if (queueError || !packageNumber) {
        throw new Error(`Failed to get package number: ${queueError?.message || 'No package numbers available'}`);
      }
      
      const { data: existingResident } = await supabaseAdmin
        .from('residents')
        .select('id, first_name, last_name, email, student_id')
        .eq('status', 'ACTIVE')
        .eq('student_id', packageData.residentId)
        .eq('mailroom_id', mailroomId)
        .single();
      
      // If no resident record found, fail the operation
      if (!existingResident) {
        throw new Error(`No resident found with student ID ${packageData.residentId} in this mailroom`);
      }
      
      const residentId = existingResident.id;
      
      const { data: insertedPackage, error: packageError } = await supabaseAdmin
        .from('packages')
        .insert({
          mailroom_id: mailroomId,
          staff_id: userId,
          resident_id: residentId,
          status: 'WAITING',
          provider: packageData.provider,
          package_id: packageNumber
        })
        .select()
        .single();
      
      if (packageError || !insertedPackage) {
        throw new Error(`Failed to insert package: ${packageError?.message}`);
      }
      
      if (!mailroomRecord.admin_email) {
        throw new Error('Admin email not configured for the mailroom. Cannot send notification.');
      }
      const adminEmail = mailroomRecord.admin_email;
      const fromEmail = orgRecord.notification_email;
      const fromPass = orgRecord.notification_email_password;

      const additionalText = mailroomRecord.email_additional_text || '';

      // Format mailroom hours
      let mailroomHoursString = "Not specified."; // TODO: Consider making this a default in DB or a shared constant
      if (mailroomRecord.mailroom_hours && typeof mailroomRecord.mailroom_hours === 'object') {
        const hours = mailroomRecord.mailroom_hours as Record<string, { closed: boolean; periods: Array<{ open: string; close: string }> }>;
        const lines: string[] = [];
        Object.entries(hours).forEach(([day, schedule]) => {
          if (schedule.closed) {
            lines.push(`${day}: Closed`);
          } else if (schedule.periods && schedule.periods.length > 0) {
            const periodStrings = schedule.periods.map(p => `${p.open} - ${p.close}`);
            lines.push(`${day}: ${periodStrings.join(', ')}`);
          } else {
            lines.push(`${day}: Not specified`); // Or handle as an error/log
          }
        });
        if (lines.length > 0) {
          mailroomHoursString = lines.join('\n');
        }
      }
      
      const emailPayload = {
        recipientEmail: existingResident.email,
        recipientFirstName: existingResident.first_name,
        packageId: insertedPackage.package_id.toString(),
        provider: insertedPackage.provider,
        mailroomHoursString,
        additionalText,
        adminEmail,
        fromEmail,
        fromPass,
        pickupOption: mailroomRecord.pickup_option,
      };

      // Send notification email in background using waitUntil
      console.log(`Attempting to send notification email for package ${insertedPackage.package_id} to ${existingResident.email}`);
      
      // Use waitUntil to send email asynchronously without blocking the response
      waitUntil(
        sendEmailDirectlyInBackground(
          emailPayload, 
          insertedPackage.package_id.toString(), 
          existingResident.email
        ).catch(error => {
          console.error(`Background email processing error for package ${insertedPackage.package_id}:`, error);
        })
      );
      
      // Return immediately without waiting for email
      const responsePackage: Package = {
        First: existingResident.first_name,
        Last: existingResident.last_name,
        Email: existingResident.email,
        provider: insertedPackage.provider,
        residentId: existingResident.id,
        packageId: insertedPackage.package_id.toString(),
        status: insertedPackage.status.toLowerCase() as 'pending',
        createdAt: insertedPackage.created_at,
        updatedAt: insertedPackage.updated_at
      };
      
      return res.status(200).json(responsePackage);
      
    } catch (error) {
      throw error;
    }
    
  } catch (error) {
    console.error('Error adding package:', error);
    
    // Return more specific error for the client to handle
    const errorMessage = error instanceof Error ? error.message : 'Failed to add package';
    
    if (errorMessage.includes('package number')) {
      return res.status(409).json({ error: 'No package numbers available' });
    }
    
    if (errorMessage.includes('No resident found')) {
      return res.status(404).json({ error: errorMessage });
    }
    
    return res.status(500).json({ error: errorMessage });
  }
} 