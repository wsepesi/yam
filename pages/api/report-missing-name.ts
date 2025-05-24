import type { NextApiRequest, NextApiResponse } from "next";

import getUserId from "@/lib/handleSession";
import sendEmailWithContent from "@/lib/sendEmail";
import { createAdminClient } from "@/lib/supabase";

interface ReportData {
  name: string;
  email: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  try {
    const reportData = req.body as ReportData;

    // 1. Validate the data
    if (!reportData.name || !reportData.email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    const supabaseAdmin = createAdminClient();
    const authHeader = req.headers.authorization;
    const userId = await getUserId(supabaseAdmin, authHeader);

    // Get the user's mailroom and organization
    const { data: profileData } = await supabaseAdmin
      .from("profiles")
      .select("mailroom_id, organization_id")
      .eq("id", userId)
      .single();

    if (!profileData?.mailroom_id || !profileData?.organization_id) {
      return res.status(400).json({
        error: "User not associated with a mailroom and organization",
      });
    }

    const mailroomId = profileData.mailroom_id;
    const organizationId = profileData.organization_id;

    // 3. Send notification email
    try {
      // Get email configuration from mailroom and organization
      const { data: mailroomData } = await supabaseAdmin
        .from("mailrooms")
        .select("admin_email")
        .eq("id", mailroomId)
        .single();

      const { data: orgData } = await supabaseAdmin
        .from("organizations")
        .select("notification_email, notification_email_password")
        .eq("id", organizationId)
        .single();

      if (!mailroomData || !orgData) {
        return res.status(400).json({ error: "Email configuration not found" });
      }

      const adminEmail = mailroomData.admin_email;
      const fromEmail = orgData.notification_email;
      const fromPass = orgData.notification_email_password;

      const emailContent = `
        A missing name has been reported:
        
        Student Name: ${reportData.name}
        Student Email: ${reportData.email}
        
        Please review and add this student to the system.
      `;

      await sendEmailWithContent(
        adminEmail,
        emailContent,
        adminEmail,
        fromEmail,
        fromPass,
        "Missing Student Name Report"
      );

      console.log("Missing name report email sent:", {
        name: reportData.name,
        email: reportData.email,
      });

      return res.status(200).json({ message: "Report submitted successfully" });
    } catch (emailError) {
      console.error("Email notification failed:", emailError);
      return res
        .status(500)
        .json({ error: "Failed to send email notification" });
    }
  } catch (error) {
    console.error("Error submitting report:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to submit report";
    return res.status(500).json({ error: errorMessage });
  }
}
