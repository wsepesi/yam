import type { NextApiRequest, NextApiResponse } from "next";

import getUserId from "@/lib/handleSession";
import { createAdminClient, supabase } from "@/lib/supabase";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabaseAdmin = createAdminClient();
    const authHeader = req.headers.authorization;
    const userId = await getUserId(supabaseAdmin, authHeader);

    if (!userId) {
      return res
        .status(401)
        .json({ error: "Unauthorized: Invalid or missing user session." });
    }

    // Get required parameters from request query
    const { mailroomId } = req.query;

    if (!mailroomId) {
      return res
        .status(400)
        .json({ error: "Missing required mailroomId parameter" });
    }

    // Fetch current user's profile to check permissions
    const { data: userProfile, error: profileError } = await supabase
      .from("profiles")
      .select("role, organization_id, mailroom_id")
      .eq("id", userId)
      .single();

    if (profileError || !userProfile) {
      return res.status(400).json({ error: "Could not fetch user profile" });
    }

    // Verify user has manager or admin role
    if (userProfile.role !== "manager" && userProfile.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Only managers and admins can view managers" });
    }

    // Fetch mailroom to get organization ID
    const { data: mailroom, error: mailroomError } = await supabase
      .from("mailrooms")
      .select("organization_id")
      .eq("id", mailroomId)
      .single();

    if (mailroomError || !mailroom) {
      return res.status(400).json({ error: "Invalid mailroom" });
    }

    // Verify user belongs to the same organization as the mailroom
    if (
      userProfile.role !== "admin" &&
      userProfile.organization_id !== mailroom.organization_id
    ) {
      return res
        .status(403)
        .json({ error: "You can only view managers in your organization" });
    }

    // Fetch managers for the specified mailroom
    const { data: managers, error: managersError } = await supabase
      .from("profiles")
      .select("id, role, created_at")
      .eq("mailroom_id", mailroomId)
      .eq("role", "manager")
      .order("created_at", { ascending: false });

    if (managersError) {
      console.error("Error fetching managers:", managersError);
      return res.status(500).json({ error: "Failed to fetch managers" });
    }

    // Fetch emails separately since they're in auth.users table
    const managerIds = managers.map((manager) => manager.id);
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, email")
      .in("id", managerIds);

    if (usersError) {
      console.error("Error fetching user emails:", usersError);
      return res.status(500).json({ error: "Failed to fetch user details" });
    }

    // Create a map of user IDs to emails
    const userEmailMap = (users || []).reduce(
      (map, user) => {
        map[user.id] = user.email;
        return map;
      },
      {} as Record<string, string>
    );

    // Format the managers data for the response
    const formattedManagers = managers.map((manager) => ({
      id: manager.id,
      email: userEmailMap[manager.id] || "Unknown",
      role: manager.role,
      createdAt: manager.created_at,
    }));

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=86400, stale-while-revalidate=3600"
    );
    return res.status(200).json(formattedManagers);
  } catch (error) {
    console.error("Error processing request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
