import type { NextApiRequest, NextApiResponse } from "next";

import getUserId from "@/lib/handleSession";
import { createAdminClient } from "@/lib/supabase";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ message: string } | { error: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { residentId } = req.body as { residentId: string };

  if (!residentId) {
    return res
      .status(400)
      .json({ error: "Missing required data: residentId." });
  }

  try {
    const supabaseAdmin = createAdminClient();
    const authHeader = req.headers.authorization;
    const userId = await getUserId(supabaseAdmin, authHeader);

    if (!userId) {
      return res.status(401).json({
        error:
          "User not authenticated or staff ID cannot be determined for logging.",
      });
    }

    // Fetch the resident to get their first and last name for the success message
    const { data: resident, error: fetchError } = await supabaseAdmin
      .from("residents")
      .select("first_name, last_name")
      .eq("id", residentId)
      .single();

    if (fetchError || !resident) {
      console.error(`Error fetching resident by ID ${residentId}:`, fetchError);
      return res.status(404).json({ error: "Resident not found." });
    }

    // Update the resident's status to 'REMOVED_INDIVIDUAL'
    const { error: updateError } = await supabaseAdmin
      .from("residents")
      .update({
        status: "REMOVED_INDIVIDUAL",
        updated_at: new Date().toISOString(), // Log when the resident was removed
      })
      .eq("id", residentId);

    if (updateError) {
      console.error("Error updating resident status:", updateError);
      return res
        .status(500)
        .json({ error: `Failed to remove resident: ${updateError.message}` });
    }

    return res.status(200).json({
      message: `Resident ${resident.first_name} ${resident.last_name} successfully removed.`,
    });
  } catch (error: unknown) {
    console.error("Error removing resident:", error);
    let errorMessage = "Internal server error";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return res.status(500).json({ error: errorMessage });
  }
}
