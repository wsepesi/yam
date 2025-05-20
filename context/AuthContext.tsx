import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';

import Layout from '@/components/Layout';
import UserTabPageSkeleton from '@/components/UserTabPageSkeleton';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/router';

// Role type - should match the database
export type UserRole = 'user' | 'manager' | 'admin' | 'super-admin';

// Define the shape of the user profiles in your database
export interface UserProfile {
  id: string;
  role: UserRole;
  status: 'INVITED' | 'ACTIVE' | 'REMOVED';
  organization_id: string;
  mailroom_id: string;
  // Add other profile fields you may have
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
      console.log('AuthContext: Fetching user profile for ID:', userId);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('AuthContext: Error fetching user profile', error);
        return null;
      }

      console.log('AuthContext: User profile fetched successfully', data);
      return data as UserProfile;
    } catch (error) {
      console.error('AuthContext: Exception fetching user profile', error);
      return null;
    }
  };

  // Function to explicitly refresh the user profile
  const refreshUserProfile = async () => {
    if (user?.id) {
      console.log('AuthContext: Explicitly refreshing user profile for ID:', user.id);
      setIsLoading(true); // Indicate loading during refresh
      const profile = await fetchUserProfile(user.id);
      setUserProfile(profile);
      setIsLoading(false);
      console.log('AuthContext: User profile refresh complete', { hasProfile: !!profile });
      return profile; // Optionally return the profile
    }
    console.log('AuthContext: refreshUserProfile called but no user ID available.');
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
          console.log('AuthContext: USER_UPDATED event received for user:', currentSession.user.id, '. Profile refresh should be handled explicitly if needed.');
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
      console.log('AuthContext: Starting sign in process');
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      console.log('AuthContext: Supabase auth response received', { success: !error, hasUser: !!data?.user });

      if (error) {
        console.error('AuthContext: Sign in error from Supabase:', error);
        return { error, success: false, userProfile: null };
      }

      // Fetch the profile on successful sign in
      let fetchedProfile: UserProfile | null = null;
      if (data.user) {
        console.log('AuthContext: Sign in successful, fetching user profile');
        fetchedProfile = await fetchUserProfile(data.user.id);
        console.log('AuthContext: User profile fetch complete', { hasProfile: !!fetchedProfile });

        // Check if the user's status is 'REMOVED'
        if (fetchedProfile && fetchedProfile.status === 'REMOVED') {
          console.warn('AuthContext: User status is REMOVED. Access denied.', { userId: data.user.id });
          await supabase.auth.signOut(); // Sign the user out
          setSession(null);
          setUser(null);
          setUserProfile(null);
          return { error: new Error('Your access has been revoked.'), success: false, userProfile: null };
        }

        // Set the profile state within the context
        setUserProfile(fetchedProfile);
      }

      console.log('AuthContext: Sign in process completed successfully');
      // Return the fetched profile along with success status
      return { error: null, success: true, userProfile: fetchedProfile };
    } catch (error) {
      console.error('AuthContext: Unexpected error during sign in:', error);
      return { error: error as Error, success: false, userProfile: null };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
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

    useEffect(() => {
      let timerId: NodeJS.Timeout | undefined;
      if (isLoading) {
        timerId = setTimeout(() => {
          if (isLoading) {
            console.warn('withAuth HOC: Loading state timed out. Forcing redirect to login.');
            setLoadingTimedOut(true);
          }
        }, 2000);
      } else {
        setLoadingTimedOut(false);
      }

      return () => {
        if (timerId) {
          clearTimeout(timerId);
        }
      };
    }, [isLoading]);

    useEffect(() => {
      if (loadingTimedOut && isLoading) {
        router.push(`/login?callbackUrl=${encodeURIComponent(router.asPath)}&reason=loading_timeout`);
        return;
      }

      if (!isLoading && !isAuthenticated) {
        router.push(`/login?callbackUrl=${encodeURIComponent(router.asPath)}`);
        return;
      }

      if (!isLoading && isAuthenticated && userProfile) {
        if (
          requiredRole &&
          userProfile.role !== requiredRole &&
          userProfile.role !== 'admin' &&
          userProfile.role !== 'super-admin'
        ) {
          router.push('/unauthorized');
        }
      }
    }, [isLoading, isAuthenticated, userProfile, router, loadingTimedOut]);

    const effectivelyLoading = isLoading || (isAuthenticated && !userProfile);

    if (effectivelyLoading) {
      if (loadingTimedOut && isLoading) {
        return null;
      }
      return (
        <Layout title="Loading..." glassy={false}>
          <UserTabPageSkeleton />
        </Layout>
      );
    }

    if (!isAuthenticated) {
      return null;
    }

    if (
      requiredRole &&
      userProfile &&
      userProfile.role !== requiredRole &&
      userProfile.role !== 'admin' &&
      userProfile.role !== 'super-admin'
    ) {
      return null;
    }

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