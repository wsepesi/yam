import type { NextApiRequest, NextApiResponse } from "next";

import sendEmailWithContent from "@/lib/sendEmail"; // Assuming this path is correct

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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
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
    } = req.body as EmailPayload;

    if (
      !recipientEmail ||
      !packageId ||
      !provider ||
      !adminEmail ||
      !fromEmail ||
      !fromPass
    ) {
      return res
        .status(400)
        .json({ error: "Missing required email parameters." });
    }

    const emailSubject = `New Package Notification (#${packageId})`;
    let emailBody = `
Hello ${recipientFirstName || "Resident"},

You have a new package (#${packageId}) waiting for you from ${provider}.
`;

    if (mailroomHoursString && mailroomHoursString !== "Not specified.") {
      emailBody += `\nMailroom Hours:\n${mailroomHoursString}\n`;
    }

    emailBody += `\nPlease bring your ID to collect it from the mailroom.\n`;

    if (additionalText) {
      emailBody += `\n${additionalText}\n`;
    }

    emailBody += "\nThank you.";

    // Log attempt
    console.log(
      `Attempting to send package notification email to ${recipientEmail} for package ${packageId}`
    );

    await sendEmailWithContent(
      recipientEmail,
      emailBody,
      adminEmail,
      fromEmail,
      fromPass,
      emailSubject
    );

    // Log success
    console.log(
      `Package notification email successfully sent to ${recipientEmail} for package ${packageId}`
    );
    return res.status(200).json({ message: "Email sent successfully." });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(
      "Error sending package notification email:",
      errorMessage,
      error
    );
    // Don't send detailed error to client for security, but important to log it
    return res.status(500).json({ error: "Failed to send email." });
  }
}
