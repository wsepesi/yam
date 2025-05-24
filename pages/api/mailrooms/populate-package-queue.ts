import type { NextApiRequest, NextApiResponse } from "next";

import getUserId from "@/lib/handleSession";
import { createAdminClient } from "@/lib/supabase";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { mailroomId } = req.body;

  if (!mailroomId) {
    return res
      .status(400)
      .json({ error: "Missing required field: mailroomId" });
  }

  try {
    const supabaseAdmin = createAdminClient();
    // Authenticate the request - ensure the user is logged in.
    // Further role-based authorization could be added if needed, but for now,
    // if the user was able to trigger mailroom creation, they should be able to trigger this.
    const authHeader = req.headers.authorization;
    const callingUserId = await getUserId(supabaseAdmin, authHeader);

    if (!callingUserId) {
      // getUserId handles its own error responses for invalid/missing tokens.
      // This is a fallback or for cases where getUserId might return null without an HTTP error.
      return res
        .status(401)
        .json({ error: "User not authenticated or authorization failed." });
    }

    const packageNumbersToInsert = [];
    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(now.getDate() - 7);

    for (let i = 1; i <= 999; i++) {
      // Generate a random timestamp between oneWeekAgo and now
      const randomTimeOffset =
        Math.random() * (now.getTime() - oneWeekAgo.getTime());
      const randomDate = new Date(oneWeekAgo.getTime() + randomTimeOffset);

      packageNumbersToInsert.push({
        mailroom_id: mailroomId,
        package_number: i,
        is_available: true,
        last_used_at: randomDate.toISOString(),
      });
    }

    const { error: insertError } = await supabaseAdmin
      .from("package_ids")
      .insert(packageNumbersToInsert);

    if (insertError) {
      console.error("Supabase insert package_ids error:", insertError);
      return res.status(500).json({
        error: insertError.message || "Failed to populate package queue.",
      });
    }

    return res
      .status(201)
      .json({ message: "Package queue populated successfully." });
  } catch (error) {
    console.error("API error populating package queue:", error);
    if (error instanceof Error) {
      return res.status(500).json({ error: error.message });
    }
    return res
      .status(500)
      .json({ error: "An unexpected error occurred on the server." });
  }
}
