import type { NextApiRequest, NextApiResponse } from "next";

import getUserId from "@/lib/handleSession";
import { createAdminClient } from "@/lib/supabase";
import type { Package } from "@/lib/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean } | { error: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { orgSlug, mailroomSlug, ...failedPackage } = req.body as Package & {
      orgSlug: string;
      mailroomSlug: string;
      error?: string;
    };

    if (!failedPackage || !orgSlug || !mailroomSlug) {
      return res.status(400).json({
        error: "Failed package data, orgSlug, and mailroomSlug are required",
      });
    }

    const supabaseAdmin = createAdminClient();
    const authHeader = req.headers.authorization;
    const userId = await getUserId(supabaseAdmin, authHeader);

    if (!userId) {
      return res.status(401).json({
        error:
          "Unauthorized or unable to determine staff ID for logging failure.",
      });
    }

    const { data: mailroomRecord, error: mailroomError } = await supabaseAdmin
      .from("mailrooms")
      .select("id, organization_id")
      .eq("slug", mailroomSlug)
      .single();

    if (mailroomError || !mailroomRecord) {
      console.error(
        `Error fetching mailroom by slug ${mailroomSlug} for failure log:`,
        mailroomError
      );
      return res
        .status(404)
        .json({ error: "Mailroom not found for failure logging." });
    }

    const { data: orgData, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("slug", orgSlug)
      .eq("id", mailroomRecord.organization_id)
      .single();

    if (orgError || !orgData) {
      console.error(
        `Error fetching organization by slug ${orgSlug} or mailroom mismatch for failure log:`,
        orgError
      );
      return res.status(404).json({
        error:
          "Organization not found or mailroom does not belong to it for failure logging.",
      });
    }

    const mailroomId = mailroomRecord.id;

    // Log the failed package to a special table for staff follow-up
    const { error: logError } = await supabaseAdmin
      .from("failed_package_logs")
      .insert({
        mailroom_id: mailroomId,
        staff_id: userId,
        first_name: failedPackage.First,
        last_name: failedPackage.Last,
        email: failedPackage.Email,
        resident_id: failedPackage.residentId,
        provider: failedPackage.provider,
        error_details:
          failedPackage.error ||
          req.body.error ||
          "Unknown error during package registration",
        resolved: false,
      });

    if (logError) {
      console.error("Error logging failed package:", logError);
      return res.status(500).json({ error: "Failed to log package error" });
    }

    // Notify admin about the failed package if enabled
    try {
      // Implementation for admin notification would go here
      // This could be a separate email or notification system
    } catch (notifyError) {
      console.error("Failed to notify admin:", notifyError);
      // Continue anyway since we've already logged the failure
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error handling failed package:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to process package failure";
    return res.status(500).json({ error: errorMessage });
  }
}
