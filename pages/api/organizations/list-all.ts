import { NextApiRequest, NextApiResponse } from 'next';

import { createAdminClient } from '@/lib/supabase';
import getUserId from '@/lib/handleSession';

interface OrganizationListItem {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  status: string; // e.g., 'ACTIVE', 'PENDING_SETUP', 'DISABLED'
  totalMailrooms: number;
  totalUsers: number; // Users specifically in that org
  // Add other relevant summary fields
}

// Type for the raw organization data from Supabase with counts
interface SupabaseOrgWithCounts {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  status: string | null;
  mailrooms: Array<{ count: number }>;
  profiles: Array<{ count: number }>;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseAdmin = createAdminClient();
  try {
    const authHeader = req.headers.authorization;
    const userId = await getUserId(supabaseAdmin, authHeader);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileError || !userProfile) {
      return res.status(400).json({ error: 'Could not fetch user profile' });
    }

    if (userProfile.role !== 'super-admin') {
      return res.status(403).json({ error: 'User does not have permission to list all organizations.' });
    }

    // Actual query to fetch all organizations and some aggregated data
    // This is a complex query and might need optimization or to be broken down
    // For now, a simplified version:
    const { data: organizations, error: orgsError } = await supabaseAdmin
      .from('organizations')
      .select(`
        id,
        name,
        slug,
        created_at,
        status,
        mailrooms(count),
        profiles(count)
      `)
      .order('created_at', { ascending: false });

    if (orgsError) {
      console.error('Error fetching organizations:', orgsError);
      return res.status(500).json({ error: orgsError.message || 'Failed to fetch organizations.' });
    }

    const formattedOrganizations: OrganizationListItem[] = organizations?.map((org: SupabaseOrgWithCounts) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      createdAt: org.created_at,
      status: org.status || 'N/A',
      totalMailrooms: org.mailrooms[0]?.count || 0, // Supabase returns count as an array [{ count: N }]
      totalUsers: org.profiles[0]?.count || 0,    // Same for profiles count
    })) || [];

    res.setHeader('Cache-Control', 'private, s-maxage=60, stale-while-revalidate=120');
    return res.status(200).json(formattedOrganizations);

  } catch (error) {
    console.error('Error in list-all organizations:', error);
    if (error instanceof Error) {
        return res.status(500).json({ error: error.message });
    }
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
} 