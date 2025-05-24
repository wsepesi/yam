import type { SupabaseClient } from "@supabase/supabase-js";

const getUserId = async (
  supabaseAdmin: SupabaseClient,
  authHeader: string | undefined
): Promise<string> => {
  if (!authHeader?.startsWith("Bearer ")) {
    console.log(authHeader);
    throw new Error("Unauthorized: Missing or invalid token");
  }
  const token = authHeader.split(" ")[1];

  const { data: userData, error: authError } =
    await supabaseAdmin.auth.getUser(token);

  if (authError || !userData.user) {
    console.error("Auth error:", authError);
    throw new Error("Unauthorized: Invalid token");
  }

  return userData.user.id;
};

export default getUserId;
