import { NextApiRequest, NextApiResponse } from 'next';
import { Package, PackageNoIds } from '@/lib/types';

import { createAdminClient } from '@/lib/supabase';
import getUserId from '@/lib/handleSession';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Package | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const packageData = req.body as PackageNoIds;
    
    const supabaseAdmin = createAdminClient()
    const authHeader = req.headers.authorization;
    const userId = await getUserId(supabaseAdmin, authHeader)
    
    // Get the mailroom ID and organization ID for the user
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('mailroom_id, organization_id')
      .eq('id', userId)
      .single();

    console.log(profileData, profileError)
    
    if (profileError || !profileData?.mailroom_id || !profileData?.organization_id) {
      return res.status(400).json({ error: 'User not associated with a mailroom and organization' });
    }
    
    const mailroomId = profileData.mailroom_id;
    const organizationId = profileData.organization_id;
    
    try {
      // 1. Get the next package ID from the queue
      const { data: packageNumber, error: queueError } = await supabaseAdmin.rpc(
        'get_next_package_number',
        { p_mailroom_id: mailroomId }
      );
      
      if (queueError || !packageNumber) {
        throw new Error(`Failed to get package number: ${queueError?.message || 'No package numbers available'}`);
      }
      
      // 2. Find the resident record - don't create if it doesn't exist
      const { data: existingResident } = await supabaseAdmin
        .from('residents')
        .select('id, first_name, last_name, email, student_id')
        .eq('student_id', packageData.residentId)
        .eq('mailroom_id', mailroomId)
        .single();
      
      // If no resident record found, fail the operation
      if (!existingResident) {
        throw new Error(`No resident found with student ID ${packageData.residentId} in this mailroom`);
      }
      
      const residentId = existingResident.id;
      
      // 3. Insert the package
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
      
      // 5. Get email configuration from mailroom and organization
      const { data: mailroomData, error: mailroomError } = await supabaseAdmin
        .from('mailrooms')
        .select('admin_email, mailroom_hours, email_additional_text')
        .eq('id', mailroomId)
        .single();
      
      if (mailroomError || !mailroomData) {
        throw new Error(`Failed to fetch mailroom data: ${mailroomError?.message || 'Essential mailroom data is missing.'}`);
      }
      
      const { data: orgData, error: orgError } = await supabaseAdmin
        .from('organizations')
        .select('notification_email, notification_email_password')
        .eq('id', organizationId)
        .single();
      
      if (orgError || !orgData) {
        throw new Error(`Failed to fetch organization data: ${orgError?.message}`);
      }
      
      if (!mailroomData.admin_email) {
        throw new Error('Admin email not configured for the mailroom. Cannot send notification.');
      }
      const adminEmail = mailroomData.admin_email;
      const fromEmail = orgData.notification_email;
      const fromPass = orgData.notification_email_password;

      const additionalText = mailroomData.email_additional_text || '';

      // Format mailroom hours
      let mailroomHoursString = "Not specified.";
      if (mailroomData.mailroom_hours && typeof mailroomData.mailroom_hours === 'object') {
        const hours = mailroomData.mailroom_hours as Record<string, { closed: boolean; periods: Array<{ open: string; close: string }> }>;
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
      
      // 6. Trigger email notification in the background
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
      };

      fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/send-notification-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload),
      })
      .then(async response => {
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Failed to parse error from send-notification-email"}));
          console.error(`Error triggering send-notification-email for package ${insertedPackage.package_id}: ${response.status}`, errorData);
        } else {
          console.log(`Successfully triggered send-notification-email for package ${insertedPackage.package_id}`);
        }
      })
      .catch(error => {
        console.error(`Network or other error triggering send-notification-email for package ${insertedPackage.package_id}:`, error);
      });
      
      // 7. Return the created package data
      const responsePackage: Package = {
        First: existingResident.first_name,
        Last: existingResident.last_name,
        Email: existingResident.email,
        provider: insertedPackage.provider,
        residentId: existingResident.student_id,
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