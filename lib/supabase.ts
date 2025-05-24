import { createClient } from '@supabase/supabase-js';

// Create a single supabase client for browser usage
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be provided');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Create a Supabase admin client for server-side operations (e.g., managing users/roles)
export const createAdminClient = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.log(serviceRoleKey)
    throw new Error('Supabase Service Role Key must be provided for admin operations');
  }
  return createClient(supabaseUrl, serviceRoleKey);
}; 