import type { NextApiRequest, NextApiResponse } from "next";

import getUserId from "@/lib/handleSession";
import { createAdminClient } from "@/lib/supabase";

interface UploadedResident {
  first_name?: string;
  last_name?: string;
  resident_id?: string;
  email?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    | {
        message: string;
        counts?: {
          total: number;
          new: number;
          unchanged: number;
          updated: number;
          removed: number;
        };
      }
    | { error: string }
  >
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    residents: newResidentsData,
    orgSlug,
    mailroomSlug,
  } = req.body as {
    residents: UploadedResident[];
    orgSlug: string;
    mailroomSlug: string;
  };

  if (
    !newResidentsData ||
    !Array.isArray(newResidentsData) ||
    newResidentsData.length === 0 ||
    !orgSlug ||
    !mailroomSlug
  ) {
    return res.status(400).json({
      error:
        "No resident data provided, or orgSlug/mailroomSlug missing, or data is invalid.",
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

    for (const resident of newResidentsData) {
      if (
        !resident.first_name ||
        !resident.last_name ||
        !resident.resident_id
      ) {
        return res.status(400).json({
          error: `Missing required fields for one or more residents. Ensure first_name, last_name, and resident_id are present. Problematic entry: ${JSON.stringify(resident)}`,
        });
      }
    }

    // Get existing ACTIVE residents
    const { data: existingResidents, error: fetchError } = await supabaseAdmin
      .from("residents")
      .select("id, email, student_id, first_name, last_name")
      .eq("mailroom_id", mailroomId)
      .eq("status", "ACTIVE");

    if (fetchError) {
      console.error("Error fetching existing residents:", fetchError);
      return res
        .status(500)
        .json({ error: "Failed to fetch existing residents." });
    }

    // Helper function to create a lookup key for residents
    const createLookupKey = (
      studentId: string,
      email: string | null | undefined
    ) => {
      return `${studentId}|${email || ""}`;
    };

    // Create a Map for O(1) lookups instead of O(N) searches
    const existingResidentsMap = new Map();
    existingResidents?.forEach((resident) => {
      const key = createLookupKey(resident.student_id, resident.email);
      existingResidentsMap.set(key, resident);
    });

    // Helper function to check if residents match (same email and student_id)
    const findMatchingResident = (newResident: UploadedResident) => {
      // Try exact match first (both student_id and email)
      const exactKey = createLookupKey(
        newResident.resident_id!,
        newResident.email
      );
      let match = existingResidentsMap.get(exactKey);
      if (match) return match;

      // If no email provided in new resident, try matching with empty email
      if (!newResident.email) {
        const noEmailKey = createLookupKey(newResident.resident_id!, "");
        match = existingResidentsMap.get(noEmailKey);
        if (match) return match;
      }

      // If new resident has email but no exact match, check if there's a resident
      // with same student_id but no email (they should not match per our logic)
      return null;
    };

    // Helper function to check if resident data has changed
    const hasDataChanged = (
      existing: { first_name: string; last_name: string; email: string | null },
      newResident: UploadedResident
    ) => {
      return (
        existing.first_name !== newResident.first_name ||
        existing.last_name !== newResident.last_name ||
        existing.email !== newResident.email
      );
    };

    // Separate residents into categories
    const residentsToUpdate = [];
    const residentsUnchanged = [];
    const residentsToInsert = [];
    const matchedExistingIds = new Set();

    for (const newResident of newResidentsData) {
      const existingMatch = findMatchingResident(newResident);

      if (existingMatch) {
        // Found a match - check if data has changed
        if (hasDataChanged(existingMatch, newResident)) {
          // Data has changed - needs update
          residentsToUpdate.push({
            id: existingMatch.id,
            first_name: newResident.first_name,
            last_name: newResident.last_name,
            email: newResident.email,
            updated_at: new Date().toISOString(),
          });
        } else {
          // Data is the same - just update timestamp to mark as processed
          residentsUnchanged.push({
            id: existingMatch.id,
            updated_at: new Date().toISOString(),
          });
        }
        matchedExistingIds.add(existingMatch.id);
      } else {
        // No match - this is a new resident
        residentsToInsert.push({
          mailroom_id: mailroomId,
          first_name: newResident.first_name,
          last_name: newResident.last_name,
          student_id: newResident.resident_id,
          email: newResident.email,
          added_by: userId,
          status: "ACTIVE",
        });
      }
    }

    // Update matching residents that have changed data
    for (const residentUpdate of residentsToUpdate) {
      const { error: updateError } = await supabaseAdmin
        .from("residents")
        .update({
          first_name: residentUpdate.first_name,
          last_name: residentUpdate.last_name,
          email: residentUpdate.email,
          updated_at: residentUpdate.updated_at,
        })
        .eq("id", residentUpdate.id);

      if (updateError) {
        console.error("Error updating existing resident:", updateError);
        return res
          .status(500)
          .json({ error: "Failed to update existing residents." });
      }
    }

    // Update timestamp for unchanged residents (to mark them as processed)
    for (const residentUnchanged of residentsUnchanged) {
      const { error: updateError } = await supabaseAdmin
        .from("residents")
        .update({
          updated_at: residentUnchanged.updated_at,
        })
        .eq("id", residentUnchanged.id);

      if (updateError) {
        console.error(
          "Error updating timestamp for unchanged resident:",
          updateError
        );
        return res
          .status(500)
          .json({ error: "Failed to update unchanged residents." });
      }
    }

    // Set non-matching existing residents to REMOVED_BULK
    const residentsToRemove =
      existingResidents?.filter(
        (resident) => !matchedExistingIds.has(resident.id)
      ) || [];

    if (residentsToRemove.length > 0) {
      const idsToRemove = residentsToRemove.map((r) => r.id);
      const { error: removeError } = await supabaseAdmin
        .from("residents")
        .update({
          status: "REMOVED_BULK",
          updated_at: new Date().toISOString(),
        })
        .in("id", idsToRemove);

      if (removeError) {
        console.error("Error removing old residents:", removeError);
        return res
          .status(500)
          .json({ error: "Failed to remove old residents." });
      }
    }

    // Insert new residents
    let insertedCount = 0;
    if (residentsToInsert.length > 0) {
      const { data: insertedData, error: insertError } = await supabaseAdmin
        .from("residents")
        .insert(residentsToInsert)
        .select();

      if (insertError) {
        console.error("Error inserting new residents:", insertError);
        return res.status(500).json({
          error: `Failed to insert new residents: ${insertError.message}`,
        });
      }

      insertedCount = insertedData?.length || 0;
    }

    const updatedCount = residentsToUpdate.length;
    const unchangedCount = residentsUnchanged.length;
    const totalProcessed = insertedCount + updatedCount + unchangedCount;

    return res.status(200).json({
      message: `${totalProcessed} residents processed: ${insertedCount} new, ${unchangedCount} unchanged, ${updatedCount} updated, ${residentsToRemove.length} removed.`,
      counts: {
        total: totalProcessed,
        new: insertedCount,
        unchanged: unchangedCount,
        updated: updatedCount,
        removed: residentsToRemove.length,
      },
    });
  } catch (error: unknown) {
    console.error("Error processing roster upload:", error);
    let errorMessage = "Internal server error";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return res.status(500).json({ error: errorMessage });
  }
}
