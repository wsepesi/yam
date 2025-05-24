import type { NextApiRequest, NextApiResponse } from "next";

import getUserId from "@/lib/handleSession";
import { createAdminClient } from "@/lib/supabase";

// Define the expected structure of a resident to be added
interface SingleResident {
  first_name: string;
  last_name: string;
  resident_id: string; // This corresponds to student_id in the database
  email?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ message: string } | { error: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { resident, orgSlug, mailroomSlug } = req.body as {
    resident: SingleResident;
    orgSlug: string;
    mailroomSlug: string;
  };

  if (!resident || !orgSlug || !mailroomSlug) {
    return res.status(400).json({
      error: "Missing required data: resident, orgSlug, or mailroomSlug.",
    });
  }

  // Validate required fields
  if (!resident.first_name || !resident.last_name || !resident.resident_id) {
    return res.status(400).json({
      error:
        "Missing required resident fields: first_name, last_name, or resident_id.",
    });
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

    // Fetch mailroom_id based on orgSlug and mailroomSlug
    const { data: mailroomRecord, error: mailroomFetchError } =
      await supabaseAdmin
        .from("mailrooms")
        .select("id, organization_id")
        .eq("slug", mailroomSlug)
        .single();

    if (mailroomFetchError || !mailroomRecord) {
      console.error(
        `Error fetching mailroom by slug ${mailroomSlug}:`,
        mailroomFetchError
      );
      return res.status(404).json({ error: "Mailroom not found." });
    }

    const { data: orgData, error: orgFetchError } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("slug", orgSlug)
      .eq("id", mailroomRecord.organization_id)
      .single();

    if (orgFetchError || !orgData) {
      console.error(
        `Error fetching organization by slug ${orgSlug} or mailroom mismatch:`,
        orgFetchError
      );
      return res.status(404).json({
        error: "Organization not found or mailroom does not belong to it.",
      });
    }

    const mailroomId = mailroomRecord.id;

    // Check if a resident with this ID already exists in active state
    const { data: existingResident, error: checkError } = await supabaseAdmin
      .from("residents")
      .select("id, status")
      .eq("mailroom_id", mailroomId)
      .eq("student_id", resident.resident_id)
      .eq("status", "ACTIVE")
      .maybeSingle();

    if (checkError) {
      console.error("Error checking for existing resident:", checkError);
      return res
        .status(500)
        .json({ error: "Failed to check for existing resident." });
    }

    if (existingResident) {
      return res.status(400).json({
        error: `A resident with ID ${resident.resident_id} is already active in this mailroom.`,
      });
    }

    // Insert the new resident
    const { error: insertError } = await supabaseAdmin
      .from("residents")
      .insert([
        {
          mailroom_id: mailroomId,
          first_name: resident.first_name,
          last_name: resident.last_name,
          student_id: resident.resident_id, // Map resident_id to student_id in DB
          email: resident.email,
          added_by: userId,
          status: "ACTIVE", // New resident is active by default
        },
      ])
      .select();

    if (insertError) {
      console.error("Error inserting new resident:", insertError);
      return res
        .status(500)
        .json({ error: `Failed to add resident: ${insertError.message}` });
    }

    return res.status(200).json({
      message: `Resident ${resident.first_name} ${resident.last_name} successfully added.`,
    });
  } catch (error: unknown) {
    console.error("Error adding resident:", error);
    let errorMessage = "Internal server error";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return res.status(500).json({ error: errorMessage });
  }
}
