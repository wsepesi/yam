import * as z from 'zod';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Layout from '@/components/Layout';
import { NextPage } from 'next';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/router';
import { zodResolver } from '@hookform/resolvers/zod';

// Define the form schema using Zod
const formSchema = z.object({
  password: z.string()
    .min(8, { message: 'Password must be at least 8 characters' })
    .max(64, { message: 'Password must be less than 64 characters' }),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegisterFormValues = z.infer<typeof formSchema>;

interface InvitationData {
  email: string;
  organizationName: string;
  mailroomName: string;
  role: string;
  isExpired: boolean;
}

// Type for the raw record fetched from the 'invitations' table
interface DbInvitationRecord {
  email: string;
  role: string;
  status: string; 
  expires_at: string; 
  organization_id: string; 
  mailroom_id: string; 
}

const Register: NextPage = () => {
  const router = useRouter();
  const { token: queryToken } = router.query;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [validationStep, setValidationStep] = useState<string>('Initializing validation...');
  
  // New states for the revised flow
  const [rawInviteToken, setRawInviteToken] = useState<string | null>(null);
  const [fetchedDbInvite, setFetchedDbInvite] = useState<DbInvitationRecord | null>(null); 
  const [sessionUser, setSessionUser] = useState<User | null>(null);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    const { data: authListenerData } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth State Change:', event, session ? { userEmail: session.user?.email, eventType: event } : 'No session');
      if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session?.user) {
        setSessionUser(session.user);
      } else if (event === 'SIGNED_OUT') {
        setSessionUser(null);
      }
    });

    const validateFlow = async () => {
      // This function will now be called reactively based on state changes.
      // Set isValidating true at the start of the component's lifecycle (useState(true))
      // and only set to false on completion or terminal error.

      // Stage 1: Token Extraction
      let currentToken = rawInviteToken;
      if (!currentToken && router.isReady) {
        setValidationStep('Checking invitation token...');
        let tokenToUse: string | null = null;

        if (typeof queryToken === 'string' && queryToken) {
          console.log('Using token from query params');
          tokenToUse = queryToken;
        } else if (typeof window !== 'undefined') {
          const hash = window.location.hash;
          if (hash) {
            console.log('Found hash in URL:', hash.substring(0, 15) + '...');
            const hashParams = new URLSearchParams(hash.substring(1));
            const accessToken = hashParams.get('access_token');
            const tokenType = hashParams.get('type');

            if (accessToken && tokenType === 'invite') {
              console.log('Found invite token (access_token with type=invite) in hash fragment');
              tokenToUse = accessToken; // Supabase client uses this to establish session
            } else if (accessToken) {
              console.log('Found access_token in hash, type was:', tokenType);
              // If it's an access token but not type=invite, it might be a regular session token.
              // For this page, we're primarily interested in invite tokens.
              // However, Supabase client will establish a session if it's a valid access token.
              // The raw token for DB lookup might be different or not present.
              // This flow assumes the invite link contains a token that can also be used to look up the invite.
              // Often, the `access_token` itself provided on an invite link *is* the invite token.
              tokenToUse = accessToken; 
            } else {
              const altToken = hashParams.get('token') || hashParams.get('invite_token');
              if (altToken) {
                console.log('Found alternative token in hash');
                tokenToUse = altToken;
              }
            }
          }
        }

        if (tokenToUse && tokenToUse.endsWith('/register')) {
          const originalToken = tokenToUse;
          tokenToUse = tokenToUse.substring(0, tokenToUse.length - '/register'.length);
          console.log(`Cleaned token: removed '/register' from '${originalToken}', new token: '${tokenToUse}'`);
        }
        
        if (tokenToUse) {
          console.log('Raw invite token identified:', tokenToUse ? tokenToUse.substring(0,15) + "..." : "null");
          setRawInviteToken(tokenToUse);
          currentToken = tokenToUse;
        } else {
          console.error('No valid invitation token found in URL or hash.');
          setError('Invalid invitation link: No token found.');
          setIsValidating(false);
          return;
        }
      } else if (!currentToken && !router.isReady) {
        console.log('Router not ready for token extraction. Waiting...');
        setValidationStep('Waiting for page to load...');
        return; // Wait for router.isReady or rawInviteToken to be set
      } else if (!currentToken) {
        // This case should ideally be covered by the above, but as a fallback:
        setError('Cannot proceed without an invitation token.');
        setIsValidating(false);
        return;
      }

      // Stage 2: Fetch DB Invitation details
      let currentDbInvite = fetchedDbInvite;
      if (currentToken && !currentDbInvite) {
        setValidationStep('Fetching invitation details...');
        console.log('Fetching invitation with token:', currentToken ? currentToken.substring(0,15) + "..." : "null");
        try {
          const { data, error: dbError } = await supabase
            .from('invitations')
            .select('email, role, status, expires_at, organization_id, mailroom_id')
            .eq('token', currentToken)
            .single();

          console.log('Supabase query data for invitation:', data);
          console.log('Supabase query error for invitation:', dbError);

          if (dbError) {
            console.error('Error fetching invitation:', dbError);
            setError(`Invitation error: ${dbError.message || 'Failed to fetch invitation'}`);
            setIsValidating(false);
            return;
          }
          if (!data) {
            console.error('No invitation data found for token.');
            setError('Invitation not found or already used/invalid.');
            setIsValidating(false);
            return;
          }
          if (data.status !== 'PENDING') {
            console.log('Invitation status is not PENDING:', data.status);
            setError(data.status === 'RESOLVED' || data.status === 'USED' ? 'This invitation has already been used.' : `This invitation is ${data.status.toLowerCase()}.`);
            setIsValidating(false);
            return;
          }
          const now = new Date();
          const expiresAt = new Date(data.expires_at);
          if (now > expiresAt) {
            console.log('Invitation expired', { expires: data.expires_at, now: now.toISOString() });
            setError('This invitation has expired.');
            setIsValidating(false);
            return;
          }
          console.log('DB Invitation data fetched and initially validated:', data.email);
          setFetchedDbInvite(data);
          currentDbInvite = data;
        } catch (err) {
          console.error('Exception fetching invitation:', err);
          setError(`Validation failed: ${err instanceof Error ? err.message : 'Unknown error during DB fetch'}`);
          setIsValidating(false);
          return;
        }
      } else if (!currentDbInvite && currentToken) {
         // Waiting for DB fetch to complete if token is present
        setValidationStep('Fetching invitation details...');
        return;
      } else if (!currentToken) {
        // Should not happen if Stage 1 logic is correct and leads to setting rawInviteToken or error.
        // If it does, means we are stuck without a token.
        return;
      }


      // Stage 3: Check Session User and Finalize
      if (currentDbInvite && sessionUser) {
        console.log('DB invite and session user available. Comparing emails:', currentDbInvite.email, sessionUser.email);
        if (currentDbInvite.email === sessionUser.email) {
          setValidationStep('Fetching organization & mailroom details...');
          let organizationName = 'Unknown Organization';
          try {
            const orgResponse = await supabase.from('organizations').select('name').eq('id', currentDbInvite.organization_id).single();
            if (orgResponse.error) console.error('Error fetching organization:', orgResponse.error);
            else if (orgResponse.data) organizationName = orgResponse.data.name;
          } catch (orgErr) { console.error('Exception fetching organization:', orgErr); }

          let mailroomName = 'Unknown Mailroom';
          try {
            const mailroomResponse = await supabase.from('mailrooms').select('name').eq('id', currentDbInvite.mailroom_id).single();
            if (mailroomResponse.error) console.error('Error fetching mailroom:', mailroomResponse.error);
            else if (mailroomResponse.data) mailroomName = mailroomResponse.data.name;
          } catch (mailroomErr) { console.error('Exception fetching mailroom:', mailroomErr); }
          
          const finalInvitationData: InvitationData = {
            email: currentDbInvite.email,
            organizationName,
            mailroomName,
            role: currentDbInvite.role,
            isExpired: new Date() > new Date(currentDbInvite.expires_at),
          };

          if (finalInvitationData.isExpired) {
            setError('This invitation has expired.');
            setIsValidating(false);
            return;
          }
          
          setInvitation(finalInvitationData);
          setError(null); // Clear any previous transient errors
          setIsValidating(false);
          console.log('Validation successful. Ready for password set for user:', finalInvitationData.email);
        } else {
          console.error('Session user email does not match invitation email.');
          setError('Your current session email does not match the invited email. Please ensure you are using the correct link or try in an incognito window.');
          // Clear states to allow potential retry if URL changes or user logs out and back in with correct account.
          setInvitation(null);
          setFetchedDbInvite(null); 
          // setRawInviteToken(null); // Careful: might cause loop if queryToken is still there.
                                  // Let user refresh or use new link if this happens.
          setIsValidating(false);
        }
      } else if (currentDbInvite && !sessionUser) {
        // DB invite details are ready, but session is not yet confirmed for this user.
        // Supabase client should be handling the token from URL to establish session.
        // onAuthStateChange will update sessionUser and trigger a re-run.
        console.log('DB invite details fetched. Waiting for user session to be confirmed for:', currentDbInvite.email);
        setValidationStep(`Confirming your session for ${currentDbInvite.email}...`);
        // isValidating remains true.
      } else if (!currentDbInvite && currentToken) {
        // Token present, but DB details not fetched yet (should be handled by stage 2 logic or its return)
        // This state means Stage 2 is in progress or failed to setFetchedDbInvite.
        // If Stage 2 errored, isValidating would be false. So this means Stage 2 is pending.
        setValidationStep('Fetching invitation data...');
      }
      // If none of the above conditions for completion or error are met, isValidating remains true.
    };
    
    // Call validateFlow if we are in a state where it might make progress.
    // It's reactive to changes in its dependencies.
    if (isValidating || (!rawInviteToken && router.isReady && !error)) {
        validateFlow();
    }

    return () => {
      // Correctly access the subscription object
      if (authListenerData && authListenerData.subscription) {
        authListenerData.subscription.unsubscribe();
      } else {
        // Fallback if the structure is different or it's null (though Supabase docs imply data.subscription)
        // This case should ideally not be hit if types are aligned with library version.
        console.warn('Could not unsubscribe from auth listener: subscription object not found as expected.');
      }
    };
  }, [router.isReady, queryToken, rawInviteToken, fetchedDbInvite, sessionUser, isValidating, error]);


  const onSubmit = async (formData: RegisterFormValues) => {
    if (!invitation || !sessionUser || !rawInviteToken) {
      setError('Cannot submit form: Invitation details or session is missing. Please refresh.');
      return;
    }
    if (sessionUser.email !== invitation.email) {
      setError('Session email mismatch. Please ensure you are logged in with the invited email.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('Attempting to update password for user:', sessionUser.email);
      const { error: updateUserError } = await supabase.auth.updateUser({
        password: formData.password,
      });

      if (updateUserError) {
        console.error('Error updating user password:', updateUserError);
        setError(`Password update failed: ${updateUserError.message}`);
        setIsLoading(false);
        // Mark invitation as FAILED
        try {
          await supabase.from('invitations').update({ status: 'FAILED' }).eq('token', rawInviteToken);
          console.log('Invitation status updated to FAILED after password update error.');
        } catch (updateErr) {
          console.error('Error updating invitation status to FAILED:', updateErr);
        }
        return;
      }

      console.log('User password updated successfully for:', sessionUser.email);

      // Mark the invitation as RESOLVED
      const { error: invitationUpdateError } = await supabase
        .from('invitations')
        .update({ 
          status: 'RESOLVED', 
          used_at: new Date().toISOString(),
          // user_id: sessionUser.id // Optionally link the user ID
        })
        .eq('token', rawInviteToken);

      if (invitationUpdateError) {
        console.error('Error updating invitation status to RESOLVED:', invitationUpdateError);
        // Non-critical for user flow at this point, password is set.
      } else {
        console.log('Invitation status successfully updated to RESOLVED.');
      }
      
      // Update profile status to ACTIVE
      console.log('Attempting to update profile status to ACTIVE for user ID:', sessionUser.id);
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ status: 'ACTIVE' })
        .eq('id', sessionUser.id); 

      if (profileUpdateError) {
        console.error('Error updating profile status to ACTIVE:', profileUpdateError);
        // Non-critical, proceed with redirect.
      } else {
        console.log('Successfully updated profile status to ACTIVE for user:', sessionUser.id);
      }

      console.log('Registration and password set process complete. Redirecting to /');
      router.push('/');

    } catch (err) {
      console.error('Registration submission error:', err);
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
      // Attempt to mark invitation as FAILED on unexpected errors during submit
      if (rawInviteToken) {
        try {
          await supabase.from('invitations').update({ status: 'FAILED' }).eq('token', rawInviteToken);
          console.log('Invitation status updated to FAILED after unexpected submission error.');
        } catch (updateErr) {
          console.error('Error updating invitation status to FAILED after error:', updateErr);
        }
      }
    }
  };

  // Show loading state while validating the token and session
  if (isValidating) {
    return (
      <Layout title="Validating Invitation | Yam" glassy={false}>
        <div className="flex flex-1 justify-center items-center h-full">
          <div className="text-center">
            <p className="text-[#471803] mb-2">Validating your invitation...</p>
            <p className="text-sm text-[#471803]/80">{validationStep}</p>
            {/* Error display during validation can be helpful */}
            {error && isValidating && (
              <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm max-w-md mx-auto">
                {error}
              </div>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  // Show error if validation failed and no invitation details are available
  if (error && !invitation) {
    return (
      <Layout title="Invalid Invitation | Yam" glassy={false}>
        <div className="flex flex-1 justify-center items-center h-full">
          <div className="w-full max-w-md p-8 text-center bg-[#ffeedd]">
            <h1 className="text-2xl font-medium text-[#471803] mb-4">
              Invitation Problem
            </h1>
            <p className="text-[#471803] mb-6">{error}</p>
            <Button 
              onClick={() => router.push('/login')}
              className="bg-[#471803] hover:bg-[#471803]/90 text-white py-2 rounded-none"
            >
              Go to Login
            </Button>
          </div>
        </div>
      </Layout>
    );
  }
  
  // If invitation is loaded (implies validation passed), show the form
  if (invitation) {
    return (
      <Layout title="Complete Registration | Yam" glassy={false}>
        <div className="flex flex-1 justify-center items-center h-full">
          <div className="w-full max-w-md p-8 space-y-6 bg-[#ffeedd]">
            <div className="text-center">
              <h1 className="text-2xl font-medium tracking-tight text-[#471803] mb-2">
                Set Your Password
              </h1>
              {/* Display invitation details */}
              <div className="text-sm text-[#471803]/80 mb-4">
                <p>You&apos;ve been invited to join</p>
                <p className="font-medium">{invitation.mailroomName} at {invitation.organizationName}</p>
                <p className="mt-2">as a <span className="font-medium">{invitation.role}</span></p>
                <p className="mt-1">Email: {invitation.email}</p>
              </div>
            </div>

            {/* Display error messages that occur after validation (e.g., during form submission) */}
            {error && (
              <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
                {error}
              </div>
            )}

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="password" className="text-[#471803]/90">Create Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Set your password"
                  {...form.register('password')}
                  className="bg-white border-[#471803]/50 focus:border-[#471803] focus:ring-[#471803] rounded-none w-full"
                  disabled={isLoading}
                />
                {form.formState.errors.password && (
                  <p className="text-xs text-red-600">{form.formState.errors.password.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="confirmPassword" className="text-[#471803]/90">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  {...form.register('confirmPassword')}
                  className="bg-white border-[#471803]/50 focus:border-[#471803] focus:ring-[#471803] rounded-none w-full"
                  disabled={isLoading}
                />
                {form.formState.errors.confirmPassword && (
                  <p className="text-xs text-red-600">{form.formState.errors.confirmPassword.message}</p>
                )}
              </div>

              <Button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-[#471803] hover:bg-[#471803]/90 text-white py-2 rounded-none"
              >
                {isLoading ? 'Setting Password...' : 'Complete Registration & Set Password'}
              </Button>
            </form>
          </div>
        </div>
      </Layout>
    );
  }

  // Fallback if no other condition is met (e.g. unexpected state)
  // This should ideally not be reached if logic for isValidating, error, and invitation is correct.
  return (
    <Layout title="Registration | Yam" glassy={false}>
      <div className="flex flex-1 justify-center items-center h-full">
        <p className="text-[#471803]">Loading registration page or unexpected state.</p>
      </div>
    </Layout>
  );
};

export default Register;