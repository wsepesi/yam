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

// Helper function to format and sort mailroom hours into MTWTFSS order
function formatAndSortMailroomHours(hoursString: string): string {
  const dayOrderMap: { [key: string]: number } = {
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
    Sunday: 7,
  };

  // Split by comma, trim each part, and filter out empty strings resulting from trailing commas etc.
  const individualDayEntries = hoursString
    .split('\n')
    .map(entry => entry.trim())
    .filter(entry => entry); // Ensure no empty strings proceed
  
  const parsedDayDetails: { day: string; hours: string; sortOrder: number }[] = [];

  for (const entry of individualDayEntries) {
    const match = entry.match(/^(\w+):\s*(.*)$/); // Parses "DayName: Hour Details"
    if (match) {
      const dayName = match[1];
      const hoursDetails = match[2].trim(); // Get the hours part and trim it
      if (dayOrderMap[dayName]) { // Check if dayName is one of the standard 7 days
        parsedDayDetails.push({ day: dayName, hours: hoursDetails, sortOrder: dayOrderMap[dayName] });
      }
      // else: dayName is not in dayOrderMap (e.g., "Holiday", "Mon", or typo) -> ignore it for strict MTWTFSS output
    }
    // else: entry does not match "DayName: Hour Details" format (e.g., "Call for hours") -> ignore it
  }

  // Sort the successfully parsed day entries by their defined order
  parsedDayDetails.sort((a, b) => a.sortOrder - b.sortOrder);

  // Join the sorted and formatted entries with newlines
  // Example: "Monday: 9 AM - 5 PM\nTuesday: 10 AM - 6 PM"
  return parsedDayDetails.map(detail => `${detail.day}: ${detail.hours}`).join('\n');
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
    const formattedHours = formatAndSortMailroomHours(mailroomHoursString);
    if (formattedHours) { // Only add section if formattedHours is not empty
        emailBody += `\nMailroom Hours:\n${formattedHours}\n`;
    }
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