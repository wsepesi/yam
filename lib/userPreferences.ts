import { useEffect, useState } from 'react';

import { UserProfile } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

// Constants for default preferences
export const DEFAULT_ORG = 'default';
export const DEFAULT_MAILROOM = 'default';

// Function to get user's org from their profile or use default
export const getUserOrg = async (userProfile: UserProfile | null): Promise<string> => {
  console.log('getUserOrg: userProfile:', userProfile);
  if (userProfile?.organization_id) {
    try {
      // Query the database using an RPC call to get the organization slug
      const { data, error } = await supabase.rpc('get_organization_slug_by_id', {
        org_id_param: userProfile.organization_id,
      });

      console.log('getUserOrg: RPC response:', { data, error });

      if (error || !data) { // RPC returns data directly, not an object like { slug: ... }
        console.error('Error fetching organization slug via RPC:', error);
        return DEFAULT_ORG;
      }
      
      return data; // data here is the slug string
    } catch (error) {
      console.error('Exception fetching organization slug via RPC:', error);
      return DEFAULT_ORG;
    }
  }
  return DEFAULT_ORG;
};

// Function to get user's mailroom from their profile or use default
export const getUserMailroom = async (userProfile: UserProfile | null): Promise<string> => {
  if (userProfile?.mailroom_id) {
    try {
      // Query the database using an RPC call to get the mailroom slug
      const { data, error } = await supabase.rpc('get_mailroom_slug_by_id', {
        mailroom_id_param: userProfile.mailroom_id,
      });
      
      if (error || !data) { // RPC returns data directly
        console.error('Error fetching mailroom slug via RPC:', error);
        return DEFAULT_MAILROOM;
      }
      
      return data; // data here is the slug string
    } catch (error) {
      console.error('Exception fetching mailroom slug via RPC:', error);
      return DEFAULT_MAILROOM;
    }
  }
  return DEFAULT_MAILROOM;
};

// Function to get the redirect path for a user
export const getUserRedirectPath = async (userProfile: UserProfile | null = null): Promise<string> => {
  const org = await getUserOrg(userProfile);
  const mailroom = await getUserMailroom(userProfile);
  if (org === DEFAULT_ORG && mailroom === DEFAULT_MAILROOM) {
    throw new Error('No organization or mailroom found');
  }
  return `/${org}/${mailroom}`;
};

// Custom React hook to get the redirect path
export const useRedirectPath = (): { path: string, isLoading: boolean } => {
  const { userProfile } = useAuth();
  const [path, setPath] = useState<string>(`/${DEFAULT_ORG}/${DEFAULT_MAILROOM}`);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchPath = async () => {
      try {
        setIsLoading(true);
        const redirectPath = await getUserRedirectPath(userProfile);
        setPath(redirectPath);
      } catch (error) {
        console.error('Error fetching redirect path:', error);
        // Fall back to default path construction
        const defaultOrg = await getUserOrg(userProfile).catch(() => DEFAULT_ORG);
        setPath(`/${defaultOrg}/${DEFAULT_MAILROOM}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPath();
  }, [userProfile]);

  return { path, isLoading };
};

// For persistent caching across page refreshes
export const getMailroomDisplayName = async (mailroomSlug: string): Promise<string> => {
  // Check localStorage first
  const cacheKey = `mailroom-name-${mailroomSlug}`;
  const cachedValue = typeof window !== 'undefined' ? localStorage.getItem(cacheKey) : null;
  
  if (cachedValue) {
    return cachedValue;
  }

  try {
    // Query the database using RPC to get the mailroom name from the slug
    const { data, error } = await supabase.rpc('get_mailroom_name_by_slug', {
      mailroom_slug_param: mailroomSlug.toLowerCase(),
    });
    
    if (error || !data) { // data is the name string directly
      console.error('Error fetching mailroom name via RPC:', error, data);
      // Fall back to hardcoded values (or remove if not desired)
      switch (mailroomSlug.toLowerCase()) {
        // case 'cobeen':
        //   return 'COBEEN HALL';
        default:
          return 'Unknown Mailroom';
      }
    }
    
    const displayName = data.toUpperCase(); // Assuming 'data' is the name string
    // Store in localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem(cacheKey, displayName);
    }
    return displayName;
  } catch (error) {
    console.error('Exception fetching mailroom name via RPC:', error);
    return 'Unknown Mailroom';
  }
};

export const getOrgDisplayName = async (orgSlug: string): Promise<string> => {
  try {
    // Query the database using RPC to get the organization name from the slug
    const { data, error } = await supabase.rpc('get_organization_name_by_slug', {
      org_slug_param: orgSlug.toLowerCase(),
    });
    
    if (error || !data) { // data is the name string directly
      console.error('Error fetching organization name via RPC:', error);
      // Fall back to hardcoded values (or remove if not desired)
      switch (orgSlug.toLowerCase()) {
        case 'marquette':
          return 'MARQUETTE UNIVERSITY';
        default:
          return 'Unknown Organization';
      }
    }
    
    return data.toUpperCase(); // Assuming 'data' is the name string
  } catch (error) {
    console.error('Exception fetching organization name via RPC:', error);
    return 'Unknown Organization';
  }
};

// Sync versions of the display functions for cases where async cannot be used
export const getMailroomDisplayNameSync = (mailroomSlug: string): string => { // TODO: resolve this

  switch (mailroomSlug.toLowerCase()) {
    case 'demo':
      return 'Demo Mailroom';
    case 'cobeen':
        return 'Cobeen Hall'
    default:
      return 'Unknown Mailroom';
  }
};

export const getOrgDisplayNameSync = (orgSlug: string): string => {
  switch (orgSlug.toLowerCase()) {
    case 'marquette':
      return 'MARQUETTE UNIVERSITY';
    default:
      return 'Unknown Organization';
  }
}; 