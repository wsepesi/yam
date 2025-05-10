import { NextApiRequest, NextApiResponse } from 'next';

import { createAdminClient } from '@/lib/supabase';
import getUserId from '@/lib/handleSession'; // Adjusted to getUserId, similar to get-residents.ts

// Corresponds to PackageInfo on the frontend
interface ApiPackage {
  id: string; // packages.id
  residentName: string; // residents.first_name + residents.last_name
  residentEmail: string; // residents.email
  residentStudentId: string; // residents.student_id
  provider: string; // packages.provider
  createdAt: string; // Changed from ingestedAt - maps to packages.created_at
  packageId?: string; // packages.package_id - this is the 1-999 number on the package
}

// Type for the raw Supabase package data with nested resident
interface SupabasePackage {
  id: string;
  provider: string | null;
  created_at: string; // Changed from ingested_at
  package_id: string | null;
  residents: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    student_id: string | null;
  } | null; // Resident could be null if not found or not joined properly, though query implies it should exist
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ packages: ApiPackage[] } | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mailroomId } = req.query;

  if (!mailroomId || typeof mailroomId !== 'string') {
    return res.status(400).json({ error: 'Mailroom ID is required' });
  }

  try {
    const supabaseAdmin = createAdminClient();
    const authHeader = req.headers.authorization;
    
    const userId = await getUserId(supabaseAdmin, authHeader);

    if (!userId) {
      // getUserId itself doesn't return an error object in the success path
      // It returns null if auth fails or user ID isn't found.
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // TODO: Add a check to ensure the authenticated user has rights to access this mailroomId
    // This might involve checking against a user_mailrooms mapping or profile.mailroom_id

    const { data: packagesData, error: packagesError } = await supabaseAdmin
      .from('packages')
      .select(`
        id,
        provider,
        created_at,
        package_id,
        residents (
          first_name,
          last_name,
          email,
          student_id
        )
      `)
      .eq('mailroom_id', mailroomId)
      .is('retrieved_timestamp', null) // Corrected: was 'retrieved_at', now using 'retrieved_timestamp' as per user feedback for the pickup status column
      .order('created_at', { ascending: false }) // Changed from ingested_at
      .returns<SupabasePackage[]>(); // Specify the return type for type safety

    if (packagesError) {
      console.error('Error fetching current packages:', packagesError);
      return res.status(500).json({ error: 'Failed to fetch current packages' });
    }

    if (!packagesData) {
      return res.status(200).json({ packages: [] });
    }

    const formattedPackages: ApiPackage[] = packagesData.map((pkg) => ({
      id: pkg.id,
      residentName: pkg.residents ? `${pkg.residents.first_name || ''} ${pkg.residents.last_name || ''}`.trim() : 'N/A',
      residentEmail: pkg.residents?.email || 'N/A', // Optional chaining for safety
      residentStudentId: pkg.residents?.student_id || 'N/A', // Optional chaining
      provider: pkg.provider || 'N/A',
      createdAt: pkg.created_at, // Changed from ingestedAt
      packageId: pkg.package_id || undefined, // Ensure undefined if null/empty
    }));

    return res.status(200).json({ packages: formattedPackages });

  } catch (error) {
    console.error('Unexpected error in get-current-packages:', error);
    // It's good practice to check error type here as well if doing specific handling
    if (error instanceof Error) {
        return res.status(500).json({ error: `Internal server error: ${error.message}` });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
} 