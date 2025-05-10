import { NextApiRequest, NextApiResponse } from 'next';
import { Package, PackageNoIds } from '@/lib/types';

import { createAdminClient } from '@/lib/supabase';
import getUserId from '@/lib/handleSession';
import sendEmailWithContent from '@/lib/sendEmail';

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
        .select('admin_email')
        .eq('id', mailroomId)
        .single();
        
      if (mailroomError || !mailroomData) {
        throw new Error(`Failed to fetch mailroom data: ${mailroomError?.message}`);
      }
      
      const { data: orgData, error: orgError } = await supabaseAdmin
        .from('organizations')
        .select('notification_email, notification_email_password')
        .eq('id', organizationId)
        .single();
        
      if (orgError || !orgData) {
        throw new Error(`Failed to fetch organization data: ${orgError?.message}`);
      }
      
      const adminEmail = mailroomData.admin_email;
      const fromEmail = orgData.notification_email;
      const fromPass = orgData.notification_email_password;
      
      // 6. Send email notification
      try {
        const emailContent = `
          Hello ${existingResident.first_name},
          
          You have a new package (#${insertedPackage.package_id}) waiting for you from ${insertedPackage.provider}.
          
          Please bring your ID to collect it from the mailroom.
          
          Thank you.
        `;
        
        await sendEmailWithContent(
          existingResident.email,
          emailContent,
          adminEmail, 
          fromEmail,
          fromPass,
          `New Package Notification (#${insertedPackage.package_id})`
        );
      } catch (emailError) {
        console.error("Email notification failed, but package was registered:", emailError);
        // We don't return an error here since the package was successfully registered
      }
      
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