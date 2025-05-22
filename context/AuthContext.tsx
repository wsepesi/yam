import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

import Layout from '@/components/Layout';
import UserTabPageSkeleton from '@/components/UserTabPageSkeleton';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/router';

// Role type - should match the database
export type UserRole = 'user' | 'manager' | 'admin' | 'super-admin';

const TIMEOUT_MS = 2000;

// Define the shape of the user profiles in your database
export interface UserProfile {
  id: string;
  role: UserRole;
  status: 'INVITED' | 'ACTIVE' | 'REMOVED';
  organization_id: string; // UUID of the organization
  mailroom_id: string;     // UUID of the mailroom
  // organization_slug and mailroom_slug are NOT directly on UserProfile
  // They are fetched separately if needed, e.g. by getUserOrg/getUserMailroom
}

// Auth context state
type AuthState = {
  session: Session | null;
  user: User | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{
    error: Error | null;
    success: boolean;
    userProfile?: UserProfile | null;
  }>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<{
    error: Error | null;
    success: boolean;
  }>;
  resetPassword: (email: string) => Promise<{
    error: Error | null;
    success: boolean;
  }>;
  refreshUserProfile: () => Promise<UserProfile | null>;
};

// Create the context with a default value
const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  userProfile: null,
  isLoading: true,
  isAuthenticated: false,
  signIn: async () => ({ error: null, success: false, userProfile: null }),
  signOut: async () => {},
  signUp: async () => ({ error: null, success: false }),
  resetPassword: async () => ({ error: null, success: false }),
  refreshUserProfile: async () => null,
});

// Auth provider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Fetch the user's profile data containing role information
  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        return null;
      }

      return data as UserProfile;
    } catch (error) {
      return null;
    }
  };

  // Function to explicitly refresh the user profile
  const refreshUserProfile = async () => {
    if (user?.id) {
      setIsLoading(true); // Indicate loading during refresh
      const profile = await fetchUserProfile(user.id);
      setUserProfile(profile);
      setIsLoading(false);
      return profile; // Optionally return the profile
    }
    return null;
  };

  // Setup the auth state listener
  useEffect(() => {
    // Set initial state while we're checking auth
    setIsLoading(true);

    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      // Fetch profile for the user if session exists
      if (session?.user) {
        fetchUserProfile(session.user.id).then(profile => {
          setUserProfile(profile);
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession: Session | null) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        // Handle different auth events
        if (event === 'SIGNED_IN' && currentSession?.user) {
          const profile = await fetchUserProfile(currentSession.user.id);
          setUserProfile(profile);
        } else if (event === 'SIGNED_OUT') {
          setUserProfile(null);
        } else if (event === 'USER_UPDATED' && currentSession?.user) {
          // const profile = await fetchUserProfile(currentSession.user.id);
          // setUserProfile(profile);
          // Instead of auto-fetching, we now expect an explicit call to refreshUserProfile
          // if the profile data needs to be updated in the context after a user update.
          // This helps avoid race conditions and potential deadlocks as per Supabase guidance.
        }

        setIsLoading(false);
      }
    );

    // Cleanup the subscription on unmount
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Auth methods
  const signIn = async (email: string, password: string): Promise<{
    error: Error | null;
    success: boolean;
    userProfile?: UserProfile | null;
  }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error, success: false, userProfile: null };
      }

      // Fetch the profile on successful sign in
      let fetchedProfile: UserProfile | null = null;
      if (data.user) {
        fetchedProfile = await fetchUserProfile(data.user.id);

        // Check if the user's status is 'REMOVED'
        if (fetchedProfile && fetchedProfile.status === 'REMOVED') {
          await supabase.auth.signOut(); // Sign the user out
          setSession(null);
          setUser(null);
          setUserProfile(null);
          return { error: new Error('Your access has been revoked.'), success: false, userProfile: null };
        }

        // Set the profile state within the context
        setUserProfile(fetchedProfile);
      }

      // Return the fetched profile along with success status
      return { error: null, success: true, userProfile: fetchedProfile };
    } catch (error) {
      return { error: error as Error, success: false, userProfile: null };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/login');
    } catch (error) {
      // Error signing out
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      // Sign up with Supabase Auth
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        return { error, success: false };
      }

      // In a real implementation, you might want to create an initial profile
      // with a default role (e.g., 'user') after sign up

      return { error: null, success: true };
    } catch (error) {
      return { error: error as Error, success: false };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        return { error, success: false };
      }

      return { error: null, success: true };
    } catch (error) {
      return { error: error as Error, success: false };
    }
  };

  const value = {
    session,
    user,
    userProfile,
    isLoading,
    isAuthenticated: !!session,
    signIn,
    signOut,
    signUp,
    resetPassword,
    refreshUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Higher-order component to protect routes
export const withAuth = <P extends object>(
  Component: React.ComponentType<P>,
  requiredRole?: UserRole
) => {
  const WithAuthComponent = (props: P): React.ReactElement | null => {
    const { userProfile, isLoading, isAuthenticated } = useAuth();
    const router = useRouter();
    const [loadingTimedOut, setLoadingTimedOut] = useState(false);
    const [isAccessVerified, setIsAccessVerified] = useState(false); // New state for async access check
    const [isCheckingAccess, setIsCheckingAccess] = useState(true); // New state to track async check
    
    // Add cache for auth validations to prevent unnecessary checks 
    const verifiedPathsRef = useRef<Set<string>>(new Set());

    const { org: orgSlugFromQuery, mailroom: mailroomSlugFromQuery } = router.query;
    const currentOrgSlug = Array.isArray(orgSlugFromQuery) ? orgSlugFromQuery[0] : orgSlugFromQuery;
    const currentMailroomSlug = Array.isArray(mailroomSlugFromQuery) ? mailroomSlugFromQuery[0] : mailroomSlugFromQuery;

    useEffect(() => {
      let timerId: NodeJS.Timeout | undefined;
      if (isLoading || isCheckingAccess) { // Consider both loading states
        timerId = setTimeout(() => {
          if (isLoading || isCheckingAccess) {
            setLoadingTimedOut(true);
          }
        }, TIMEOUT_MS);
      } else {
        setLoadingTimedOut(false);
      }

      return () => {
        if (timerId) {
          clearTimeout(timerId);
        }
      };
    }, [isLoading, isCheckingAccess]);

    useEffect(() => {
      const verifyAccess = async () => {
        if (loadingTimedOut && (isLoading || isCheckingAccess)) {
          router.push(`/login?callbackUrl=${encodeURIComponent(router.asPath)}&reason=loading_timeout`);
          return;
        }

        if (!isLoading && !isAuthenticated) {
          router.push(`/login?callbackUrl=${encodeURIComponent(router.asPath)}`);
          return;
        }

        if (!isLoading && isAuthenticated && userProfile) {
          // Check if we've already verified this path
          const currentPath = `${currentOrgSlug}/${currentMailroomSlug}`;
          if (verifiedPathsRef.current.has(currentPath)) {
            setIsAccessVerified(true);
            setIsCheckingAccess(false);
            return;
          }

          setIsCheckingAccess(true); // Start access check

          // Role Check (remains the same)
          if (
            requiredRole &&
            (userProfile.role !== 'admin' && userProfile.role !== 'super-admin') &&
            !(
              userProfile.role === requiredRole ||
              (requiredRole === 'user' && userProfile.role === 'manager')
            )
          ) {
            router.push('/unauthorized?reason=role_mismatch');
            setIsCheckingAccess(false);
            return;
          }

          // Slug-based access check for non-admins
          if (userProfile.role !== 'admin' && userProfile.role !== 'super-admin') {
            if (currentOrgSlug && currentMailroomSlug) {
              // IMPORTANT: Use functions similar to your lib/userPreferences to get actual assigned slugs
              // These might be direct DB calls or RPCs if userPreferences.ts is only for display defaults.
              // For this example, I'll simulate fetching them. Replace with your actual logic.
              let assignedOrgSlug: string | undefined;
              let assignedMailroomSlug: string | undefined;

              try {
                // SIMULATING direct Supabase query for actual slugs based on IDs from profile
                const { data: orgProfileData, error: orgProfileError } = await supabase
                  .from('organizations').select('slug').eq('id', userProfile.organization_id).single();
                if (orgProfileError) throw orgProfileError;
                assignedOrgSlug = orgProfileData?.slug;

                const { data: mailroomProfileData, error: mailroomProfileError } = await supabase
                  .from('mailrooms').select('slug').eq('id', userProfile.mailroom_id).single();
                if (mailroomProfileError) throw mailroomProfileError;
                assignedMailroomSlug = mailroomProfileData?.slug;

              } catch (e) {
                router.push('/unauthorized?reason=profile_data_fetch_error');
                setIsCheckingAccess(false);
                return;
              }
              
              if (assignedOrgSlug !== currentOrgSlug || assignedMailroomSlug !== currentMailroomSlug) {
                router.push('/unauthorized?reason=mailroom_mismatch');
                setIsCheckingAccess(false);
                return;
              }
              
              // Cache successful validation
              verifiedPathsRef.current.add(currentPath);
            } else if (currentOrgSlug || currentMailroomSlug) {
              router.push('/unauthorized?reason=incomplete_path');
              setIsCheckingAccess(false);
              return;
            }
          }
          setIsAccessVerified(true); // Access verified (either admin or passed slug check)
          setIsCheckingAccess(false);
        } else if (!isLoading && !userProfile && isAuthenticated) {
            // This case means user is authenticated but profile hasn't loaded yet, could be an issue
            // Decide if to redirect or wait; current logic relies on isLoading to cover this.
            // If it persists, it might need a specific redirect or error state.
            setIsCheckingAccess(false); // Not checking if no profile
        }
      };

      verifyAccess();
    }, [isLoading, isAuthenticated, userProfile, router, requiredRole, currentOrgSlug, currentMailroomSlug, loadingTimedOut]);

    const effectivelyLoading = isLoading || isCheckingAccess || (isAuthenticated && !userProfile);

    if (effectivelyLoading) {
      if (loadingTimedOut && (isLoading || isCheckingAccess)) {
        return null; // Redirect handled by useEffect
      }
      return (
        <Layout title="Loading..." glassy={false}>
          <UserTabPageSkeleton />
        </Layout>
      );
    }

    if (!isAuthenticated || !isAccessVerified) {
       // If not authenticated, or if access checks failed and resulted in a redirect, 
       // this return null prevents rendering the component before redirect is complete.
       // isAccessVerified will be false if checks are pending or failed.
      return null;
    }

    // The direct role check and slug check before rendering are less critical now 
    // as useEffect handles redirection, but can be kept as a final safeguard.
    // However, the async nature means isAccessVerified is the more reliable gate here.

    return <Component {...props} />;
  };

  WithAuthComponent.displayName = `WithAuth(${
    Component.displayName || Component.name || 'Component'
  })`;

  return WithAuthComponent;
};

// Simple hook to directly access user's role
export const useUserRole = (): { 
  role: UserRole | null; 
  isLoading: boolean;
} => {
  const { userProfile, isLoading } = useAuth();
  return { 
    role: userProfile?.role || null,
    isLoading 
  };
}; 