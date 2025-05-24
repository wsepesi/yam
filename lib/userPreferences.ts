import { useEffect, useState } from 'react';

import { UserProfile } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export const DEFAULT_ORG = 'default';
export const DEFAULT_MAILROOM = 'default';

export const getUserOrg = async (userProfile: UserProfile | null): Promise<string> => {
  if (userProfile?.organization_id) {
    try {
      const { data, error } = await supabase.rpc('get_organization_slug_by_id', {
        org_id_param: userProfile.organization_id,
      });

      if (error || !data) {
        console.error('Error fetching organization slug via RPC:', error);
        return DEFAULT_ORG;
      }
      
      return data;
    } catch (error) {
      console.error('Exception fetching organization slug via RPC:', error);
      return DEFAULT_ORG;
    }
  }
  return DEFAULT_ORG;
};

export const getUserMailroom = async (userProfile: UserProfile | null): Promise<string> => {
  if (userProfile?.mailroom_id) {
    try {
      const { data, error } = await supabase.rpc('get_mailroom_slug_by_id', {
        mailroom_id_param: userProfile.mailroom_id,
      });
      
      if (error || !data) {
        console.error('Error fetching mailroom slug via RPC:', error);
        return DEFAULT_MAILROOM;
      }
      
      return data;
    } catch (error) {
      console.error('Exception fetching mailroom slug via RPC:', error);
      return DEFAULT_MAILROOM;
    }
  }
  return DEFAULT_MAILROOM;
};

export const getUserRedirectPath = async (userProfile: UserProfile | null = null): Promise<string> => {
  const org = await getUserOrg(userProfile);
  const mailroom = await getUserMailroom(userProfile);
  if (org === DEFAULT_ORG && mailroom === DEFAULT_MAILROOM) {
    throw new Error('No organization or mailroom found');
  }
  return `/${org}/${mailroom}`;
};

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

export const getMailroomDisplayName = async (mailroomSlug: string): Promise<string | null> => {
  const cacheKey = `mailroom-name-${mailroomSlug}`;
  const cachedValue = typeof window !== 'undefined' ? localStorage.getItem(cacheKey) : null;
  
  if (cachedValue) {
    return cachedValue;
  }

  try {
    const { data, error } = await supabase.rpc('get_mailroom_name_by_slug', {
      mailroom_slug_param: mailroomSlug.toLowerCase(),
    });
    
    if (error || !data) {
      console.error('Error fetching mailroom name via RPC:', error, data);
      return null;
    }
    
    const displayName = data.toUpperCase();
    if (typeof window !== 'undefined') {
      localStorage.setItem(cacheKey, displayName);
    }
    return displayName;
  } catch (error) {
    console.error('Exception fetching mailroom name via RPC:', error);
    return null;
  }
};

export const getOrgDisplayName = async (orgSlug: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase.rpc('get_organization_name_by_slug', {
      org_slug_param: orgSlug.toLowerCase(),
    });
    
    if (error || !data) {
      console.error('Error fetching organization name via RPC:', error);
      return null;
    }
    
    return data.toUpperCase();
  } catch (error) {
    console.error('Exception fetching organization name via RPC:', error);
    return null;
  }
};

 