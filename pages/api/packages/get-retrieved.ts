import type { NextApiRequest, NextApiResponse } from "next";

import getUserId from "@/lib/handleSession";
import { createAdminClient } from "@/lib/supabase";

interface ApiRetrievedPackage {
  id: string;
  residentName: string;
  residentEmail: string;
  residentStudentId: string;
  provider: string;
  createdAt: string;
  retrievedTimestamp: string;
  packageId?: string;
}

interface SupabaseRetrievedPackage {
  id: string;
  provider: string | null;
  created_at: string;
  retrieved_timestamp: string;
  package_id: string | null;
  residents: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    student_id: string | null;
  } | null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    { packages: ApiRetrievedPackage[]; totalCount?: number } | { error: string }
  >
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { mailroomId, limit: limitStr, offset: offsetStr } = req.query;

  if (!mailroomId || typeof mailroomId !== "string") {
    return res.status(400).json({ error: "Mailroom ID is required" });
  }

  const limit = limitStr ? parseInt(limitStr as string, 10) : 50;
  const offset = offsetStr ? parseInt(offsetStr as string, 10) : 0;

  if (isNaN(limit) || isNaN(offset) || limit <= 0 || offset < 0) {
    return res
      .status(400)
      .json({ error: "Invalid limit or offset parameters" });
  }

  try {
    const supabaseAdmin = createAdminClient();
    const authHeader = req.headers.authorization;
    const userId = await getUserId(supabaseAdmin, authHeader);

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // TODO: Add a check to ensure the authenticated user has rights to access this mailroomId

    // Fetch paginated data
    const query = supabaseAdmin
      .from("packages")
      .select(
        `
        id,
        provider,
        created_at,
        retrieved_timestamp,
        package_id,
        residents (
          first_name,
          last_name,
          email,
          student_id
        )
      `,
        { count: "exact" }
      )
      .eq("mailroom_id", mailroomId)
      .not("retrieved_timestamp", "is", null)
      .order("retrieved_timestamp", { ascending: false })
      .range(offset, offset + limit - 1);

    const {
      data: packagesData,
      error: packagesError,
      count,
    } = await query.returns<SupabaseRetrievedPackage[]>();

    if (packagesError) {
      console.error("Error fetching retrieved packages:", packagesError);
      return res
        .status(500)
        .json({ error: "Failed to fetch retrieved packages" });
    }

    if (!packagesData) {
      return res.status(200).json({ packages: [], totalCount: 0 });
    }

    const formattedPackages: ApiRetrievedPackage[] = packagesData.map(
      (pkg) => ({
        id: pkg.id,
        residentName: pkg.residents
          ? `${pkg.residents.first_name || ""} ${pkg.residents.last_name || ""}`.trim()
          : "N/A",
        residentEmail: pkg.residents?.email || "N/A",
        residentStudentId: pkg.residents?.student_id || "N/A",
        provider: pkg.provider || "N/A",
        createdAt: pkg.created_at,
        retrievedTimestamp: pkg.retrieved_timestamp,
        packageId: pkg.package_id || undefined,
      })
    );

    return res
      .status(200)
      .json({ packages: formattedPackages, totalCount: count ?? 0 });
  } catch (error) {
    console.error("Unexpected error in get-retrieved-packages:", error);
    if (error instanceof Error) {
      return res
        .status(500)
        .json({ error: `Internal server error: ${error.message}` });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}
