import { NextApiRequest, NextApiResponse } from 'next';

import sendEmailWithContent from '@/lib/sendEmail'; // Assuming this path is correct

interface EmailPayload {
  recipientEmail: string;
  recipientFirstName: string | null;
  packageId: string;
  provider: string;
  mailroomHoursString: string;
  additionalText: string | null;
  adminEmail: string;
  fromEmail: string;
  fromPass: string;
}

export async function processAndSendNotificationEmail(payload: EmailPayload): Promise<void> {
  const {
    recipientEmail,
    recipientFirstName,
    packageId,
    provider,
    mailroomHoursString,
    additionalText,
    adminEmail,
    fromEmail,
    fromPass,
  } = payload;

  if (!recipientEmail || !packageId || !provider || !adminEmail || !fromEmail || !fromPass) {
    // In a direct function call, we should throw an error or return a status
    // For background tasks, console.error and returning might be enough
    console.error('Missing required email parameters in processAndSendNotificationEmail.', payload);
    throw new Error('Missing required email parameters.');
  }

  const emailSubject = `New Package Notification (#${packageId})`;
  let emailBody = `
Hello ${recipientFirstName || 'Resident'},

You have a new package (#${packageId}) waiting for you from ${provider}.
`;

  if (mailroomHoursString && mailroomHoursString !== "Not specified.") {
    emailBody += `\nMailroom Hours:\n${mailroomHoursString}\n`;
  }

  emailBody += `\nPlease bring your ID to collect it from the mailroom.\n`;

  if (additionalText) {
    emailBody += `\n${additionalText}\n`;
  }

  emailBody += '\nThank you.';

  // Log attempt
  console.log(`Attempting to send package notification email to ${recipientEmail} for package ${packageId} via direct function call`);

  await sendEmailWithContent(
    recipientEmail,
    emailBody,
    adminEmail,
    fromEmail,
    fromPass,
    emailSubject
  );

  // Log success
  console.log(`Package notification email successfully sent to ${recipientEmail} for package ${packageId} via direct function call`);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await processAndSendNotificationEmail(req.body as EmailPayload);
    return res.status(200).json({ message: 'Email sent successfully.' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in send-notification-email handler:', errorMessage, error);
    // Determine status code based on error message if needed, otherwise default to 500
    if (errorMessage.includes('Missing required email parameters')) {
        return res.status(400).json({ error: errorMessage });
    }
    return res.status(500).json({ error: 'Failed to send email.' });
  }
} 