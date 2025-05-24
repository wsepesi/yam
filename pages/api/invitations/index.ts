import type { NextApiRequest, NextApiResponse } from "next";

import getUserId from "@/lib/handleSession";
import { createAdminClient } from "@/lib/supabase";

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

    // Get required parameters from request query
    const { mailroomId, role } = req.query;

    if (!mailroomId) {
      return res
        .status(400)
        .json({ error: "Missing required mailroomId parameter" });
    }

    // Fetch current user's profile to check permissions
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role, organization_id, mailroom_id")
      .eq("id", userId)
      .single();

    if (profileError || !userProfile) {
      return res.status(400).json({ error: "Could not fetch user profile" });
    }

    // Verify user has manager or admin role
    if (
      userProfile.role !== "super-admin" &&
      userProfile.role !== "admin" &&
      userProfile.role !== "manager"
    ) {
      return res.status(403).json({
        error: "Only super-admins, admins, and managers can view invitations",
      });
    }

    // Fetch mailroom to get organization ID
    const { data: mailroom, error: mailroomError } = await supabaseAdmin
      .from("mailrooms")
      .select("organization_id")
      .eq("id", mailroomId)
      .single();

    if (mailroomError || !mailroom) {
      return res.status(400).json({ error: "Invalid mailroom" });
    }

    // For managers, ensure they are querying invitations for their own organization
    if (
      userProfile.role === "manager" &&
      userProfile.organization_id !== mailroom.organization_id
    ) {
      return res.status(403).json({
        error: "Managers can only view invitations for their own organization",
      });
    }
    // Admins and Super-Admins can view any, so no specific org check needed for them here if mailroomId is provided
    // If mailroomId is NOT provided, Admins/Super-Admins might list all invitations system-wide (not implemented here)

    // Set up the query for pending invitations
    let query = supabaseAdmin
      .from("invitations")
      .select("id, email, role, created_at, expires_at, status")
      .eq("mailroom_id", mailroomId)
      .gte("expires_at", new Date().toISOString());

    // Filter by role if provided
    if (role) {
      query = query.eq("role", role);
    }

    // Order by creation date, newest first
    query = query.order("created_at", { ascending: false });

    // Execute the query
    const { data: invitations, error: invitationsError } = await query;
    console.log("invitations", invitations);

    if (invitationsError) {
      console.error("Error fetching invitations:", invitationsError);
      return res.status(500).json({ error: "Failed to fetch invitations" });
    }

    // Format the invitations data for the response
    const formattedInvitations = invitations.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      createdAt: invitation.created_at,
      expiresAt: invitation.expires_at,
      status: invitation.status,
    }));

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=60"
    );
    res.setHeader("Vary", "Authorization");
    return res.status(200).json(formattedInvitations);
  } catch (error) {
    console.error("Error processing request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
