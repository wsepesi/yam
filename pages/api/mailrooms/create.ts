import { NextApiRequest, NextApiResponse } from 'next';

import { createAdminClient } from '@/lib/supabase'; // Corrected Supabase client
import getUserId from '@/lib/handleSession'; // For getting user ID

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { name, slug, organizationId } = req.body;

  if (!name || !slug || !organizationId) {
    return res.status(400).json({ error: 'Missing required fields: name, slug, or organizationId' });
  }

  try {
    const supabaseAdmin = createAdminClient();
    const authHeader = req.headers.authorization;
    const userId = await getUserId(supabaseAdmin, authHeader);

    if (!userId) {
      // getUserId handles the response for errors like missing/invalid token
      // but as a fallback or if it were to return null on non-erroring non-authentication:
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Fetch current user's profile to check permissions
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles') // Assuming 'profiles' is your user profiles table
      .select('role, organization_id') // Assuming these columns exist
      .eq('id', userId)
      .single();

    if (profileError || !userProfile) {
      console.error('Error fetching user profile:', profileError);
      return res.status(400).json({ error: 'Could not fetch user profile to verify permissions.' });
    }

    // Authorization check:
    // Users must be 'admin' or 'manager' to create mailrooms.
    // If 'manager', they must belong to the organization they are creating a mailroom for.
    const canCreateMailroom = userProfile.role === 'admin' || 
                             (userProfile.role === 'manager' && userProfile.organization_id === organizationId);

    if (!canCreateMailroom) {
      return res.status(403).json({ error: 'User does not have permission to create a mailroom for this organization.' });
    }

    // Database operation to create the mailroom
    const { data: newMailroom, error: createError } = await supabaseAdmin
      .from('mailrooms') // Replace 'mailrooms' with your actual table name
      .insert([
        {
          name: name as string,
          slug: slug as string,
          organization_id: organizationId as string, // Ensure your DB column name matches
          created_by: userId, // Link the mailroom to the user who created it
          // status: 'ACTIVE', // Example: set a default status if applicable
        },
      ])
      .select() // Select all columns of the newly created row
      .single(); // Expecting a single row to be returned

    if (createError) {
      console.error('Supabase create mailroom error:', createError);
      return res.status(500).json({ error: createError.message || 'Failed to create mailroom in database.' });
    }

    if (!newMailroom) {
      // This case should ideally not be reached if insert was successful and .single() was used
      return res.status(500).json({ error: 'Mailroom created but no data was returned from database.' });
    }

    // Successfully created the mailroom
    return res.status(201).json(newMailroom); // Return the created mailroom object (includes its ID)

  } catch (error) {
    console.error('API error creating mailroom:', error);
    // Check if error is an instance of Error to safely access message property
    if (error instanceof Error) {
        return res.status(500).json({ error: error.message });
    }
    // Fallback for other types of errors
    return res.status(500).json({ error: 'An unexpected error occurred on the server.' });
  }
} 